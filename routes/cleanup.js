const express = require('express');
const router = express.Router();

const getDb = (req) => req.app.get('db');
const adminOnly = (req, res, next) => {
  const fn = req.app.get('requireAdmin');
  return fn ? fn(req, res, next) : next();
};
const { invalidate } = require('../utils/cache');

/* ============================================================
   تنظيف البيانات التجريبية — استعمال لمرة واحدة قبل الإطلاق.

   مبدأ هذا الملف: لا يُصدَّق ما يرسله المتصفح. اللوحة ترسل أسماء
   فئات فقط؛ السيرفر هو من يقرر ما الذي يقع في كل فئة. فلو أُصيبت
   اللوحة أو أُرسل طلب ملفّق، لا يستطيع تحديد ضحية بعينها.
   ============================================================ */

/* الطوق الأخير. هذه لا تُحذف مهما كان الطلب، ومهما كانت الفئة.
   الحماية بالمعرّف وبالهاتف معاً: لو تغيّر أحدهما بقي الآخر يحمي. */
const PROTECTED_RESTAURANTS = new Set(['rest_005', 'mart_001']);
const PROTECTED_PHONES = new Set(['0593654276', '0594381596']);
const PROTECTED_NAMES = /^(ayman|أيمن|عميد|yazan|يزن)/i;

const isProtectedPartner = (p) => {
  const phone = String(p.phone || '').replace(/\D/g, '');
  const norm = phone.startsWith('972') ? '0' + phone.slice(3) : phone;
  if (PROTECTED_PHONES.has(norm)) return true;
  return PROTECTED_NAMES.test(String(p.name || '').trim());
};

/* بصمات البيانات التجريبية: بادئات المعرّفات التي ولّدناها أثناء الفحص،
   وأسماء الزبائن الوهميين. الاسم الفارغ ليس دليلاً كافياً — قد يكون
   زبوناً حقيقياً لم يُسجّل اسمه — فلا نضعه هنا. */
const TEST_ID_RE = /^(E2E|M_|MART_|SEC_|LOC_TEST|VERIFY|TEST_|ORD_FLOW|ORD_CLAUDE|DBG|TMP)/i;
const TEST_NAME_RE = /(e2e|فحص|اختبار|تجريب|تجربة|\btest\b|claude|كلود)/i;

/* اسم الزبون يُكتب في حقل «customer» من التطبيق، بينما طلبات قديمة
   تحمله في «customerName». قراءة أحدهما فقط تُفوّت نصف الطلبات. */
const custName = (o) => String(o.customer || o.customerName || '');

const isTestOrder = (o) =>
  TEST_ID_RE.test(String(o.id || '')) || TEST_NAME_RE.test(custName(o));

