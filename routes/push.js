const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

const getDb = (req) => req.app.get('db');
const needsIdentity = (req, res, next) => {
  const fn = req.app.get('requireIdentity');
  return fn ? fn(req, res, next) : next();
};

/* ============================================================
   الإشعارات — القناة الوحيدة التي تصل المستخدم وتطبيقه مغلق.

   قبلها كان النظام أعمى: صاحب المطعم لا يعلم بطلب وصله إلا إن
   كان فاتحاً التطبيق وناظراً إليه، والمندوب كذلك، والزبون ينتظر
   بلا خبر. وهذا لا يصلح لعمل التوصيل: صاحب المطعم في المطبخ
   والمندوب على الموتور.

   القنوات وأصواتها (الملفات في res/raw بالتطبيق):
     zadna_alert    → المطعم: طلب جديد | المندوب: طلب جاهز
     zadna_update   → الزبون: تحديثات وسط الطريق
     zadna_arrived  → الزبون: المندوب على الباب
     zadna_success  → الزبون: نجح الطلب / تم التوصيل (أغنية زادنا)
   ============================================================ */

/* أسماء القنوات هنا **يجب** أن تطابق ما ينشئه التطبيق حرفاً بحرف.
 *
 * التطبيق رقّى قنواته إلى `_v2` (لأن صوت القناة يتجمّد عند إنشائها
 * ولا سبيل لتغييره إلا باسم جديد)، وبقي السيرفر يرسل الأسماء القديمة.
 *
 * والنتيجة كانت أخبث عطل في الإشعارات:
 *   · التطبيق مفتوح  → onMessageReceived يصحّح الاسم → يصل ✓
 *   · التطبيق مغلق   → **النظام** يعرض بالقناة التي سمّاها السيرفر،
 *                      وهي غير موجودة → أندرويد يُسقطه **صامتاً**
 *
 * فتصل الإشعارات «حين تفتح التطبيق» ولا تصل حين يهمّ الأمر — وهو
 * بالضبط ما لا يحتمله تطبيق توصيل: المطعم لا يسمع بالطلب الجديد.
 *
 * وقناة `partner` كانت غائبة هنا أصلاً: المطعم كان يُرسَل له على قناة
 * الكابتن، فيصله — إن وصله — بصوت الكابتن. */
const CHANNELS = {
  // v3 للكابتن وحده: صوت منبّه واهتزاز أطول وإيقاظ شاشة — إعدادات
  // القناة تتجمّد عند إنشائها فلا ترقية إلا باسم جديد. **يستلزم بناء
  // تطبيق الكابتن مع هذا النشر** وإلا سقط إشعاره على قناة غير موجودة.
  alert:   { id: 'zadna_alert_v3',   sound: 'zadna_alert',   priority: 'high' },
  partner: { id: 'zadna_partner_v2', sound: 'zadna_partner', priority: 'high' },
  update:  { id: 'zadna_update_v2',  sound: 'zadna_update',  priority: 'default' },
  arrived: { id: 'zadna_arrived_v2', sound: 'zadna_arrived', priority: 'high' },
  success: { id: 'zadna_success_v2', sound: 'zadna_intro',   priority: 'high' },
  /* الشات: خفيفة عمداً.
   * الرسالة ليست طلباً — لا تتجاوز «عدم الإزعاج» ولا تهتزّ طويلاً ولا
   * توقظ الشاشة. من يُرعبه رنينُ رسالةٍ يُطفئ إشعارات زادنا كلها،
   * فيخسر الطلبات معها. `zadna_update` أقصر نغماتنا وأهدؤها. */
  chat:    { id: 'zadna_chat_v1',    sound: 'zadna_update',  priority: 'default' },
};

/* ===== حفظ رموز الأجهزة =====

   المستخدم قد يملك أكثر من جهاز (جوال وتابلت)، فالرموز مصفوفة.

   ويملك أيضاً أكثر من تطبيق: صاحب المطعم يطلب عشاءه من تطبيق الزبون،
   والمندوب يطلب لأهله. وكلها تُحفظ تحت حسابٍ واحد.

   فلو لم نُميّز مصدر الرمز، ذهب كل إشعار إلى كل أجهزته: نجاح طلبه
   كزبون — بأغنية زادنا — يرنّ على لوحة تحكم مطعمه، وإنذار «طلب جديد
   وصلك» يرنّ في يده وهو جالس زبوناً. لذلك نحفظ مع كل رمز التطبيق
   الذي جاء منه.
   ===================================================================== */

const APPS = new Set(['customer', 'captain', 'merchant']);

