const express = require('express');
const router = express.Router();

const getDb = (req) => req.app.get('db');
/** تسجيل تسوية يخفض دين مندوب — للإدارة وحدها. كان مفتوحاً للإنترنت. */
const adminOnly = (req, res, next) => {
  const fn = req.app.get('requireAdmin');
  return fn ? fn(req, res, next) : next();
};
const needsIdentity = (req, res, next) => {
  const fn = req.app.get('requireIdentity');
  return fn ? fn(req, res, next) : next();
};

/* أرقامك المالية كانت مقروءة لأي زائر: إيراداتك، وديون كل مندوب،
   ومستحقات كل مطعم. الآن: المندوب يرى محفظته هو، وصاحب المطعم يرى
   مطعمه هو، والصورة الكاملة للإدارة وحدها.

   نُبقي الرد نفسه غير مقيَّد بعد اجتياز الفحص كي لا تتغيّر التطبيقات. */
async function selfOrAdmin(req, res, next, matches) {
  if (req.isAdmin) return next();
  const loadUser = req.app.get('loadUser');
  const me = loadUser ? await loadUser(req.user && req.user.userId) : null;
  if (me && matches(me, String(req.params.id))) return next();
  return res.status(403).json({ success: false, error: 'لا تملك صلاحية الاطّلاع على هذه الأرقام' });
}

// ===== نموذج التحصيل =====
// المندوب يدفع للمطعم كاش وقت الاستلام (ثمن الوجبة ناقص عمولة زادنا)
// المندوب يحصّل من الزبون (الوجبة + التوصيل)
// المندوب يسدّد لزادنا يومياً: عمولة المطعم + عمولة التوصيل
/* النِّسَب والدوال انتقلت إلى utils/money.js — المصدر الوحيد الذي تقرأ
 * منه الطلباتُ والتطبيقاتُ الثلاثة واللوحة. كانت مكرَّرة هنا حرفياً،
 * وأيّ تعديل على أحد النسختين كان يمرّ بلا أن يلاحظه أحد. */
const money = require('../utils/money');
const {
  RESTAURANT_COMMISSION,
  DRIVER_COMMISSION,
  DEFAULT_DELIVERY_FEE,
  itemsTotal: orderTotal,
  deliveryFeeOf: feeOf,
} = money;
const orderDate = (o) => (o.createdAt && o.createdAt._seconds) ? new Date(o.createdAt._seconds * 1000) : null;
const driverKeyOf = (o) => {
  if (o.driver && typeof o.driver === 'object') return String(o.driver.id || o.driver.phone || o.driver.name || '');
  if (o.driverId) return String(o.driverId);
  return '';
};
const driverNameOf = (o) => (o.driver && typeof o.driver === 'object' && o.driver.name) || driverKeyOf(o);
const r2 = (n) => Math.round(n * 100) / 100;

function periodStart(period) {
  const d = new Date();
  if (period === 'today') { d.setHours(0,0,0,0); return d; }
  if (period === 'week')  { d.setDate(d.getDate()-7); return d; }
  if (period === 'month') { d.setDate(d.getDate()-30); return d; }
  return null;
}

// كاش قصير + حد أقصى — يمنع استنزاف حصة Firestore
let _cache = { at: 0, data: null };
const CACHE_MS = 60000;      // دقيقة واحدة
const MAX_ORDERS = 2000;     // سقف القراءة