async function classify(db) {
  const [ordSnap, parSnap, restSnap] = await Promise.all([
    db.collection('orders').get(),
    db.collection('partners').get(),
    db.collection('restaurants').get(),
  ]);

  const orders = ordSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const partners = parSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const restaurants = restSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const test = orders.filter(isTestOrder);
  const label = o => `${o.id} · ${custName(o) || 'بلا اسم'} · ${o.status}`;

  return {
    /* الملغاة والمعلّقة: لا أثر مالي لها، حذفها آمن. */
    testOrdersSafe: {
      title: 'طلبات تجريبية ملغاة/معلّقة',
      note: 'لا أثر مالي لها — حذفها آمن',
      items: test.filter(o => o.status !== 'DELIVERED').map(label),
      ids: test.filter(o => o.status !== 'DELIVERED').map(o => o.id),
      collection: 'orders',
    },
    /* المسلَّمة: هذه سجلّ مالي. حذفها يمحو دَيناً قائماً على مندوب. */
    testOrdersDelivered: {
      title: '⚠️ طلبات تجريبية مُسلَّمة',
      note: 'سجلّ مالي — حذفها يمحو ديوناً قائمة ولا رجعة فيها',
      danger: true,
      items: test.filter(o => o.status === 'DELIVERED')
                 .map(o => `${label(o)} · ${Number(o.totalAmount || 0)}₪`),
      ids: test.filter(o => o.status === 'DELIVERED').map(o => o.id),
      collection: 'orders',
    },
    testPartners: {
      title: 'حسابات شركاء تجريبية',
      note: 'حسابك وأيمن وعميد محميون ولا يظهرون هنا',
      items: partners.filter(p => !isProtectedPartner(p) && TEST_NAME_RE.test(p.name || ''))
                     .map(p => `${p.name} · ${p.phone || '—'} · ${p.type || p.partnerType || ''}`),
      ids: partners.filter(p => !isProtectedPartner(p) && TEST_NAME_RE.test(p.name || '')).map(p => p.id),
      collection: 'partners',
    },
    /* مطاعم البذرة: حقيقية بأسمائها لكن بلا مالك ولا منيو — واجهة فارغة
       تُحبط الزبون إن ضغطها. ليست بيانات تجريبية بالمعنى الضار، فتُترك
       الفئة غير مؤشَّرة افتراضياً ويقرّر المدير. */
    seedRestaurants: (() => {
      /* المعيار: **لا مالك**. لا عدد الأصناف.
       *
       * كان الشرط يضيف `menu.length <= 1`، فنجا كل مطعم بذرة وُضع له
       * صنفان — بقي `Veranda Cafe` في القائمة بينما زميله ذو الصنف
       * الواحد يُحذف. وحدُّ الصنف رقمٌ اعتباطي لا يقول شيئاً عن حقيقة
       * المطعم.
       *
       * وغياب `ownerId` علامةٌ قاطعة: لا حساب يملك هذا المطعم، فلا أحد
       * في الدنيا يستطيع الدخول إليه ولا استقبال طلب منه ولا تحديث
       * منيوه. واجهةٌ لا يقف خلفها أحد.
       *
       * والعكس محفوظ: من له مالك لا يُمسّ مهما كان منيوه فارغاً — فقد
       * يكون شريكاً سجّل للتوّ ولم يُدخل أصنافه بعد. */
      const seeds = restaurants.filter(r =>
        !PROTECTED_RESTAURANTS.has(r.id) && !r.ownerId
      );
      return {
        title: 'مطاعم بلا مالك (لا أحد يديرها)',
        note: 'لا حساب يملكها فلا تستقبل طلباً ولا يُحدَّث منيوها — واجهة فارغة تُحبط من يضغطها',
        items: seeds.map(r =>
          `${r.name} · ${(r.menu || []).length} صنف · ${r.status || '—'}`),
        ids: seeds.map(r => r.id),
        collection: 'restaurants',
      };
    })(),
  };
}

/* GET /api/cleanup/preview — يعرض ولا يمسّ شيئاً */
router.get('/cleanup/preview', adminOnly, async (req, res) => {
  try {
    const cats = await classify(getDb(req));
    const out = {};
    for (const [k, v] of Object.entries(cats)) {
      out[k] = { title: v.title, note: v.note, danger: !!v.danger, count: v.ids.length, items: v.items };
    }
    res.json({ success: true, categories: out, protectedNote: 'محميّ دائماً: مطعم 1948، زادنا مارت، حسابك، أيمن، عميد' });
  } catch (e) {
    res.status(500).json({ success: false, error: 'تعذّر الفحص: ' + e.message });
  }
});

/* POST /api/cleanup/execute — يحذف فعلياً. يتطلب كلمة تأكيد حرفية. */
router.post('/cleanup/execute', adminOnly, async (req, res) => {
  const { categories, confirm } = req.body || {};
  if (confirm !== 'احذف نهائياً') {
    return res.status(400).json({ success: false, error: 'كلمة التأكيد غير مطابقة' });
  }
  if (!Array.isArray(categories) || categories.length === 0) {
    return res.status(400).json({ success: false, error: 'لم تُحدَّد أي فئة' });
  }

  try {
    const db = getDb(req);
    const cats = await classify(db);
    const report = {};

    for (const key of categories) {
      const cat = cats[key];
      if (!cat) { report[key] = { error: 'فئة غير معروفة' }; continue; }

      let done = 0, blocked = [];
      for (const id of cat.ids) {
        /* الطوق يُفحص هنا ثانيةً، عند الحذف نفسه، لا عند التصنيف فقط. */
        if (cat.collection === 'restaurants' && PROTECTED_RESTAURANTS.has(id)) { blocked.push(id); continue; }
        if (cat.collection === 'partners') {
          const snap = await db.collection('partners').doc(id).get();
          if (snap.exists && isProtectedPartner(snap.data())) { blocked.push(id); continue; }
        }
        await db.collection(cat.collection).doc(id).delete();
        done++;
      }
      report[key] = { حُذف: done, مُنع: blocked.length };
    }

    ['restaurants:raw', 'partners:all', 'orders:all'].forEach(k => { try { invalidate(k); } catch (e) {} });
    res.json({ success: true, report });
  } catch (e) {
    res.status(500).json({ success: false, error: 'تعذّر التنفيذ: ' + e.message });
  }
});

module.exports = router;