// POST /api/fcm_token  { token, app }
router.post('/fcm_token', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    const token = String((req.body && req.body.token) || '').trim();
    const app = String((req.body && req.body.app) || '').trim();
    const uid = String((req.user && req.user.userId) || '');
    if (!db || !uid) return res.status(400).json({ success: false, error: 'لا يمكن تسجيل الجهاز' });
    if (token.length < 20) return res.status(400).json({ success: false, error: 'رمز جهاز غير صالح' });

    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'الحساب غير موجود' });

    const d = snap.data();
    const cur = Array.isArray(d.fcmTokens) ? d.fcmTokens : [];
    // fcmDevices هو المرجع الجديد؛ fcmTokens يبقى لتوافق النسخ القديمة
    const devs = Array.isArray(d.fcmDevices) ? d.fcmDevices : [];
    const known = devs.find(x => x && x.token === token);

    // نُعيد الكتابة أيضاً إن تغيّر وسم التطبيق: جهازٌ سُجّل بنسخة قديمة
    // بلا وسم يُصحَّح أول ما يفتح التطبيق المحدَّث، فلا يبقى مجهولاً.
    if (!known || (APPS.has(app) && known.app !== app)) {
      const rest = devs.filter(x => x && x.token !== token);
      const entry = { token, app: APPS.has(app) ? app : null, at: Date.now() };
      // نُبقي آخر 5 أجهزة فقط — أكثر من ذلك يعني أجهزة قديمة لم تُحذف
      await ref.update({
        fcmDevices: [entry, ...rest].slice(0, 5),
        fcmTokens: [token, ...cur.filter(t => t !== token)].slice(0, 5),
      });
    }
    res.json({ success: true });
  } catch (e) {
    console.error('❌ حفظ رمز الجهاز:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/fcm_token  { token } — عند تسجيل الخروج
router.delete('/fcm_token', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    const token = String((req.body && req.body.token) || '').trim();
    const uid = String((req.user && req.user.userId) || '');
    if (!db || !uid || !token) return res.json({ success: true });
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return res.json({ success: true });
    const d = snap.data();
    const cur = Array.isArray(d.fcmTokens) ? d.fcmTokens : [];
    const devs = Array.isArray(d.fcmDevices) ? d.fcmDevices : [];
    await ref.update({
      fcmTokens: cur.filter(t => t !== token),
      fcmDevices: devs.filter(x => x && x.token !== token),
    });
    res.json({ success: true });
  } catch (e) {
    res.json({ success: true });   // فشل الإزالة لا يمنع الخروج
  }
});

/* ============================================================
   POST /api/driver_shift  { onShift: true|false }

   المندوب يقول للسيرفر متى يبدأ دوامه ومتى ينهيه.

   كان هذا القرار في الهاتف وحده، وكان الإسكات يقع **بعد** وصول
   الإشعار. وذاك خطأ من وجهين: عَلَمُ الهاتف يُطفأ من تلقاء نفسه حين
   يفشل بدء خدمة الموقع والتطبيق في الخلفية (أندرويد ١٢+)، فيصمت
   مندوبٌ على دوامه ويخسر رزقه؛ ثم إننا نستهلك حصّة إرسال ونوقظ جهازاً
   لنقول له «لا شيء لك».

   الآن الحقل على السيرفر، و`notifyDrivers` تقرؤه قبل الإرسال.
   ============================================================ */
router.post('/driver_shift', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    const uid = String((req.user && req.user.userId) || '');
    if (!db || !uid) return res.json({ success: true });
    const onShift = req.body && req.body.onShift === true;
    await db.collection('users').doc(uid).update({
      onShift,
      shiftChangedAt: new Date()
    });
    res.json({ success: true, onShift });
  } catch (e) {
    /* فشل التسجيل لا يمنع المندوب من العمل — والغياب يعني «نعم»
     * في notifyDrivers، فالأسوأ أن يصله طلب وهو منصرف، لا أن يفوته
     * طلبٌ وهو على الطريق. */
    console.warn('⚠️ تسجيل الوردية:', e.message);
    res.json({ success: true, saved: false });
  }
});

/* ===== الإرسال ===== */

/**
 * رموز أجهزة هؤلاء المستخدمين — لتطبيقٍ بعينه إن طُلب.
 *
 * `wantApp` هو ما يمنع تسرّب الإشعار بين تطبيقات الشخص الواحد.
 * والجهاز غير الموسوم (سُجّل بنسخة سابقة لهذا الإصلاح) يُقبل دائماً:
 * إقصاؤه يعني أن يصمت جوّال كل من لم يُحدّث بعد — وصمت الإشعارات
 * أسوأ من تسرّبها.
 */