async function fetchDelivered(db) {
  if (_cache.data && (Date.now() - _cache.at) < CACHE_MS) return _cache.data;
  // orderBy ضروري مع limit: بدونه يُرجع Firestore 2000 مستنداً بترتيب
  // المعرّف لا بترتيب الزمن، فبمجرد تجاوز الطلبات المسلَّمة هذا السقف
  // تُسقَط طلبات عشوائية من كل الحسابات — إيرادات المنصة وديون المناديب
  // وأرباح المطاعم — بلا أي تحذير. والأحدث أولى بالبقاء.
  let snap;
  try {
    snap = await db.collection('orders')
      .where('status', '==', 'DELIVERED')
      .orderBy('createdAt', 'desc')
      .limit(MAX_ORDERS)
      .get();
  } catch (e) {
    // يحتاج فهرساً مركباً في Firestore؛ إن لم يكن جاهزاً لا نُسقط الخدمة
    console.warn('⚠️ تعذّر ترتيب الطلبات (فهرس ناقص) — القراءة بلا ترتيب:', e.message);
    snap = await db.collection('orders').where('status', '==', 'DELIVERED').limit(MAX_ORDERS).get();
  }
  const list = []; snap.forEach(d => list.push({ _id: d.id, ...d.data() }));
  if (list.length >= MAX_ORDERS) {
    console.warn(`⚠️ بلغت الطلبات المسلَّمة سقف ${MAX_ORDERS} — الأرقام المالية صارت جزئية. ارفع MAX_ORDERS أو انقل الحساب إلى تجميع دوري.`);
  }
  _cache = { at: Date.now(), data: list };
  return list;
}

/* مستحقات زادنا على طلب واحد — بأسماء كشف الحساب.
 *
 * الأرقام تأتي من `breakdown` في utils/money.js حرفياً، وهذه الدالة
 * تعيد تسميتها فقط. الطلب الذي حُفظ فيه `money` وقت الإنشاء يُقرأ منه
 * كما هو: طلبٌ سُلّم بنسبة ١٠٪ يبقى محاسَباً بها حتى لو رُفعت النسبة
 * اليوم — وإلا اختلفت التسوية عن الرقم الذي رآه المندوب يوم التسليم. */
function orderBreakdown(o) {
  const m = o.money || money.breakdown(o);
  return {
    total: m.itemsTotal,
    fee: m.deliveryFee,
    paidToRestaurant: m.payToRestaurant,       // ما يدفعه المندوب للمطعم
    collectedFromCustomer: m.cashToCollect,    // ما يحصّله من الزبون
    restCommission: m.restaurantCommission,
    drvCommission: m.driverCommission,
    owedToZadna: m.zadnaCommission,
    driverNet: m.driverNet
  };
}

/**
 * أفضل مندوب اليوم = صاحب أكثر توصيلات منذ منتصف الليل.
 * الجائزة عرض اسمه فقط — لا أثر مالي.
 */
function topDriverToday(all, todayStart) {
  const counts = {};
  all.forEach(o => {
    const d = orderDate(o);
    if (!d || d < todayStart) return;
    const k = driverKeyOf(o);
    if (k) counts[k] = (counts[k] || 0) + 1;
  });
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || null;
}

// جائزة أفضل مندوب = عرض اسمه فقط، بلا أي إعفاء مالي.
//
// كان هنا TOP_DRIVER_WAIVER يخصم جزءاً من العمولة. أُلغي بقرار الإدارة:
// الجائزة تقدير معنوي لا خصم، وإبقاء آلية معطّلة يفتح باب اختلاف بين ما
// يعرضه التطبيق وما يحسبه السيرفر — وهو ما حدث فعلاً حين أعفى التطبيق
// المندوب بالكامل بينما لم يعفه السيرفر إطلاقاً.

/** ما يستحقه زادنا من طلب واحد. */
function owedFor(b) {
  return r2(b.restCommission + b.drvCommission);
}

/** ما يبقى للمندوب من أجرة التوصيل بعد العمولة. */
function driverNetFor(b) {
  return r2(b.fee - b.drvCommission);
}

async function settlementsOf(db, driverId) {
  const snap = await db.collection('settlements').where('driverId','==',String(driverId)).get();
  let sum = 0; const items = [];
  snap.forEach(d => { const s = d.data(); sum += Number(s.amount)||0; items.push({ id: d.id, ...s }); });
  items.sort((a,b) => ((b.createdAt&&b.createdAt._seconds)||0) - ((a.createdAt&&a.createdAt._seconds)||0));
  return { sum: r2(sum), items };
}

