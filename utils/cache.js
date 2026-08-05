// كاش مشترك في الذاكرة — يحمي حصة Firestore المجانية (50 ألف قراءة/يوم).
// كل التطبيقات واللوحة تستطلع بالتوازي؛ بدون هذا الكاش كل استطلاع = قراءة
// مجموعة كاملة، وهذا ما استنفد الحصة مراراً.

const store = new Map();

/**
 * يعيد القيمة المخزّنة إن كانت طازجة، وإلا ينفّذ loader ويخزّن نتيجته.
 * الطلبات المتزامنة على نفس المفتاح تتشارك نفس الوعد (لا قراءات مكرّرة).
 */
async function cached(key, ttlMs, loader) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.pending || hit.value;

  /* ===== رمز القراءة: يمنع نتيجةً قديمة أن تدهس كتابةً أحدث =====
   *
   * كان العطل هكذا، وهو يقع كل يوم لا في الحالات النادرة:
   *
   *   لحظة ٠ : الزبون يستطلع، الكاش منتهٍ → تبدأ قراءة Firestore
   *   لحظة ١ : المندوب يضغط «تم التوصيل» → updateCached يُصلح النسخة
   *   لحظة ٢ : قراءة اللحظة صفر تصل — وهي **أقدم من التسليم** —
   *            فتُخزَّن فوق النسخة المُصلَحة بعمر كامل جديد.
   *
   * فيبقى الطلب في الكاش «عند المطعم» وقد سُلّم، ويراه الزبون كذلك
   * حتى ينتهي العمر. وهذا ما رآه يزن بعينه.
   *
   * والنافذة ليست ضيّقة كما تبدو: التطبيقات تستطلع لحظة الفعل نفسه
   * (السوكت يوقظ fetchOrders)، فالقراءة والكتابة متلازمتان لا
   * مستقلّتين — أي أن التصادم مُرجَّح لا نادر.
   *
   * العلاج: لكل قراءة رمزٌ خاص. إن لم يعد رمزُ المفتاح رمزَنا حين
   * نعود، فقد كُتب عليه بعدنا — فنُعطي النتيجة لطالبها ولا نُخزّنها.
   */
  const token = {};
  const pending = (async () => {
    const value = await loader();
    const cur = store.get(key);
    if (!cur || cur.token !== token) {
      // كُتب على المفتاح أثناء قراءتنا: النسخة المكتوبة أحدث من نسختنا
      if (cur && cur.expires > Date.now() && Array.isArray(cur.value)) return cur.value;
      return value;                       // لا نُخزّن قراءةً تجاوزَتها الأحداث
    }
    store.set(key, { value, expires: Date.now() + ttlMs, pending: null, token });
    return value;
  })();
  // نخزّن الوعد فوراً كي لا ينطلق أكثر من استعلام لنفس المفتاح
  store.set(key, { value: hit ? hit.value : null, expires: now + ttlMs, pending, token });
  try {
    return await pending;
  } catch (e) {
    const cur = store.get(key);
    if (cur && cur.token === token) store.delete(key);   // لا نُخزّن الفشل
    if (hit && hit.value) return hit.value;  // نُرجع آخر نسخة ناجحة إن وُجدت
    throw e;
  }
}

/**
 * يُعدّل القيمة المخزّنة مكانها بدل مسحها.
 * السيرفر هو الكاتب الوحيد، فتعديل الكاش محلياً يبقيه صحيحاً بلا قراءة جديدة.
 * هذا الفرق بين 72 ألف قراءة/يوم و 12 ألف.
 */
function updateCached(key, mutator) {
  const hit = store.get(key);
  if (!hit) return false;

  /* لا نسخة صالحة بين أيدينا (قراءةٌ أولى ما زالت جارية): نُسقط
   * المفتاح. القراءة الجارية ستجد رمزها قد تغيّر فلا تُخزَّن، وتُعاد
   * القراءة من Firestore بعد كتابتنا — قراءة زائدة ثمنُها صحّةٌ. */
  if (!Array.isArray(hit.value)) { store.delete(key); return false; }

  try {
    const next = mutator(hit.value);
    if (Array.isArray(next)) {
      /* رمز جديد: أي قراءة بدأت قبل هذه الكتابة تُهمَل نتيجتها.
       * و`pending: null` كي يقرأ اللاحقون نسختنا المُصلَحة لا وعداً قديماً.
       * والعمر يبقى كما كان — التعديل لا يُطيل عمر الكاش، وإلا لظلّ
       * مفتاحٌ نشِط يُعدَّل ولا يُراجَع مقابل قاعدة البيانات أبداً. */
      store.set(key, { value: next, expires: hit.expires, pending: null, token: {} });
      return true;
    }
  } catch (e) { store.delete(key); }
  return false;
}

/** يُبطل الكاش بعد أي كتابة، فيرى المستخدم أثر تعديله فوراً. */
function invalidate(...keys) {
  if (!keys.length) return store.clear();
  keys.forEach(k => store.delete(k));
}

module.exports = { cached, invalidate, updateCached };