async function tokensOf(db, userIds, wantApp) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) return [];
  const snaps = await Promise.all(ids.map(id => db.collection('users').doc(id).get()));
  const out = [];
  snaps.forEach(s => {
    if (!s.exists) return;
    const d = s.data();
    const devs = Array.isArray(d.fcmDevices) ? d.fcmDevices : null;
    if (devs && devs.length) {
      devs.forEach(x => {
        if (!x || !x.token) return;
        if (wantApp && x.app && x.app !== wantApp) return;   // تطبيق آخر لنفس الشخص
        out.push(x.token);
      });
      return;
    }
    // لا سجلّ أجهزة بعد — نرجع للمصفوفة القديمة كما كانت
    if (Array.isArray(d.fcmTokens)) out.push(...d.fcmTokens);
  });
  return [...new Set(out)];
}

/**
 * يرسل إشعاراً ويحذف الرموز الميتة.
 *
 * الرمز يموت حين يحذف المستخدم التطبيق أو يمسح بياناته. تركه يعني
 * محاولة إرسال فاشلة في كل مرة إلى آخر الدهر، وبطء متراكم.
 */
async function push(db, tokens, { title, body, channel = 'update', data = {} }) {
  if (!tokens || !tokens.length) {
    // صمتٌ مُعلَّل خيرٌ من صمتٍ غامض: لا جهاز مسجّلاً لهذا المستقبِل أصلاً
    console.log(`📭 ${channel} → لا أجهزة مسجّلة · «${title}»`);
    return { sent: 0, failed: 0 };
  }
  const ch = CHANNELS[channel] || CHANNELS.update;

  /* ============================================================
     رسالة بيانات خالصة — بلا `notification`. وهذا سطرُ الفرق كلّه.

     ما كان: الرسالة تحمل `notification` **و** `data` معاً. وهذا الخليط
     يشطر السلوك شطرين لا يلتقيان:

       · التطبيق مفتوح  → يُنادى `onMessageReceived`، فيعمل كودنا،
                          فتُسمع نغمة الكابتن كاملة
       · التطبيق مغلق أو
         في الخلفية     → أندرويد يرسم الإشعار بنفسه من `notification`،
                          و`onMessageReceived` **لا يُنادى إطلاقاً**

     أي أنّ كل ما بنيناه لإنذار الكابتن — مجرى المنبّه بدل مجرى
     الإشعارات، و`FLAG_INSISTENT` الذي يُبقي الرنين حتى يُلمس،
     و`fullScreenIntent` الذي يوقظ الشاشة، وتجاوز «عدم الإزعاج» —
     لا يُنفَّذ **في اللحظة الوحيدة التي وُجد من أجلها**: والمندوب على
     دراجته وهاتفه في جيبه والتطبيق في الخلفية.

     ثم يفتح التطبيق، فتُسلَّم الرسالة المؤجّلة إلى `onMessageReceived`،
     فتنطلق النغمة حينها. ولهذا كان يقول: «يصلني إشعار بلا نغمة، والنغمة
     تأتي حين أدخل التطبيق». لم يكن عطلاً في الصوت ولا في القناة — كان
     الكود لا يعمل أصلاً حين يجب أن يعمل.

     وبحذف `notification` يصير `onMessageReceived` هو الطريق الوحيد في
     كل الحالات، فيُرسم كل إشعار بيد واحدة وبقواعد واحدة.

     ثمنه المعروف: إن أوقف المستخدم التطبيق قسراً (Force stop) لا يصله
     شيء. وهذا مقبول — من يوقف تطبيقه قسراً لا ينتظر طلباً، ورسالة
     `notification` كانت ستصله صامتة على أي حال فلا تُوقظه.
     ============================================================ */
  const message = {
    /* ============================================================
       الصيغة المزدوجة — تصحيحٌ لنصف صواب.

       ليلة أمس حذفتُ `notification` كلياً لأن الخليط كان يمنع
       `onMessageReceived` من العمل في الخلفية. وكان التشخيص صحيحاً
       والعلاج ناقصاً: رسالة البيانات الخالصة تحتاج أن **يوقظ النظام
       التطبيق** ليرسم الإشعار بنفسه — وهواتف شاومي وأوبو وهواوي (وهي
       أغلب السوق هنا) تمنع ذلك بمدير البطارية. فصار الإنذار يعمل
       والتطبيق مفتوح، ويصمت وهو مغلق. أي أنّي نقلتُ الصمت من مكان
       إلى مكان.

       والصواب أن الاثنين ليسا بديلين — بل طبقتان تتكاملان:

         · **التطبيق مفتوح**: أندرويد لا يرسم حمولة `notification`
           ويسلّمها لـ`onMessageReceived` — فيعمل كودنا كاملاً:
           مجرى المنبّه، والرنين الذي لا يسكت (FLAG_INSISTENT)،
           والشاشة الكاملة.

         · **التطبيق مغلق أو الجهاز يخنقه**: النظام يرسم الإشعار
           بنفسه بلا حاجة لإيقاظ أحد — **وصوته من القناة لا منّا**.
           وقناة `zadna_alert_v3` مضبوطة على مجرى المنبّه وتتجاوز
           «عدم الإزعاج»، فيرنّ رنّة الكابتن كاملةً. يفوتنا الرنينُ
           المتكرّر وحده — وهذا خسارةٌ مقبولة أمام صمتٍ تامّ.

       أي أنّ الإشعار يصل في الحالتين، ويرنّ في الحالتين، وأشدّ ما
       يمكن في كلٍّ منهما.
       ============================================================ */
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries({ ...data, title, body, channel: ch.id })
        .map(([k, v]) => [k, String(v == null ? '' : v)])
    ),
    android: {
      notification: {
        /* القناة هي كل شيء على أندرويد ٨+: الصوت والاهتزاز وتجاوز
         * «عدم الإزعاج» تُقرأ منها لا من هذه الرسالة. و`sound` هنا
         * للأجهزة الأقدم وحدها. */
        channelId: ch.id,
        sound: ch.sound,
        // طلب الكابتن يُعامَل معاملة المكالمة: يوقظ الشاشة ولا يُؤجَّل
        ...(channel === 'alert'
          ? { priority: 'max', visibility: 'public', defaultVibrateTimings: false }
          : {}),
      },
      // 'high' يوقظ الجهاز من Doze ويُسلّم رسالة البيانات فوراً.
      // بـ'normal' يؤجّلها النظام إلى نافذة الصيانة التالية — وقد تكون
      // بعد ربع ساعة. وطلبٌ يصل بعد ربع ساعة ليس طلباً.
      priority: 'high',
      /* عمر الرسالة.
       *
       * طلبُ كابتنٍ عمره نصف ساعة ضررُه أكبر من نفعه: يرنّ رنيناً لا
       * يسكت على طلبٍ أخذه غيره أو ألغاه الزبون. فالإنذار يموت بعد
       * خمس دقائق، والباقي يعيش ساعة. */
      ttl: channel === 'alert' ? 5 * 60 * 1000 : 60 * 60 * 1000,
    },
  };

  try {
    const r = await admin.messaging().sendEachForMulticast({ tokens, ...message });
    const dead = [];
    const codes = new Set();
    r.responses.forEach((resp, i) => {
      if (!resp.success) {
        const code = resp.error && resp.error.code;
        if (code) codes.add(code);
        if (code === 'messaging/registration-token-not-registered'
         || code === 'messaging/invalid-registration-token') dead.push(tokens[i]);
      }
    });
    if (dead.length) cleanupDeadTokens(db, dead).catch(() => {});

    /* سطر الحقيقة — «ما وصل الإشعار» كانت بلا جواب.
     *
     * كل نداءات الإرسال تُبتلع بـ catch(()=>{}) عند مستدعيها، والعدّان
     * sent/failed يعودان ولا يقرؤهما أحد. فحين قال صاحب المنصّة «ما
     * وصل الديليفري» لم يكن في السجلّ كله سطرٌ يقول أأُرسل شيء أصلاً،
     * أم أُرسل وفشل، أم فشل لأي سبب. سطرٌ واحد لكل إرسال يجيب الثلاثة:
     *   📨 alert → أُرسل 1 · فشل 1 (messaging/registration-token-not-registered)
     * ومعناه فوراً: جهاز المندوب سجّل رمزاً ثم حُذف التطبيق أو مُسح. */
    const codesTxt = codes.size ? ` (${[...codes].join(', ')})` : '';
    console.log(`📨 ${channel} → أُرسل ${r.successCount} · فشل ${r.failureCount}${codesTxt} · «${title}»`);
    return { sent: r.successCount, failed: r.failureCount };
  } catch (e) {
    console.warn('⚠️ تعذّر إرسال إشعار:', e.message);
    return { sent: 0, failed: tokens.length, error: e.message };
  }
}