// GET /api/wallet/driver/:id — كشف حساب المندوب (كم عليه لزادنا)
router.get('/wallet/driver/:id', needsIdentity,
  (req, res, next) => selfOrAdmin(req, res, next,
    (me, id) => String(me.id) === id || String(me.phone || '') === id),
  async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success:false, error:'Database not connected' });
    const id = String(req.params.id);
    const from = periodStart(req.query.period || 'all');
    const all = await fetchDelivered(db);
    const mine = all.filter(o => driverKeyOf(o) === id);
    const inPeriod = from ? mine.filter(o => { const d = orderDate(o); return d && d >= from; }) : mine;

    // أفضل مندوب اليوم — للعرض فقط
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const topId = topDriverToday(all, todayStart);
    const isTop = topId === id;
    const isToday = (o) => { const d = orderDate(o); return d && d >= todayStart; };

    let collected=0, paidRest=0, owed=0, net=0;
    inPeriod.forEach(o => {
      const b = orderBreakdown(o);
      collected += b.collectedFromCustomer; paidRest += b.paidToRestaurant;
      owed += owedFor(b);
      net  += driverNetFor(b);
      
    });

    // الإجمالي التاريخي مقابل ما سدّده.
    let owedAll = 0;
    mine.forEach(o => {
      const b = orderBreakdown(o);
      owedAll += owedFor(b);
    });
    const { sum: paid, items: settlements } = await settlementsOf(db, id);

    res.json({
      success: true, ownerType: 'driver', ownerId: id,
      period: req.query.period || 'all',
      deliveries: inPeriod.length,
      collectedFromCustomers: r2(collected),
      paidToRestaurants: r2(paidRest),
      owedToZadna: r2(owed),
      driverEarnings: r2(net),
      isTopDriverToday: isTop,
      waiverRate: 0,   // لا إعفاء — الجائزة عرض الاسم
      lifetimeOwed: r2(owedAll),
      totalSettled: paid,
      // لا ينزل تحت الصفر: تسديد زائد كان يجعل الدين سالباً، فيُخصم
      // من ديون بقية المناديب في المجموع ويخفي مستحقات حقيقية.
      balanceDue: r2(Math.max(0, owedAll - paid)),
      overpaid: r2(Math.max(0, paid - owedAll)),
      settlements: settlements.slice(0, 20)
    });
  } catch (e) { res.status(500).json({ success:false, error:e.message }); }
});

// GET /api/wallet/restaurant/:id — كشف المطعم (معلوماتي: المندوب يدفع مباشرة)
router.get('/wallet/restaurant/:id', needsIdentity,
  (req, res, next) => selfOrAdmin(req, res, next,
    (me, id) => String(me.ownedRestaurantId || '') === id),
  async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success:false, error:'Database not connected' });
    const id = String(req.params.id);
    const from = periodStart(req.query.period || 'all');
    const all = await fetchDelivered(db);
    const mine = all.filter(o => String(o.restaurantId) === id);
    const inPeriod = from ? mine.filter(o => { const d = orderDate(o); return d && d >= from; }) : mine;
    let gross=0, comm=0, received=0;
    inPeriod.forEach(o => { const b = orderBreakdown(o); gross += b.total; comm += b.restCommission; received += b.paidToRestaurant; });
    res.json({
      success:true, ownerType:'restaurant', ownerId:id, period:req.query.period||'all',
      ordersCount: inPeriod.length, gross: r2(gross),
      commissionRate: RESTAURANT_COMMISSION, zadnaCommission: r2(comm),
      receivedCash: r2(received),
      note: 'المندوب يدفع للمطعم كاش وقت الاستلام — لا مستحقات معلّقة'
    });
  } catch (e) { res.status(500).json({ success:false, error:e.message }); }
});

