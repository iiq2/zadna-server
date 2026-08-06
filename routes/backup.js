const express = require('express');
const router = express.Router();

/* ============================================================
   النسخة الاحتياطية.

   Firestore لا تضيع منها البيانات من تلقاء نفسها — جوجل تحفظها
   على أكثر من مركز. الخطر الحقيقي مختلف تماماً: **أن تمحوها أنت.**

   وأنت على وشك تشغيل «تنظيف ما قبل الإطلاق»، وهو يحذف حذفاً نهائياً
   لا رجعة فيه. وشرطٌ في العمل الجادّ ألّا يُشغَّل حذفٌ جماعي قبل أن
   تكون النسخة في يدك — لا لأن الشيفرة خاطئة، بل لأن الإنسان يضغط
   أحياناً ما لم يقصد، ولا يُكتشف إلا بعد أيام.

   والملف يُنزَّل على جهازك أنت. لا يُحفظ على السيرفر: قرص Render
   يُمحى مع كل نشر، فنسخة عليه وهمٌ لا حماية.

   ⚠️ الملف يحوي أرقام زبائنك وعناوينهم. احفظه كما تحفظ دفتر حساباتك.
   ============================================================ */

const getDb = (req) => req.app.get('db');
const adminOnly = (req, res, next) => {
  const fn = req.app.get('requireAdmin');
  return fn ? fn(req, res, next) : next();
};

/* المجموعات التي تستحق الحفظ. استثنينا `chats` عمداً: رسائل المحادثات
   تكبر بلا حدّ وقيمتها بعد التسليم قليلة، وإدخالها يجعل كل نسخة أثقل
   وأبطأ حتى تُهمَل. ما يستحق الحفظ هو ما لا يُعوَّض: الحسابات
   والشركاء والطلبات والمال. */
/* ============================================================
   `settlements` — أخطر نقص وُجد في جرد ٥ آب.

   التعليق أعلاه يقول «ما يستحق الحفظ هو ما لا يُعوَّض: الحسابات
   والشركاء والطلبات **والمال**» — ثم لم يكن المال فيها.

   ومجموعة `settlements` هي سجلّ **من دفع لك ومن لم يدفع**: كل تسوية
   حصّلتَها من مندوب. الطلبات وحدها تقول كم عليه، ولا تقول كم سدّد.
   فلو ضاعت القاعدة — أو مُسحت بالخطأ، أو انتهت التجربة المجانية —
   بقيت لديك الديون كاملةً بلا سجلّ سدادٍ واحد. تعود تطالب مندوباً
   دفع لك أمس، ولا وثيقة لك ولا له.

   وهو أرخص إصلاح في المشروع كلّه: كلمة واحدة في مصفوفة.
   ============================================================ */
const COLLECTIONS = [
  'users', 'restaurants', 'orders', 'zones',
  'partner_codes', 'mart_products', 'reports', 'wallets',
  'settlements',   // سجلّ التسويات — لا يُعوَّض إن ضاع
  /* `ledger` — لنفس السبب حرفاً بحرف.
   *
   * دفترٌ لا يُنسخ ليس دفتراً: قيمته كلّها في أنه يبقى حين يُنكَر
   * شيء. وهو أثقل من settlements لأن كل طلبٍ يخلّف ٣–٤ أسطر — لكن
   * السطر نصفُ كيلوبايت، وألف طلبٍ شهرياً تعني نحو ٢ ميغا في السنة.
   * ثمنٌ زهيد مقابل أن تملك جواباً حين يُسألك «متى دفعتُ؟». */
  'ledger',
];

async function dumpCollection(db, name, limit = 5000) {
  try {
    const snap = await db.collection(name).limit(limit).get();
    const out = [];
    snap.forEach(d => out.push({ id: d.id, ...d.data() }));
    return out;
  } catch (e) {
    // مجموعة غير موجودة أو تعذّرت قراءتها لا تُسقط النسخة كلّها
    return { __error: e.message };
  }
}

/* كتالوجات الماركتات مجموعات فرعية — لا تظهر في المسح العلوي.
   ونسيانها يعني نسخة تبدو كاملة وتنقصها بضاعة شركائك كلّها. */
async function dumpMarketCatalogs(db, restaurants) {
  const out = {};
  const markets = (restaurants || []).filter(r =>
    r && (String(r.partnerType || '') === 'market' || String(r.id) === 'mart_001'));
  for (const m of markets) {
    try {
      const snap = await db.collection('restaurants').doc(String(m.id))
        .collection('products').get();
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      if (list.length) out[String(m.id)] = list;
    } catch (e) { /* محلّ بلا كتالوج بعد */ }
  }
  return out;
}

// GET /api/backup — نسخة كاملة تُنزَّل ملفاً
router.get('/', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(500).json({ success: false, error: 'لا قاعدة بيانات' });

    const started = Date.now();
    const data = {};
    for (const name of COLLECTIONS) {
      data[name] = await dumpCollection(db, name);
    }
    data.marketCatalogs = await dumpMarketCatalogs(db, data.restaurants);

    const counts = {};
    Object.keys(data).forEach(k => {
      counts[k] = Array.isArray(data[k]) ? data[k].length
        : (data[k] && !data[k].__error ? Object.keys(data[k]).length : 0);
    });

    const payload = {
      _meta: {
        منصة: 'زادنا',
        وقت_النسخة: new Date().toISOString(),
        بتوقيت_فلسطين: new Date().toLocaleString('ar-EG', { timeZone: 'Asia/Hebron' }),
        عدد_المستندات: counts,
        استغرقت_ثانية: Math.round((Date.now() - started) / 100) / 10,
        تنبيه: 'يحوي هذا الملف أرقام الزبائن وعناوينهم — احفظه في مكان آمن ولا تشاركه',
      },
      data,
    };

    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="zadna-backup-${stamp}.json"`);
    // لا يُخزَّن في أي وسيط: نسخة قديمة تُعاد من الكاش أخطر من لا نسخة
    res.setHeader('Cache-Control', 'no-store');
    console.log(`💾 نسخة احتياطية: ${JSON.stringify(counts)}`);
    res.send(JSON.stringify(payload, null, 1));
  } catch (e) {
    console.error('❌ النسخة الاحتياطية:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/* GET /api/backup/summary — جرد سريع بلا تنزيل

   تفتحه قبل التنظيف لترى ماذا لديك، وبعده لترى ماذا بقي. الفرق بين
   الرقمين هو ما حُذف فعلاً — لا ما ظننتَ أنّك حذفته. */
router.get('/summary', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(500).json({ success: false, error: 'لا قاعدة بيانات' });
    const counts = {};
    for (const name of COLLECTIONS) {
      try {
        const snap = await db.collection(name).count().get();
        counts[name] = snap.data().count;
      } catch (e) {
        // count() غير متاح في نسخ قديمة من المكتبة — نرجع للعدّ اليدوي
        const snap = await db.collection(name).limit(5000).get();
        counts[name] = snap.size;
      }
    }
    res.json({ success: true, counts, at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
module.exports.COLLECTIONS = COLLECTIONS;