async function cleanupDeadTokens(db, dead) {
  const snap = await db.collection('users').where('fcmTokens', 'array-contains-any', dead.slice(0, 10)).get();
  const jobs = [];
  snap.forEach(d => {
    const v = d.data();
    jobs.push(d.ref.update({
      fcmTokens: (v.fcmTokens || []).filter(t => !dead.includes(t)),
      fcmDevices: (v.fcmDevices || []).filter(x => x && !dead.includes(x.token)),
    }));
  });
  await Promise.all(jobs);
  console.log(`🧹 حُذف ${dead.length} رمز جهاز ميت`);
}

/* ===== واجهات جاهزة تستعملها المسارات ===== */

/** صاحب المطعم — طلب جديد وصله */
async function notifyRestaurant(app, restaurantId, { title, body, data }) {
  const db = app.get('db');
  if (!db || !restaurantId) return;
  try {
    // نجد المالك عبر ownerId على المطعم، أو عبر ownedRestaurantId على المستخدم
    const r = await db.collection('restaurants').doc(String(restaurantId)).get();
    let ownerIds = [];
    if (r.exists && r.data().ownerId) ownerIds.push(r.data().ownerId);
    if (!ownerIds.length) {
      const us = await db.collection('users').where('ownedRestaurantId', '==', String(restaurantId)).get();
      us.forEach(u => ownerIds.push(u.id));
    }
    // تطبيق المطعم وحده — لا تطبيق الزبون على نفس الجوّال
    const tokens = await tokensOf(db, ownerIds, 'merchant');
    // قناة المطعم لا قناة الكابتن — لكلٍّ صوته الذي تدرّب أن يهبّ عليه
    return await push(db, tokens, { title, body, channel: 'partner', data });
  } catch (e) { console.warn('⚠️ إشعار المطعم:', e.message); }
}

