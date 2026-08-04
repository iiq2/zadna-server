/* ============================================================================
 * جسر كلمات السر إلى Firebase Authentication
 *
 * لماذا:
 * كانت كلمات السر مُعمّاة بـbcrypt في Firestore، وكان ذلك يعني أن لا أحد —
 * لا الزبون ولا الإدارة — يستطيع إعادة تعيين كلمة منسيّة. ولا يمكن أن يرسل
 * غوغل رسالة استعادة لحسابٍ لا يعرفه، وحساباتنا لم تكن عنده أصلاً.
 *
 * بعد هذا الجسر يصير Firebase هو مرجع كلمات السر، فتأتي رسالة الاستعادة من
 * بنية غوغل نفسها — تصل صندوق الوارد لا المزعج، مجاناً، وبلا نطاقٍ نبني له
 * سمعةً من الصفر.
 *
 * قاعدتان لا أخالفهما هنا:
 *
 * ١. لا أُقفل الباب على أحد. من لم يُنقل بعد يدخل بـbcrypt كما كان، ويُنقل
 *    في تلك اللحظة نفسها لأن كلمته الصريحة تمرّ بين يديّ مرة واحدة.
 *
 * ٢. لا مرجعان لكلمة واحدة. حالما يُنقل الحساب تُمحى بصمة bcrypt، وإلا بقيت
 *    الكلمة القديمة صالحة بعد أن يغيّرها صاحبها — وهذا أسوأ من ألّا ننقل.
 * ========================================================================== */

const admin = require('firebase-admin');

const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || '';
const IDENTITY = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';

if (!WEB_API_KEY) {
  console.warn('⚠️ FIREBASE_WEB_API_KEY غير مضبوط — الدخول يبقى على bcrypt ولا يُنقل أحد');
}

function isConfigured() {
  return !!WEB_API_KEY;
}

/**
 * يتحقق من كلمة السر عند Firebase.
 *
 * لا يمرّ بـAdmin SDK لأنه لا يملك تحقّقاً من كلمات السر إطلاقاً — هذا
 * المسار (Identity Toolkit) هو الطريق الرسمي الوحيد، وهو مجاني.
 *
 * يُرجع: { ok, uid } أو { ok:false, reason } حيث reason إحدى:
 *   'wrong'        كلمة خاطئة أو حساب غير موجود — قرارٌ نهائي، لا تراجع عنه
 *   'disabled'     الحساب موقوف عند غوغل
 *   'unavailable'  عطل شبكة أو إعداد — قرارٌ غير نهائي
 */
async function verifyPassword(email, password) {
  if (!WEB_API_KEY) return { ok: false, reason: 'unavailable' };

  let r;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    r = await fetch(`${IDENTITY}?key=${encodeURIComponent(WEB_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
      signal: ctrl.signal
    });
    clearTimeout(t);
  } catch (e) {
    console.warn('⚠️ تعذّر الوصول إلى Firebase Auth:', e.message);
    return { ok: false, reason: 'unavailable' };
  }

  const d = await r.json().catch(() => ({}));

  if (r.ok && d.localId) return { ok: true, uid: d.localId };

  const code = String((d.error && d.error.message) || '');

  // خطأ إعداد لا خطأ مستخدم: لا نقول له «كلمتك خاطئة» ونحن السبب
  if (/API key not valid|PERMISSION_DENIED|CONFIGURATION_NOT_FOUND|OPERATION_NOT_ALLOWED/i.test(code)) {
    console.error('❌ إعداد Firebase Auth ناقص:', code);
    return { ok: false, reason: 'unavailable' };
  }
  if (/USER_DISABLED/i.test(code)) return { ok: false, reason: 'disabled' };
  if (/EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS/i.test(code)) {
    return { ok: false, reason: 'wrong' };
  }
  // TOO_MANY_ATTEMPTS وغيره: حماية غوغل تعمل — لا نلتفّ عليها بـbcrypt
  console.warn('⚠️ ردّ غير متوقّع من Firebase Auth:', code);
  return { ok: false, reason: 'wrong' };
}

/**
 * يُنشئ الحساب عند Firebase (أو يضبط كلمته إن كان موجوداً من دخول جوجل).
 * يُرجع uid أو null. لا يرمي أبداً — فشلُ النقل يجب ألّا يمنع دخولاً ناجحاً.
 */
async function ensureAuthUser(email, password, name) {
  try {
    const u = await admin.auth().createUser({
      email,
      password,
      displayName: name || undefined,
      emailVerified: false
    });
    return u.uid;
  } catch (e) {
    if (e && e.code === 'auth/email-already-exists') {
      // موجود من دخول جوجل: نضيف له كلمة سر فيصير له طريقان للدخول
      try {
        const existing = await admin.auth().getUserByEmail(email);
        await admin.auth().updateUser(existing.uid, { password });
        return existing.uid;
      } catch (e2) {
        console.warn('⚠️ تعذّر ضبط كلمة سر لحساب Firebase قائم:', e2.message);
        return null;
      }
    }
    console.warn('⚠️ تعذّر إنشاء حساب Firebase:', (e && e.message) || e);
    return null;
  }
}

module.exports = { isConfigured, verifyPassword, ensureAuthUser };