// GET /api/wallet/summary — ملخص المدير
router.get('/wallet/summary', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success:false, error:'Database not connected' });
    const all = await fetchDelivered(db);
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const topDriverId = topDriverToday(all, todayStart);

    const drivers = {}, rests = {};
    let revenue=0, revenueToday=0, volume=0;
    /* عمولتا المطعم والتوصيل مفصولتين.
     *
     * اللوحة كانت تشتقّ عمولة المناديب طرحاً: إيراد المنصّة ناقص مجموع
     * عمولات المطاعم. والطرح خاطئ فعلاً لا نظرياً — قائمة المطاعم تُبنى
     * من `restaurantId` وتتخطّى ما لا يحمله، بينما `platformRevenue`
     * يجمع كل الطلبات. فعمولةُ كل طلب بلا معرّف مطعم (مارت، قديم، يدوي)
     * كانت تُنسب للمناديب. نُرسل الرقمين صريحين فلا يبقى للطرح موضع. */
    let restCommTotal=0, drvCommTotal=0;
    all.forEach(o => {
      const b = orderBreakdown(o);
      volume += b.total; revenue += b.owedToZadna;
      restCommTotal += b.restCommission; drvCommTotal += b.drvCommission;
      const d = orderDate(o); if (d && d >= todayStart) revenueToday += b.owedToZadna;
      const did = driverKeyOf(o);
      if (did) {
        if (!drivers[did]) drivers[did] = { id:did, name:driverNameOf(o), deliveries:0, collected:0, owed:0, owedToday:0, earnings:0 };
        drivers[did].deliveries++; drivers[did].collected += b.collectedFromCustomer;
        // نفس قاعدة الإعفاء المطبّقة في محفظة المندوب — رقم واحد للطرفين
        const owedThis = owedFor(b);
        drivers[did].owed += owedThis;
        drivers[did].earnings += driverNetFor(b);
        if (d && d >= todayStart) drivers[did].owedToday += owedThis;
      }
      const rid = String(o.restaurantId||'');
      if (rid) {
        if (!rests[rid]) rests[rid] = { id:rid, name:o.restaurant||rid, orders:0, gross:0, commission:0 };
        rests[rid].orders++; rests[rid].gross += b.total; rests[rid].commission += b.restCommission;
      }
    });

    const setSnap = await db.collection('settlements').get();
    const settled = {};
    setSnap.forEach(d => { const s = d.data(); settled[s.driverId] = (settled[s.driverId]||0) + (Number(s.amount)||0); });

    const driversList = Object.values(drivers).map(d => ({
      ...d, collected:r2(d.collected), owed:r2(d.owed), owedToday:r2(d.owedToday),
      earnings:r2(d.earnings), settled:r2(settled[d.id]||0),
      balanceDue:r2(Math.max(0, d.owed - (settled[d.id]||0))),
      overpaid:r2(Math.max(0, (settled[d.id]||0) - d.owed))
    })).sort((a,b) => b.balanceDue - a.balanceDue);

    const restsList = Object.values(rests).map(r => ({
      ...r, gross:r2(r.gross), commission:r2(r.commission)
    })).sort((a,b) => b.gross - a.gross);

    res.json({
      success:true, drivers:driversList, restaurants:restsList,
      totals:{
        ordersDelivered: all.length,
        grossVolume: r2(volume),
        platformRevenue: r2(revenue),
        restaurantCommission: r2(restCommTotal),
        driverCommission: r2(drvCommTotal),
        revenueToday: r2(revenueToday),
        pendingFromDrivers: r2(driversList.reduce((s,d)=>s+d.balanceDue,0)),
        totalSettled: r2(Object.values(settled).reduce((s,v)=>s+v,0))
      },
      model: 'المندوب يدفع للمطعم مباشرة ويسدّد عمولة زادنا يومياً'
    });
  } catch (e) { res.status(500).json({ success:false, error:e.message }); }
});