/* ============================================================
   ترتيب المناديب: الأقرب للمطعم أولاً، والمشغول آخِراً.

   كان الإشعار يُرسل للجميع دفعةً واحدة، فيتسابقون على الطلب: يصل
   البعيد أولاً فيأخذه، ويصل الطلب متأخراً، ويغضب من كان على بُعد
   مئتَي متر ووجده مأخوذاً.

   والقرب وحده لا يكفي: مندوب على بُعد ٢٠٠ متر ماسكٌ طلبين أبطأ فعلياً
   من فارغٍ على بُعد ٦٠٠. لذلك نستبعد المشغول بطلبين ونضعه في آخر
   الترتيب لا نحرمه — فقد يكون هو الوحيد المتاح.
   ============================================================ */
const R_EARTH = 6371;
const rad = (d) => (d * Math.PI) / 180;
function distKm(aLat, aLng, bLat, bLng) {
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(s));
}
const BUSY_LIMIT = 2;           // من معه طلبان فأكثر يُؤخَّر
const ACTIVE = ['DRIVER_ASSIGNED', 'AT_RESTAURANT', 'PICKED_UP', 'ON_THE_WAY'];

/** كم طلباً نشطاً مع كل مندوب الآن؟ */
async function activeLoadByDriver(db) {
  const load = {};
  try {
    const snap = await db.collection('orders').where('status', 'in', ACTIVE).get();
    snap.forEach(d => {
      const o = d.data();
      const k = (o.driver && typeof o.driver === 'object')
        ? String(o.driver.id || o.driver.phone || '') : String(o.driverId || '');
      if (k) load[k] = (load[k] || 0) + 1;
    });
  } catch (e) { /* بلا فهرس: نكمل بلا أحمال */ }
  return load;
}

/**
 * كل المناديب المعتمدين وغير المجمّدين — طلب جاهز للاستلام.
 * إن مرّرتَ موقع المطعم، رُتِّبوا بالقرب منه.
 */
/** آخر مرّة نُبّه فيها مندوبٌ بأنه فوق سقف الكاش — لئلا يُقصف بكل طلب. */
const _capNoticed = new Map();

async function notifyDrivers(app, { title, body, data, restaurantLat, restaurantLng }) {
  const db = app.get('db');
  if (!db) return;
  try {
    const snap = await db.collection('users').where('userType', '==', 'driver').get();
    const ids = [];
    const overCap = [];
    snap.forEach(d => {
      const u = d.data();
      const st = String(u.status || 'approved');
      // المجمّد والمرفوض لا يُنبَّهان — لا نُغريه بطلب لا يستطيع أخذه
      if (st !== 'approved') return;

      /* ============================================================
         من أنهى ورديته لا يُوقَظ.

         كان الإسكات في التطبيق: يصل الإشعار ثم يقرّر الهاتف أيرنّ أم
         لا. وكان خطأً من وجهين — الأول أن العَلَم المحلي يُطفأ من تلقاء
         نفسه حين يفشل بدء خدمة الموقع والتطبيق في الخلفية، فيصمت مندوبٌ
         على دوامه ويخسر رزقه؛ والثاني أننا نستهلك حصّة إرسال ونوقظ
         جهازاً لنقول له «لا شيء لك».

         القرار هنا أصحّ: السيرفر يعرف المجمَّد والمشغول والأبعد، ويعرف
         الآن من أنهى ورديته. فلا يُرسل أصلاً.

         و`undefined` تعني «نعم» عمداً: كل مندوب مسجَّل قبل اليوم لا
         يحمل الحقل، وافتراض «خارج الدوام» كان سيُسكت الجميع دفعة واحدة.
         الإسكات لا يقع إلا بـ `false` صريحة كتبها المندوب بيده.
         ============================================================ */
      if (u.onShift === false) return;

      /* ============================================================
         سقف الكاش — الحماية المالية الوحيدة الممكنة بلا بناء تطبيق.

         المندوب يحمل نقد الزبائن في جيبه: يجمع من كل طلب ثمن البضاعة
         كاملاً، ويدفع للمحلّ ناقص العمولة، ويبقى معه الفرق حتى يسوّي.
         وبعشرة طلبات في مساء واحد قد يحمل ألفاً ونصفاً من مالك أنت.

         ولم يكن في المنصّة شيء يوقف ذلك: يواصل أخذ الطلبات بلا حدّ،
         ولا تعرف أنت إلا حين تفتح الكشف بنفسك. والخسارة هنا لا تُسترد
         بشكوى — النقد الذي غادر لا يعود.

         والسقف ليس اتهاماً بل حدّ معقول: من بلغ ٨٠٠ ₪ غير مسوّاة
         **لا تصله طلبات جديدة** حتى يسوّي، ويُخطَر بالسبب صريحاً فلا
         يظنّ المنصّة عطلت أو أنك تُقصيه.

         ولماذا هنا لا في مسار القبول؟ لأن المنع عند القبول يعني أن
         يرى الطلب ويسعى إليه ثم يُصدم برفض — إهانة بلا فائدة. أمّا
         هنا فلا يُعرض عليه أصلاً، ويصله بدلاً منه تذكيرٌ بالتسوية.

         ZADNA_CASH_CAP=0 على Render يُعطّله كلياً إن أردت.
         ============================================================ */
      const cap = Number(process.env.ZADNA_CASH_CAP || 800);
      if (cap > 0 && Number(u.cashOnHand || 0) >= cap) {
        overCap.push({ id: d.id, name: u.name || d.id, cash: Number(u.cashOnHand || 0) });
        return;
      }

      ids.push(d.id);
    });

    /* من تجاوز السقف يُخطَر مرّة كل ساعتين — لا مع كل طلب.
     * التذكير المتكرّر مع كل طلب يمرّ عقوبةٌ لا تنبيه. */
    if (overCap.length) {
      const now = Date.now();
      for (const o of overCap) {
        if (now - (_capNoticed.get(o.id) || 0) < 2 * 3600 * 1000) continue;
        _capNoticed.set(o.id, now);
        const tk = await tokensOf(db, [o.id], 'captain');
        if (tk.length) {
          await push(db, tk, {
            title: '💰 سوِّ حسابك لتستقبل طلبات',
            body: `معك ${Math.round(o.cash)} ₪ غير مسوّاة. سلّمها للإدارة وتعود الطلبات فوراً.`,
            channel: 'update', data: { type: 'cash_cap' },
          });
        }
      }
      console.log(`💰 فوق سقف الكاش (${overCap.length}): ` +
        overCap.map(o => `${o.name}:${Math.round(o.cash)}₪`).join(' · '));
    }

    if (!ids.length) return;

    /* ============================================================
       الترتيب زينةٌ، والإرسال فريضة — فلا يُسقط الأولُ الثاني.

       كان هذا كلّه داخل `try` واحد يلفّ الإرسال معه. ومعناه أنّ أي
       تعثّر في **ترتيب** المناديب — وهو تحسين لا أكثر — يقفز إلى
       `catch` الخارجي فلا يصل الطلبُ مندوباً واحداً.

       وليس افتراضاً: سجلّك يحمل `FAILED_PRECONDITION: The query
       requires an index` من قراءة الطلبات، وهي بعينها القراءة التي
       تناديها `activeLoadByDriver` هنا لتعرف المشغول. فالفهرس الناقص
       — وهو أمرٌ تجميلي — كان قادراً على إسكات إنذار الرزق كلّه.

       القاعدة: كل ما هو تحسين يُعزَل في `try` خاصّ به. إن فشل الترتيب
       أُرسل للجميع بالتساوي وكُتب سببه — ولا يُحرم أحدٌ من طلبه.
       ============================================================ */
    const haveGeo = Number.isFinite(Number(restaurantLat)) && Number.isFinite(Number(restaurantLng));
    if (haveGeo) {
      try {
        const locs = app.get('lastDriverLocation') || new Map();
        const load = await activeLoadByDriver(db);
        const scored = ids.map(id => {
          const l = locs.get(String(id));
          // من لا نعرف موقعه يُوضع بعد من نعرفهم لا يُحرَم
          const km = l ? distKm(Number(restaurantLat), Number(restaurantLng), l.lat, l.lng) : 999;
          const busy = (load[String(id)] || 0) >= BUSY_LIMIT ? 1 : 0;
          return { id, km, busy };
        });
        scored.sort((a, b) => (a.busy - b.busy) || (a.km - b.km));
        ids.length = 0;
        scored.forEach(s => ids.push(s.id));
        const near = scored.filter(s => s.km < 900).slice(0, 3)
          .map(s => `${s.id.slice(0, 6)}:${s.km.toFixed(1)}كم${s.busy ? '(مشغول)' : ''}`);
        if (near.length) console.log('🛵 أقرب المناديب:', near.join(' · '));
      } catch (e) {
        console.warn('⚠️ تعذّر ترتيب المناديب — يُرسل للجميع بالتساوي:', e.message);
      }
    }

    const tokens = await tokensOf(db, ids, 'captain');
    // من نُبّه وكم جهازاً — يجيب «هل أُرسل أصلاً؟» بلا تخمين
    console.log(`🛵 مناديب مؤهّلون: ${ids.length} · أجهزة captain: ${tokens.length}`);
    return await push(db, tokens, { title, body, channel: 'alert', data });
  } catch (e) { console.warn('⚠️ إشعار المناديب:', e.message); }
}