// POST /api/wallet/settlement — تسجيل تسديد المندوب
router.post('/wallet/settlement', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success:false, error:'Database not connected' });
    const { driverId, driverName, amount, note } = req.body || {};
    if (!driverId) return res.status(400).json({ success:false, error:'driverId مطلوب' });
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ success:false, error:'المبلغ غير صحيح' });

    // ===== منع التسوية المكررة =====
    // ضغطتان متتاليتان على «استلمت» كانتا تُسجّلان تسويتين، فيُشطب من دَين
    // المندوب ضِعف ما دفع فعلاً. نرفض أي مبلغ مطابق لنفس المندوب خلال
    // دقيقتين إلا إذا أكّد المدير صراحة أنها دفعة منفصلة.
    if (!req.body.allowDuplicate) {
      const twoMinAgo = new Date(Date.now() - 120000);
      const recent = await db.collection('settlements')
        .where('driverId', '==', String(driverId))
        .get();
      const dup = recent.docs.find(d => {
        const s = d.data();
        const t = s.createdAt && s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt || 0);
        return Number(s.amount) === amt && t > twoMinAgo;
      });
      if (dup) {
        return res.status(409).json({
          success: false,
          error: 'سُجّلت تسوية بنفس المبلغ لهذا المندوب قبل دقائق — إن كانت دفعة منفصلة أعد الإرسال بتأكيد',
          duplicateId: dup.id
        });
      }
    }

    /* ============================================================
       رقم إيصال متسلسل — لأن التسوية بلا رقم ليست إيصالاً.

       كانت التسوية تُحفظ بمعرّف Firestore عشوائي (`aX9k...`) لا
       يُقرأ ولا يُنطق ولا يُكتب على ورقة. وحين يختلف مندوب معك بعد
       شهر — «دفعتُك ٤٠٠» — لا مرجع بينكما إلا ذاكرتان متعارضتان.

       `SET-0001` رقمٌ يُقال في الهاتف ويُكتب على قصاصة ويُبحث عنه في
       اللوحة. هذا هو الفرق بين سجلٍّ ووثيقة.

       والترقيم يُشتقّ من العدد الحالي لا من عدّاد منفصل: لا مستند
       زائد يُقرأ، ولا عدّاد يفسد إن حُذفت تسوية. وعند التصادم النادر
       (تسويتان في نفس اللحظة) يُلحق حرفٌ بدل أن تفشل العملية —
       فالمال أهمّ من جمال الرقم. */
    let receiptNo = '';
    try {
      const cnt = await db.collection('settlements').count().get();
      receiptNo = 'SET-' + String((cnt.data().count || 0) + 1).padStart(4, '0');
      const clash = await db.collection('settlements').where('receiptNo', '==', receiptNo).limit(1).get();
      if (!clash.empty) receiptNo += '-' + Math.random().toString(36).slice(2, 4).toUpperCase();
    } catch (e) {
      receiptNo = 'SET-' + Date.now().toString().slice(-6);   // بديل لا يُفشل التسوية
    }

    const doc = {
      driverId: String(driverId), driverName: driverName || '',
      amount: amt, note: note || '',
      receiptNo,
      // من سجّلها ومتى — التسوية فعلٌ مالي يستحق توقيعاً
      recordedBy: String((req.user && req.user.userId) || 'admin'),
      createdAt: new Date(),
    };
    const ref = await db.collection('settlements').add(doc);

    /* التسوية تُنقص كاش جيبه — وإلا بقي فوق السقف بعد أن دفع.
     * لا ينزل تحت الصفر: من سدّد أكثر ممّا عليه لا يصير دائناً بجيبه. */
    try {
      const FV = require('firebase-admin').firestore.FieldValue;
      const uref = db.collection('users').doc(String(driverId));
      const u = await uref.get();
      const cur = Number((u.exists ? u.data() : {}).cashOnHand || 0);
      await uref.update({ cashOnHand: Math.max(0, cur - amt) });
    } catch (e) {
      console.warn('⚠️ تعذّر إنقاص كاش المندوب بعد التسوية:', e.message);
    }

    _cache = { at: 0, data: null }; // إبطال الكاش
    console.log(`🧾 تسوية ${receiptNo}: ${driverName || driverId} — ${amt} ₪`);
    res.status(201).json({ success:true, id:ref.id, ...doc });
  } catch (e) { res.status(500).json({ success:false, error:e.message }); }
});

// GET /api/wallet/settlements — سجل التسويات
router.get('/wallet/settlements', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json([]);
    const snap = await db.collection('settlements').get();
    const list = []; snap.forEach(d => list.push({ id:d.id, ...d.data() }));
    list.sort((a,b) => ((b.createdAt&&b.createdAt._seconds)||0) - ((a.createdAt&&a.createdAt._seconds)||0));
    res.json(list.slice(0, 100));
  } catch (e) { res.status(500).json({ error:e.message }); }
});

module.exports = router;