/** الزبون — بهاتفه المسجَّل على الطلب */
async function notifyCustomer(app, customerPhone, { title, body, channel = 'update', data }) {
  const db = app.get('db');
  if (!db || !customerPhone) return;
  try {
    /* الرقم يُطبَّع قبل البحث — نفس عائلة عطل «الطلبات المختفية».
     *
     * كانت المطابقة نصية حرفية: طلبٌ حُفظ رقمه بصيغة +970 أو بشرطات
     * لا يُطابق مستند المستخدم (المحفوظ بصيغة 05xxxxxxxx)، فيرجع
     * البحث فارغاً و**لا يُرسل الإشعار أصلاً** — بلا خطأ ولا سجل.
     * الزبون لا يعرف أن مندوبه على الباب، ونحن لا نعرف أنه لم يُبلَّغ. */
    const digits = String(customerPhone).replace(/[\s\-()]/g, '');
    const norm =
      /^\+?9(70|72)\d{9}$/.test(digits) ? '0' + digits.replace(/^\+?9(70|72)/, '')
      : /^009(70|72)\d{9}$/.test(digits) ? '0' + digits.replace(/^009(70|72)/, '')
      : digits;
    let snap = await db.collection('users').where('phone', '==', norm).limit(1).get();
    if (snap.empty && norm !== String(customerPhone)) {
      snap = await db.collection('users').where('phone', '==', String(customerPhone)).limit(1).get();
    }
    if (snap.empty) {
      console.warn('⚠️ إشعار الزبون: لا حساب بهذا الرقم —', norm);
      return;
    }
    // أغنية زادنا تذهب لتطبيق الزبون وحده — لا للوحة تحكم مطعمه
    const tokens = await tokensOf(db, [snap.docs[0].id], 'customer');
    return await push(db, tokens, { title, body, channel, data });
  } catch (e) { console.warn('⚠️ إشعار الزبون:', e.message); }
}

/* ============================================================
   إشعار رسالة الشات — للطرف الآخر وحده.

   لم يكن للشات إشعار إطلاقاً: تُحفظ الرسالة ويُبثّ السوكت، والسوكت
   لا يعمل إلا والتطبيق مفتوح على الشاشة. فمندوبٌ يسأل «وين بالضبط؟»
   يقف تحت العمارة ينتظر جواباً لن يصل حتى يفتح الزبون التطبيق صدفة.

   ومن يُرسل إليه: طرفا الطلب — الزبون والمندوب — عدا الكاتب نفسه.
   ولكلٍّ تطبيقه: الزبون على `customer` والمندوب على `captain`، وإلا
   وصل إشعار المندوب إلى تطبيق الزبون على نفس الجهاز (حالتك أنت،
   إذ تحمل التطبيقات الثلاثة).

   والمطعم لا يدخل هنا: شاته أُزيل، والتواصل معه عبر الإدارة.
   ============================================================ */
async function notifyChatPeer(app, { orderId, senderId, senderName, senderRole, text }) {
  const db = app.get('db');
  if (!db || !orderId || orderId === 'global_zadna_chat') return;
  try {
    const oDoc = await db.collection('orders').doc(String(orderId)).get();
    if (!oDoc.exists) return;
    const o = oDoc.data() || {};

    const sp = app.get('samePhone') || ((a, b) => String(a) === String(b));
    const me = String(senderId || '');

    /* نصّ مختصر: الإشعار ليس مكان قراءة الرسالة كاملة، وقد تكون
     * طويلة أو فيها ما لا يُعرض على شاشة مقفلة أمام الناس. */
    const preview = String(text || '').slice(0, 80);
    const title = `💬 ${senderName || 'رسالة جديدة'}`;
    const data  = { orderId: String(orderId), type: 'chat' };

    // ===== المندوب =====
    const drv = (o.driver && typeof o.driver === 'object') ? o.driver : null;
    const drvId = String((drv && drv.id) || o.driverId || '');
    if (drvId && drvId !== me && senderRole !== 'driver') {
      const tk = await tokensOf(db, [drvId], 'captain');
      if (tk.length) await push(db, tk, { title, body: preview, channel: 'chat', data });
    }

    // ===== الزبون =====
    if (senderRole !== 'customer') {
      const cid = String(o.customerId || '');
      let ids = [];
      if (cid && cid !== me) {
        ids = [cid];
      } else if (!cid && o.customerPhone) {
        /* الطلبات القديمة بلا `customerId` — نبحث بالرقم مطبَّعاً.
         * المطابقة الحرفية هنا كانت عائلة عطلٍ كاملة: رقمٌ محفوظ
         * بصيغة +970 لا يطابق مستنداً محفوظاً بـ05، فلا يُرسل شيء
         * ولا يُسجَّل خطأ — لا الزبون يعلم ولا نحن. */
        const digits = String(o.customerPhone).replace(/[\s\-()]/g, '');
        const norm =
          /^\+?9(70|72)\d{9}$/.test(digits)  ? '0' + digits.replace(/^\+?9(70|72)/, '')
          : /^009(70|72)\d{9}$/.test(digits) ? '0' + digits.replace(/^009(70|72)/, '')
          : digits;
        let snap = await db.collection('users').where('phone', '==', norm).limit(1).get();
        if (snap.empty && norm !== String(o.customerPhone)) {
          snap = await db.collection('users').where('phone', '==', String(o.customerPhone)).limit(1).get();
        }
        if (!snap.empty && snap.docs[0].id !== me) ids = [snap.docs[0].id];
      }
      if (ids.length) {
        const tk = await tokensOf(db, ids, 'customer');
        if (tk.length) await push(db, tk, { title, body: preview, channel: 'chat', data });
      }
    }
  } catch (e) {
    console.warn('⚠️ إشعار الشات:', e.message);
  }
}

/* ============================================================
   إشعار الإدارة — لأن السوكت لا يعمل واللوحة مغلقة.

   كان طلب الانضمام يُبثّ على السوكت وحده (`new_partner_request`).
   وذلك يصل **فقط** إن كانت لوحتك مفتوحة على مكتبك في تلك اللحظة.
   فشريكٌ يسجّل ليلاً أو وأنت في الطريق لا يصلك خبره إطلاقاً، ويبقى
   ينتظر اعتماداً لا يعلم أحدٌ أنه مطلوب — وهو ما وقع فعلاً.

   الآن يصلك على جوالك مثل أي إشعار. ويُرسَل لكل حساب نوعه `manager`،
   فتستطيع أن تُشرك معك من يتابع الاعتمادات دون أن يملك لوحتك.

   وبقناة «الشريك» لا قناة الكابتن: هذا خبرٌ يُقرأ لا إنذارٌ يوقظ.
   ============================================================ */
async function notifyManagers(app, { title, body, data = {} }) {
  const db = app.get('db');
  if (!db) return;
  try {
    const snap = await db.collection('users').where('userType', '==', 'manager').get();
    const ids = [];
    snap.forEach(d => ids.push(d.id));
    if (!ids.length) {
      console.warn('📭 لا حساب إدارة (userType=manager) — لن يصل إشعار طلب الانضمام لأي جوال');
      return;
    }
    // بلا تقييد بتطبيق: المدير قد يستعمل أيّاً من الثلاثة
    const tokens = await tokensOf(db, ids);
    if (!tokens.length) {
      console.warn('📭 حساب الإدارة موجود بلا رمز جهاز — سجّل دخولاً من التطبيق مرّة');
      return;
    }
    await push(db, tokens, { title, body, channel: 'partner', data });
  } catch (e) {
    console.warn('⚠️ إشعار الإدارة:', e.message);
  }
}

module.exports = router;
module.exports.notifyManagers = notifyManagers;
module.exports.notifyRestaurant = notifyRestaurant;
module.exports.notifyDrivers = notifyDrivers;
module.exports.notifyCustomer = notifyCustomer;
module.exports.notifyChatPeer = notifyChatPeer;
