const express = require('express');
const router = express.Router();
/* عدّاد القراءات — قراءةٌ لا تُحصى تجعل مقياس الحصة يكذب، والمقياس
 * الذي يكذب أسوأ من غيابه. */
const meter = require('../utils/meter');
const ledger = require('../utils/ledger');   // كل تسوية سطرٌ في الدفتر

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
  MARKET_COMMISSION,
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
  /* `applyPayment` لا `breakdown` وحدها للطلبات القديمة: هي التي تحمل
   * حقول الدفع (`paidOnline` · `driverOwesZadna` · `zadnaOwesDriver`).
   * وبدونها يُقرأ طلبٌ قديم كأنه كاش دائماً — وهو صحيح اليوم لأن كل
   * القديم كاش، لكنه يصير كذباً يوم يمرّ طلبٌ إلكتروني بلا `money`. */
  const m = o.money || money.applyPayment(money.breakdown(o), o);
  const paidOnline = m.paidOnline === true;
  return {
    total: m.itemsTotal,
    fee: m.deliveryFee,
    paidToRestaurant: m.payToRestaurant,       // ما يدفعه المندوب للمطعم (كاشاً)
    collectedFromCustomer: m.cashToCollect,    // ما يحصّله من الزبون
    restCommission: m.restaurantCommission,
    drvCommission: m.driverCommission,
    owedToZadna: m.zadnaCommission,            // ربح زادنا — لا يتغيّر بطريقة الدفع
    driverNet: m.driverNet,

    /* الاتجاه: من يدين لمن. الحقلان محفوظان في الطلب منذ إنشائه،
     * ونسقط إلى الاشتقاق للطلبات التي سبقتهما. */
    paidOnline,
    driverOwesZadna: m.driverOwesZadna != null
      ? Number(m.driverOwesZadna)
      : (paidOnline ? 0 : m.zadnaCommission),
    zadnaOwesDriver: m.zadnaOwesDriver != null
      ? Number(m.zadnaOwesDriver)
      : (paidOnline ? m.driverNet : 0),
    zadnaOwesRestaurant: m.owedToRestaurant != null
      ? Number(m.owedToRestaurant)
      : (paidOnline ? m.payToRestaurant : 0),

    /* الحالة الهجينة: المندوب دفع للمحلّ نقداً، ثم وصلك تحويل الزبون
     * فأُكّد الطلب مدفوعاً. المحلّ قبض فعلاً — لكن `payToRestaurant`
     * صُفِّرت و`owedToRestaurant` صُفِّرت، فيصير المحلّ كأنه لم يقبض
     * شيئاً ولا ينتظر شيئاً: تسعون تختفي من كشفه.
     *
     * `driverPaidRestaurant` يكتبه مسار الدفع في هذه الحالة وحدها،
     * فنعدّه مقبوضاً نقداً — وهو ما حدث حرفياً. */
    cashPaidByDriver: Number(m.driverPaidRestaurant) || 0,
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

/* ============================================================
   ما يدين به **المندوب** لزادنا من طلبٍ واحد.

   وهذا ليس ربح زادنا — الفرق بينهما هو كل الفرق:

   · ربح زادنا (`owedToZadna`) لا يتغيّر بطريقة الدفع. عشرة بالمئة
     من الوجبة وعشرة من التوصيل، سواء دفع الزبون كاشاً أو ببطاقة.

   · وما يدين به **المندوب** يتغيّر تماماً: بالكاش هو الذي قبض المال
     فعليك أن تستردّ نصيبك منه. وبالبطاقة لم يقبض شيئاً — فمطالبتُه
     بعمولةٍ اقتطعتَها أصلاً من المبلغ الذي وصلك **مطالبةٌ بمالٍ
     مرّتين**.

   وكانت هذه الدالة تخلط الاثنين. فأوّل طلبٍ إلكتروني كان سيُظهر على
   مندوبٍ لم يقبض شيئاً ديناً بـ١١٫٥ ₪ — بينما الحقيقة أنك أنت تدين
   له بـ١٣٫٥. خطأٌ بـ٢٥ ₪ في الاتجاه المعاكس، على كل طلب.
   ============================================================ */
function owedFor(b) {
  if (b.paidOnline) return 0;
  /* نقرأ `driverOwesZadna` المُجمَّد لا نُعيد جمع العمولتين.
   * اليوم يتطابقان لأن الخصم صفر؛ ويوم تُبنى الكوبونات بـ`discountBy:
   * 'zadna'` يفترقان — فنطالب المندوب بخصمٍ موّلتَه أنت. */
  const saved = Number(b.driverOwesZadna);
  if (Number.isFinite(saved)) return r2(saved);
  return r2(b.restCommission + b.drvCommission);
}

/** ما تدين به **زادنا للمندوب** — أجرته حين لا يقبضها من الزبون. */
function zadnaOwesFor(b) {
  if (!b.paidOnline) return 0;
  const saved = Number(b.zadnaOwesDriver);
  return r2(Number.isFinite(saved) ? saved : b.driverNet);
}

/** ما يبقى للمندوب من أجرة التوصيل بعد العمولة — دخلُه، أياً كان طريقه. */
function driverNetFor(b) {
  return r2(b.fee - b.drvCommission);
}

/* ============================================================
   التسوية لها اتجاه — وبدونه يصير دفعُك له مثل قبضك منه.

   اليوم كل التسويات في اتجاهٍ واحد: المندوب يسلّمك ما عليه. فحقل
   `amount` موجب ولا سؤال.

   ومع الدفع الإلكتروني يظهر الاتجاه الثاني: **أنت تدفع له** أجرته.
   ولو سُجّلت بنفس الشكل لجُمعت مع الأولى — فيبدو مندوبٌ قبضتَ منه
   مئة ودفعتَ له مئة كأنه سدّد مئتين. ورصيده يصير سالباً بمئتين وهو
   لم يتحرّك.

   `direction`:
     · `'in'`  — منه إليك (تسوية كاش · الافتراضي · كل القديم)
     · `'out'` — منك إليه (أجرة توصيلٍ دُفع إلكترونياً)

   والقديم بلا حقل يُقرأ `in` — وهو صحيحٌ تاريخياً لا افتراضاً كسولاً:
   لم يكن هناك اتجاهٌ آخر يوم كُتب.
   ============================================================ */
async function settlementsOf(db, driverId) {
  const snap = await db.collection('settlements').where('driverId','==',String(driverId)).get();
  let paidIn = 0, paidOut = 0; const items = [];
  snap.forEach(d => {
    const s = d.data();
    const amt = Number(s.amount) || 0;
    const dir = String(s.direction || 'in');
    if (dir === 'out') paidOut += amt; else paidIn += amt;
    items.push({ id: d.id, ...s, direction: dir });
  });
  items.sort((a,b) => ((b.createdAt&&b.createdAt._seconds)||0) - ((a.createdAt&&a.createdAt._seconds)||0));
  return { sum: r2(paidIn), paidIn: r2(paidIn), paidOut: r2(paidOut), items };
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

    let collected=0, paidRest=0, owed=0, net=0, zadnaOwes=0, onlineCount=0;
    inPeriod.forEach(o => {
      const b = orderBreakdown(o);
      collected += b.collectedFromCustomer;
      // لم يدفع للمطعم شيئاً في الطلب الإلكتروني — دفعتَه أنت
      paidRest += b.paidOnline ? 0 : b.paidToRestaurant;
      owed += owedFor(b);
      net  += driverNetFor(b);
      zadnaOwes += zadnaOwesFor(b);
      if (b.paidOnline) onlineCount++;
    });

    // الإجمالي التاريخي مقابل ما سدّده — في الاتجاهين.
    let owedAll = 0, zadnaOwesAll = 0;
    mine.forEach(o => {
      const b = orderBreakdown(o);
      owedAll += owedFor(b);
      zadnaOwesAll += zadnaOwesFor(b);
    });
    const { paidIn, paidOut, items: settlements } = await settlementsOf(db, id);

    /* ============================================================
       الصافي — رقمٌ واحد يقول الحقيقة كاملة.

         عليه  = عمولات طلبات الكاش  −  ما سدّده لك
         له    = أجور طلباته المدفوعة إلكترونياً  −  ما دفعتَه له

       ثم نطرح: موجبٌ يعني عليه، سالبٌ يعني لك عليه دَين.

       ولا نعرض الرقمين وحدهما: مندوبٌ يقرأ «عليك ١٠٠» و«لك ٩٠» في
       سطرين لا يعرف أيدفع أم يقبض. والصافي يقول «ادفع ١٠» بلا تفكير
       — والتفصيل تحته لمن أراد.
       ============================================================ */
    const owesZadna  = r2(Math.max(0, owedAll - paidIn));
    const zadnaOwesD = r2(Math.max(0, zadnaOwesAll - paidOut));
    const netBalance = r2(owesZadna - zadnaOwesD);

    res.json({
      success: true, ownerType: 'driver', ownerId: id,
      period: req.query.period || 'all',
      deliveries: inPeriod.length,
      onlineDeliveries: onlineCount,        // كم منها مدفوعٌ إلكترونياً
      collectedFromCustomers: r2(collected),
      paidToRestaurants: r2(paidRest),
      owedToZadna: r2(owed),
      zadnaOwesDriver: r2(zadnaOwes),       // أجوره من الطلبات الإلكترونية
      driverEarnings: r2(net),              // دخله كاملاً — أياً كان طريق المال
      isTopDriverToday: isTop,
      waiverRate: 0,   // لا إعفاء — الجائزة عرض الاسم
      lifetimeOwed: r2(owedAll),
      lifetimeZadnaOwes: r2(zadnaOwesAll),
      totalSettled: paidIn,
      totalPaidToDriver: paidOut,

      /* `balanceDue` يبقى بمعناه القديم — عليه لك — كي لا تكذب شاشةٌ
       * لم تُبنَ بعد. و`netBalance` هو الرقم الصحيح حين يختلط النوعان. */
      balanceDue: owesZadna,
      overpaid: r2(Math.max(0, paidIn - owedAll)),
      zadnaOwesBalance: zadnaOwesD,
      netBalance,                            // + عليه · − له
      netDirection: netBalance > 0 ? 'driver_owes'
                  : netBalance < 0 ? 'zadna_owes' : 'settled',

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
    let gross=0, comm=0, received=0, pending=0, onlineCount=0, rateSum=0, rateN=0;
    inPeriod.forEach(o => {
      const b = orderBreakdown(o);
      gross += b.total; comm += b.restCommission;
      if (b.paidOnline) {
        // دُفع لزادنا — المطعم لم يقبض شيئاً بعد
        pending += b.zadnaOwesRestaurant;
        // إلّا أن يكون المندوب دفع له نقداً قبل أن يصلك التحويل
        received += b.cashPaidByDriver;
        onlineCount++;
      } else {
        received += b.paidToRestaurant;
      }
      // النسبة كما جُمّدت في الطلب — لا الثابت الحالي
      const m = o.money || {};
      if (Number.isFinite(Number(m.restaurantRate))) { rateSum += Number(m.restaurantRate); rateN++; }
    });

    const isMarket = inPeriod.some(o => (o.money || {}).isMarketOrder === true)
      || String(id).startsWith('mkt_');

    /* ما دفعتَه له فعلاً — يُطرح هنا كما يُطرح في كشف المدير.
     * ولو طُرح في أحدهما دون الآخر لصار عندك رقمان لنفس الحقيقة،
     * وصاحبُ المحلّ يقرأ غير ما تقرأ ويأتيك بورقة. */
    let paidOut = 0;
    try {
      const paySnap = await db.collection('partner_payouts')
        .where('partnerId', '==', id).get();
      paySnap.forEach(d => {
        const p = d.data() || {};
        /* الفترة تُطبَّق على الدفعات كما تُطبَّق على الطلبات — وإلّا
         * ظهر «هذا الأسبوع» مستحقّاً أقلّ ممّا هو لأن دفعةً قديمة خُصمت. */
        if (!from) { paidOut += Number(p.amount) || 0; return; }
        const t = p.createdAt && p.createdAt.toDate ? p.createdAt.toDate()
                : (p.createdAt && p.createdAt._seconds ? new Date(p.createdAt._seconds * 1000) : null);
        if (t && t >= from) paidOut += Number(p.amount) || 0;
      });
      meter.addReads(paySnap.size, 'دفعات شريك');
    } catch (e) {
      console.warn('⚠️ تعذّرت قراءة دفعات الشريك:', e.message);
    }
    const stillOwed = r2(Math.max(0, pending - paidOut));

    res.json({
      success:true, ownerType: isMarket ? 'market' : 'restaurant', ownerId:id,
      period:req.query.period||'all',
      ordersCount: inPeriod.length, gross: r2(gross),
      /* النسبة المعروضة هي **متوسّط ما طُبّق فعلاً** في هذه الفترة، لا
       * الثابت الحالي. فلو رفعتَ العمولة أمس، رأى الشريك الرقمين
       * ممتزجين بحسب طلباته — وهو الصدق. وإن لم تُحفظ نسبةٌ في أي طلب
       * (بيانات قديمة) نسقط إلى الثابت المناسب لنوعه. */
      commissionRate: rateN ? r2(rateSum / rateN) : (isMarket ? MARKET_COMMISSION : RESTAURANT_COMMISSION),
      zadnaCommission: r2(comm),
      receivedCash: r2(received),
      onlineOrders: onlineCount,
      /* ثلاثة أرقام بدل واحد. `pendingFromZadna` صار **الصافي** لأنه
       * الرقم الذي يقرؤه صاحب المحلّ ويبني عليه، وما نشأ إجمالاً
       * محفوظ في `grossOwed` لمن يدقّق. */
      pendingFromZadna: stillOwed,        // ما لم يقبضه بعد — تدفعه أنت
      grossOwed: r2(pending),             // ما نشأ له عليك في الفترة
      paidByZadna: r2(paidOut),           // ما حوّلتَه له فعلاً
      note: stillOwed > 0
        ? `${stillOwed} ₪ من طلباتٍ دُفعت إلكترونياً تُحوَّل لك من زادنا — والباقي قبضتَه نقداً وقت الاستلام`
        : (paidOut > 0
            ? `حُوِّل لك ${r2(paidOut)} ₪ — لا مستحقات معلّقة`
            : 'المندوب يدفع للمحلّ كاش وقت الاستلام — لا مستحقات معلّقة')
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
    // ما يقع عليك أنت من ديون: للمطاعم وللمناديب من الطلبات الإلكترونية
    let owedToPartners=0, owedToDrivers=0, onlineOrders=0, onlineVolume=0;
    all.forEach(o => {
      const b = orderBreakdown(o);
      volume += b.total; revenue += b.owedToZadna;
      restCommTotal += b.restCommission; drvCommTotal += b.drvCommission;
      if (b.paidOnline) { onlineOrders++; onlineVolume += r2(b.total + b.fee); }
      const d = orderDate(o); if (d && d >= todayStart) revenueToday += b.owedToZadna;
      const did = driverKeyOf(o);
      if (did) {
        if (!drivers[did]) drivers[did] = { id:did, name:driverNameOf(o), deliveries:0, collected:0, owed:0, owedToday:0, earnings:0, zadnaOwes:0 };
        drivers[did].deliveries++; drivers[did].collected += b.collectedFromCustomer;
        // نفس القاعدة المطبّقة في محفظة المندوب — رقم واحد للطرفين
        const owedThis = owedFor(b);
        drivers[did].owed += owedThis;
        drivers[did].earnings += driverNetFor(b);
        drivers[did].zadnaOwes += zadnaOwesFor(b);
        // داخل النطاق كي يساوي الإجمالي مجموع المناديب — ولا يبقى فرقٌ لا يُسوّى
        owedToDrivers += zadnaOwesFor(b);
        if (d && d >= todayStart) drivers[did].owedToday += owedThis;
      }
      const rid = String(o.restaurantId||'');
      if (rid) {
        if (!rests[rid]) rests[rid] = { id:rid, name:o.restaurant||rid, orders:0, gross:0, commission:0, pending:0 };
        rests[rid].orders++; rests[rid].gross += b.total; rests[rid].commission += b.restCommission;
        rests[rid].pending += b.zadnaOwesRestaurant;
        owedToPartners += b.zadnaOwesRestaurant;
      }
    });

    /* التسويات بالاتجاهين — الجمع الأعمى كان سيجعل دفعةً منك له
     * تبدو كتسديدٍ منه إليك، فيظهر رصيده سالباً وهو لم يتحرّك. */
    const setSnap = await db.collection('settlements').get();
    const settled = {}, paidOutTo = {};
    setSnap.forEach(d => {
      const s = d.data();
      const amt = Number(s.amount) || 0;
      if (String(s.direction || 'in') === 'out') paidOutTo[s.driverId] = (paidOutTo[s.driverId]||0) + amt;
      else settled[s.driverId] = (settled[s.driverId]||0) + amt;
    });

    /* ============================================================
       دفعاتك للشركاء — الطرف الذي كان يُكتب ولا يُقرأ.

       `partner_payouts` كانت تُسجَّل بإيصالٍ مرقّم منذ بُنيت، ولم
       يقرأها أي حساب. فكان `pending` يجمع ما عليك من كل طلبٍ دُفع
       إلكترونياً **ولا ينقص أبداً** — تدفع للمطعم تسعين وتبقى لوحتك
       تقول إنك مدينٌ له بها، ويكبر الرقم مع كل طلب QR.

       ولاحظ الفرق: المندوب كان مغلقاً من الطرفين (`settled` تُقرأ في
       ثمانية مواضع)، والشريك مفتوحاً من طرفٍ واحد. نفس العطب الذي
       يتكرّر في هذا المشروع — حقيقةٌ نصفُها مكتوب.
       ============================================================ */
    const payoutTo = {};
    try {
      const paySnap = await db.collection('partner_payouts').get();
      paySnap.forEach(d => {
        const p = d.data() || {};
        const pid = String(p.partnerId || '');
        if (pid) payoutTo[pid] = (payoutTo[pid] || 0) + (Number(p.amount) || 0);
      });
      meter.addReads(paySnap.size, 'دفعات الشركاء');
    } catch (e) {
      /* لا نُسقط الكشف كلّه لأن مجموعةً غابت — لكن لا نصمت أيضاً:
       * صمتٌ هنا يعني أرقاماً مضخَّمة تُقرأ كأنها صحيحة. */
      console.warn('⚠️ تعذّرت قراءة دفعات الشركاء — أرقام المستحقّ قد تكون أعلى من الواقع:', e.message);
    }

    /* ============================================================
       `cashOnHand` — ما يحمله المندوب نقداً في جيبه الآن.

       يختلف عن `balanceDue`: الأخير رقمٌ محاسبي (كم عليه إجمالاً)،
       وهذا رقمٌ **تشغيلي** — وهو الذي يحرسه سقف الكاش في push.js
       فيمنع الطلبات عمّن تجاوزه.

       وبلا إرساله للّوحة تكتشف أن مندوباً توقّفت طلباته ولا تعرف
       لماذا، فتظنّ عطلاً في التوزيع وتبحث في المكان الخطأ.

       نقرؤه من مستندات المستخدمين دفعةً واحدة لا مستنداً لكل مندوب:
       قراءةٌ لكل مندوب في كل تحديث للوحة تُنفق الحصة بلا داعٍ. */
    const cashOf = {};
    try {
      const ids = Object.keys(drivers).slice(0, 60);
      if (ids.length) {
        const snaps = await Promise.all(
          ids.map(id => db.collection('users').doc(String(id)).get())
        );
        snaps.forEach(s => { if (s.exists) cashOf[s.id] = Number((s.data() || {}).cashOnHand || 0); });
        meter.addReads(snaps.length, 'كاش المناديب');
      }
    } catch (e) {
      // الشارة زينة — غيابها لا يُسقط الكشف المالي
      console.warn('⚠️ تعذّرت قراءة كاش المناديب:', e.message);
    }

    const driversList = Object.values(drivers).map(d => {
      const owesZadna  = r2(Math.max(0, d.owed - (settled[d.id]||0)));
      const zadnaOwesD = r2(Math.max(0, d.zadnaOwes - (paidOutTo[d.id]||0)));
      return {
        ...d, collected:r2(d.collected), owed:r2(d.owed), owedToday:r2(d.owedToday),
        earnings:r2(d.earnings), settled:r2(settled[d.id]||0),
        cashOnHand: r2(cashOf[d.id] || 0),
        balanceDue: owesZadna,
        overpaid: r2(Math.max(0, (settled[d.id]||0) - d.owed)),
        zadnaOwes: r2(d.zadnaOwes),
        paidToDriver: r2(paidOutTo[d.id] || 0),
        zadnaOwesBalance: zadnaOwesD,
        // + عليه لك · − لك عليه. الرقم الذي يُقرأ بلا حساب يدوي.
        netBalance: r2(owesZadna - zadnaOwesD),
      };
    }).sort((a,b) => b.netBalance - a.netBalance);

    /* الشريك كالمندوب الآن: مستحقٌّ ومسدَّدٌ ومتبقٍّ — ثلاثة أرقام لا
     * رقمٌ واحد. و`pending` يبقى اسمه ومعناه (ما نشأ عليك من الطلبات)
     * كي لا تكذب أي واجهةٍ قديمة تقرؤه، و`balanceDue` هو ما تدفعه
     * فعلاً اليوم. */
    const restsList = Object.values(rests).map(r => {
      const paid = payoutTo[r.id] || 0;
      return {
        ...r, gross:r2(r.gross), commission:r2(r.commission), pending:r2(r.pending),
        paidOut: r2(paid),
        balanceDue: r2(Math.max(0, r.pending - paid)),
        // دفعتَ أكثر ممّا عليك — يظهر صريحاً بدل أن يبتلعه `Math.max`
        overpaid: r2(Math.max(0, paid - r.pending)),
      };
    }).sort((a,b) => b.balanceDue - a.balanceDue || b.gross - a.gross);

    const owedToPartnersNet = r2(restsList.reduce((s,r) => s + r.balanceDue, 0));
    const paidOutToPartners = r2(Object.values(payoutTo).reduce((s,v) => s+v, 0));

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
        totalSettled: r2(Object.values(settled).reduce((s,v)=>s+v,0)),

        /* ============================================================
           ما عليك أنت — وهو الوجه الآخر للدفع الإلكتروني.

           بالكاش لا تدين لأحد: المال يمرّ بين الزبون والمندوب والمطعم
           ولا يلمسك. وبالبطاقة يصلك كلّه، فتصير أمينَ صندوقٍ عليه
           التزامات. ولو لم يظهر هذا الرقم في لوحتك لأنفقتَ مالاً ليس
           لك وأنت تظنّه ربحاً.
           ============================================================ */
        onlineOrders,
        onlineVolume: r2(onlineVolume),
        /* `owedToPartners` صار **صافياً** بعد خصم ما دفعتَه. وهذا تغيير
         * في معنى رقمٍ كانت اللوحة تعرضه — مقصودٌ: المعنى القديم
         * («مجموع ما نشأ عليك منذ البداية») لا يفيد أحداً، والجديد
         * («ما عليك الآن») هو ما تقرؤه لتقرّر. والقديم محفوظ في
         * `partnersGross` لمن يحتاجه. */
        owedToPartners: owedToPartnersNet,       // للمطاعم والماركتات — بعد الخصم
        partnersGross: r2(owedToPartners),       // ما نشأ عليك إجمالاً
        paidOutToPartners,
        owedToDrivers:  r2(owedToDrivers),    // أجور المناديب
        totalOwedByZadna: r2(owedToPartnersNet + owedToDrivers),
        paidOutToDrivers: r2(Object.values(paidOutTo).reduce((s,v)=>s+v,0)),
      },
      model: onlineOrders > 0
        ? 'مختلط: الكاش يمرّ بالمندوب، والإلكتروني يصلك أنت فتوزّعه'
        : 'المندوب يدفع للمطعم مباشرة ويسدّد عمولة زادنا يومياً'
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

    /* اتجاه التسوية. الافتراضي `in` — منه إليك — وهو كل ما كان قبل
     * الدفع الإلكتروني. ولا نستنتجه من إشارة المبلغ: مبلغٌ سالب يُخطئ
     * إدخاله أحدٌ فينقلب المعنى بلا أن يقصد. النيّة تُكتب. */
    const direction = String((req.body || {}).direction || 'in') === 'out' ? 'out' : 'in';

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
        // الاتجاه جزءٌ من الهوية: قبضُك منه ١٠٠ ودفعُك له ١٠٠ في الدقيقة
        // نفسها حدثان مختلفان لا تكرار
        return Number(s.amount) === amt && String(s.direction || 'in') === direction && t > twoMinAgo;
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
    const prefix = direction === 'out' ? 'PAY-' : 'SET-';   // PAY = دفعتَ له · SET = سدّد لك
    try {
      const cnt = await db.collection('settlements').count().get();
      receiptNo = prefix + String((cnt.data().count || 0) + 1).padStart(4, '0');
      const clash = await db.collection('settlements').where('receiptNo', '==', receiptNo).limit(1).get();
      if (!clash.empty) receiptNo += '-' + Math.random().toString(36).slice(2, 4).toUpperCase();
    } catch (e) {
      receiptNo = 'SET-' + Date.now().toString().slice(-6);   // بديل لا يُفشل التسوية
    }

    const doc = {
      driverId: String(driverId), driverName: driverName || '',
      amount: amt, note: note || '',
      direction,                    // 'in' منه إليك · 'out' منك إليه
      receiptNo,
      // من سجّلها ومتى — التسوية فعلٌ مالي يستحق توقيعاً
      recordedBy: String((req.user && req.user.userId) || 'admin'),
      createdAt: new Date(),
    };
    const ref = await db.collection('settlements').add(doc);

    /* التسوية أوضح لحظةٍ يتحرّك فيها مالُك أنت — فهي أهمّ قيدٍ في
     * الدفتر. `in` سدّد لك · `out` دفعتَ له. والإيصال هو المرجع الذي
     * يُسأل به لاحقاً. */
    ledger.record(db, {
      kind: direction === 'in' ? ledger.KINDS.SETTLE_IN : ledger.KINDS.SETTLE_OUT,
      orderId: null,
      amount: amt,
      direction,
      actorId: String((req.user && req.user.userId) || 'admin'),
      actorRole: 'admin',
      actorName: driverName || '',
      reference: receiptNo,
      note: note || (direction === 'in'
        ? `سدّد المندوب ${driverName || driverId} عمولات زادنا`
        : `دُفع للمندوب ${driverName || driverId}`),
      meta: { driverId: String(driverId), settlementId: ref.id },
    }).catch(() => {});

    /* كاش جيبه يتغيّر مع الاتجاه:
     *
     * · سدّد لك (`in`)  → خرج المال من جيبه، فينقص كاشه ويعود تحت السقف.
     * · دفعتَ له (`out`) → **لا نزيد كاشه**. لأن `cashOnHand` رقمٌ تشغيلي
     *   يقيس «كم من مال زادنا في جيبه» لا «كم يملك»، وسقف الكاش يحرس
     *   الأول. وأجرته صارت ملكه، فزيادتها هنا تخنقه بسقفٍ لا يخصّها.
     *
     * ولا ينزل تحت الصفر: من سدّد أكثر ممّا عليه لا يصير دائناً بجيبه. */
    if (direction === 'in') {
      try {
        const uref = db.collection('users').doc(String(driverId));
        const u = await uref.get();
        const cur = Number((u.exists ? u.data() : {}).cashOnHand || 0);
        await uref.update({ cashOnHand: Math.max(0, cur - amt) });
      } catch (e) {
        console.warn('⚠️ تعذّر إنقاص كاش المندوب بعد التسوية:', e.message);
      }
    }

    _cache = { at: 0, data: null }; // إبطال الكاش
    console.log(`🧾 ${direction === 'out' ? 'دفعة لمندوب' : 'تسوية'} ${receiptNo}: ${driverName || driverId} — ${amt} ₪`);
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

/* GET /api/payouts/partner — سجلّ ما دفعتَه للشركاء.
 *
 * الدفعة كانت تُسجَّل بإيصالٍ مرقّم ولا سبيل لرؤيتها. وإيصالٌ لا يُقرأ
 * ليس إيصالاً — فحين يقول شريكٌ «لم تدفع لي» تحتاج السطر لا الذاكرة.
 *
 * `?partnerId=` يقصره على شريكٍ واحد. */
router.get('/payouts/partner', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json([]);
    const pid = String(req.query.partnerId || '').trim();
    const col = db.collection('partner_payouts');
    const snap = await (pid ? col.where('partnerId', '==', pid).get() : col.get());
    meter.addReads(snap.size, 'سجلّ دفعات الشركاء');
    const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a,b) => ((b.createdAt&&b.createdAt._seconds)||0) - ((a.createdAt&&a.createdAt._seconds)||0));
    res.json(list.slice(0, 200));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ═══════════════════ الدفتر: ثلاثة أبوابٍ للقراءة ═══════════════════
 *
 * لا بابَ للكتابة هنا عمداً. القيد يُكتب من حيث يقع الحدث — إنشاءُ
 * الطلب في orders.js، والتسوية أعلاه — لا من نداءٍ خارجي. فمسارُ
 * كتابةٍ مفتوح يعني أن أحدهم قد يكتب في دفترك ما لم يقع.
 * والتصحيح بقيدٍ مضادّ (reverse) لا بتعديل. */

/* GET /api/ledger/order/:id — قصّة طلبٍ واحد مرتّبةً زمنياً.
 *
 * `needsIdentity` وحدها لا تكفي هنا: أي مستخدمٍ مسجَّل كان سيقرأ قصّة
 * أي طلب — بمبالغه واسم زبونه وهاتفه في الملاحظات. فنسأل عن الطلب
 * أوّلاً ونتحقّق أن السائل طرفٌ فيه.
 *
 * والقراءة الإضافية مقبولة: هذه شاشة خلاف لا شاشة تُفتح كل ثانية. */
router.get('/ledger/order/:id', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json({ orderId: req.params.id, entries: [] });

    if (!req.isAdmin) {
      const me = req.user || {};
      const meId = String(me.userId || me.id || '');
      const mePhone = String(me.phone || '');
      const snap = await db.collection('orders').doc(String(req.params.id)).get();
      const o = snap.exists ? (snap.data() || {}) : null;
      if (!o) return res.status(404).json({ error: 'لا طلب بهذا الرقم' });

      const drv = o.driver || {};
      const isParty =
        (meId && (String(o.customerId || '') === meId ||
                  String(o.driverId || '') === meId ||
                  String(drv.id || '') === meId ||
                  String(o.restaurantId || '') === meId)) ||
        (mePhone && (String(o.customerPhone || '') === mePhone ||
                     String(drv.phone || '') === mePhone));

      if (!isParty) {
        return res.status(403).json({ error: 'هذا الطلب ليس لك' });
      }
    }
    /* storyOf تُرجع مصفوفةً عاريةً — نلفّها بشكلٍ ثابت. الردّ الذي
     * يكون مرّةً مصفوفةً ومرّةً كائناً يكسر القارئ في الحالة النادرة. */
    const entries = await ledger.storyOf(db, req.params.id);
    res.json({ orderId: String(req.params.id), count: entries.length, entries });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/ledger/movement?from=&to= — حركة اليوم (الافتراضي: آخر ٢٤ ساعة)
router.get('/ledger/movement', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json(null);
    const q = req.query || {};
    const out = await ledger.movement(
      db,
      q.from ? new Date(q.from) : undefined,
      q.to ? new Date(q.to) : undefined
    );
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* POST /api/ledger/:id/reverse — التصحيح الوحيد المسموح.
 * لا يمسّ القيد الأصلي: يكتب قيداً مضادّاً ويُشير إليه. فالخطأ يبقى
 * مرئياً مع تصحيحه — وهذا ما يجعل الدفتر شهادةً لا سرداً قابلاً
 * للتنقيح. والسببُ إلزاميّ: تصحيحٌ بلا سبب يُفسد الدفتر أكثر ممّا
 * يُصلح. */
router.post('/ledger/:id/reverse', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(500).json({ success: false, error: 'لا قاعدة بيانات' });
    const reason = String((req.body || {}).reason || '').trim();
    if (reason.length < 3) {
      return res.status(400).json({ success: false, error: 'اكتب سبب التصحيح — القيد المضادّ بلا سبب لا يُفهم لاحقاً' });
    }
    const out = await ledger.reverse(db, req.params.id, {
      actorId: String((req.user && req.user.userId) || 'admin'),
      actorRole: 'admin',
      actorName: (req.user && req.user.name) || 'الإدارة',
      reason,
    });
    if (!out) return res.status(400).json({ success: false, error: 'تعذّر التصحيح — قد يكون القيد غير موجود أو مصحَّحاً سلفاً' });
    res.status(201).json({ success: true, entry: out });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

/* ═══════════════ الجانب الخارج من المال ═══════════════
 *
 * كان الدفتر يعرف أن عليك دَيناً ولا يعرف أنك سدّدته. `refund_due`
 * يُكتب عند إلغاء طلبٍ مدفوع، و`owedToRestaurant` يُحسب في كل طلب —
 * ثم لا شيء. فلو أعدتَ المال للزبون فعلاً بقي الدَّين قائماً في
 * نظامك أبداً، وتراكمت عليك التزاماتٌ سدّدتَها.
 *
 * وأخطر من الرقم الخاطئ: زبونٌ يطالبك بمالٍ أعدتَه، ولا وثيقة لك.
 * ══════════════════════════════════════════════════════ */

/* POST /api/refunds/:orderId/paid — نفّذتُ الاسترداد.
 *
 * لا يُنفّذ التحويل — يُسجّله. إعادة المال تمرّ ببنكك أو بوابتك
 * بمسارها، وسيرفرٌ يحرّك أموالاً حقيقية بنداءٍ واحد بابُ كارثة.
 * ما يفعله: يُغلق الدَّين ويكتب القيد بمرجعه. */
router.post('/refunds/:orderId/paid', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'لا قاعدة بيانات' });

    const id = String(req.params.orderId);
    const ref = db.collection('orders').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'الطلب غير موجود' });

    const o = snap.data() || {};
    const due = Number(o.refundDue || 0);

    if (!due || due <= 0) {
      return res.status(409).json({ success: false, error: 'لا استرداد مستحقّ على هذا الطلب' });
    }
    /* الحارس الذي يمنع الدفع مرّتين: زرٌّ يُضغط مرّتين بالخطأ، أو
     * صفحتان مفتوحتان — ومئةُ شيكل تخرج ضعفين بلا أثرٍ للسبب. */
    if (String(o.refundStatus || '') === 'paid') {
      return res.json({ success: true, already: true, message: 'مسجَّل مسدَّداً سابقاً', paidAt: o.refundPaidAt });
    }

    const reference = String((req.body || {}).reference || '').trim().slice(0, 120);
    if (reference.length < 3) {
      return res.status(400).json({ success: false, error: 'اكتب مرجع التحويل — استردادٌ بلا مرجع لا يُثبَت' });
    }

    const method = String((req.body || {}).method || 'transfer').slice(0, 30);

    await ref.update({
      refundStatus: 'paid',
      refundPaidAt: new Date(),
      refundReference: reference,
      refundMethod: method,
      paymentStatus: 'refunded',
    });
    invalidate('orders:all');

    ledger.record(db, {
      kind: ledger.KINDS.REFUND_PAID,
      orderId: id,
      amount: due,
      direction: 'out',              // خرج من خزنتك فعلاً
      actorId: String((req.user && req.user.userId) || 'admin'),
      actorRole: 'admin',
      actorName: o.customerName || '',
      reference,
      note: `أُعيد للزبون ${o.customerPhone || ''} بـ${method}`,
      meta: { phone: o.customerPhone || '', method },
    }).catch(() => {});

    const io = req.app.get('socketio');
    if (io) io.emit('refund_paid', { orderId: id, amount: due });

    console.log(`💸 نُفّذ استرداد #${id} · ${due} ₪ · مرجع ${reference}`);
    res.json({ success: true, orderId: id, amount: due, reference });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* POST /api/payouts/partner — دفعتُ لمحلٍّ مستحقّاته.
 *
 * نظير `settlement` لكن للمحلّات: ما تدين به لمطعمٍ أو ماركت من
 * طلباتٍ وصلك ثمنها. بإيصالٍ مرقّم كأختها — الشريك الذي يقبض بلا
 * إيصال يسألك بعد شهرين وليس لأحدكما ورقة. */
router.post('/payouts/partner', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'لا قاعدة بيانات' });

    const b = req.body || {};
    const partnerId = String(b.partnerId || '').trim();
    const amt = r2(Number(b.amount));

    if (!partnerId) return res.status(400).json({ success: false, error: 'حدّد الشريك' });
    if (!Number.isFinite(amt) || amt === 0) {
      return res.status(400).json({ success: false, error: 'المبلغ يجب أن يكون رقماً غير صفر' });
    }
    /* ============================================================
       المبلغ السالب = استردادُ فائضٍ دفعتَه.

       ولماذا نسمح به هنا بدل حذف الدفعة الأصلية: الحذف يمحو أثر
       خطأٍ وقع فعلاً — والشريك قبض المال ثم أعاده، وهذان حدثان لا
       حدثٌ ملغى. فالجمع يبقى صحيحاً (٤٠٠ + −٥٥ = ٣٤٥) والسجلّ
       يبقى صادقاً.

       والسقف يمنع خطأً بإشارةٍ ضخمة: لا استرداد يتجاوز ما دفعتَه. */
    const isReversal = amt < 0;
    if (Math.abs(amt) > 1000000) {
      return res.status(400).json({ success: false, error: 'المبلغ خارج الحدّ المعقول' });
    }

    const reference = String(b.reference || '').trim().slice(0, 120);
    if (reference.length < 3) {
      return res.status(400).json({ success: false, error: 'اكتب مرجع التحويل أو رقم الإيصال' });
    }

    /* حارسُ التكرار نفسه المستعمل في التسويات: نفس المبلغ لنفس الشريك
     * خلال دقيقتين غالباً ضغطةٌ مكرّرة لا دفعتان. */
    const twoMinAgo = Date.now() - 120000;
    const recent = await db.collection('partner_payouts')
      .where('partnerId', '==', partnerId).get();
    let dup = null;
    recent.forEach(d => {
      const s = d.data() || {};
      const t = (s.createdAt && s.createdAt._seconds) ? s.createdAt._seconds * 1000 : 0;
      if (Number(s.amount) === amt && t > twoMinAgo) dup = { id: d.id, ...s };
    });
    if (dup) {
      return res.json({ success: true, already: true, message: 'سُجّلت دفعةٌ مطابقة قبل قليل', payout: dup });
    }

    let receiptNo;
    try {
      const cnt = await db.collection('partner_payouts').count().get();
      receiptNo = (isReversal ? 'PRT-R-' : 'PRT-') + String((cnt.data().count || 0) + 1).padStart(4, '0');
    } catch (e) {
      receiptNo = (isReversal ? 'PRT-R-' : 'PRT-') + Date.now().toString().slice(-6);
    }

    const doc = {
      partnerId, partnerName: String(b.partnerName || '').slice(0, 120),
      amount: amt, note: String(b.note || '').slice(0, 300),
      reference, receiptNo, isReversal,
      recordedBy: String((req.user && req.user.userId) || 'admin'),
      createdAt: new Date(),
    };
    const ref = await db.collection('partner_payouts').add(doc);

    ledger.record(db, {
      kind: ledger.KINDS.PARTNER_PAYOUT,
      orderId: null,
      /* الدفتر يحمل موجباً واتجاهاً — لا سالباً باتجاهٍ واحد. فقيدٌ
       * بمبلغٍ سالب واتجاه `out` يُحسب مرّتين خطأً في أي جمعٍ لاحق. */
      amount: Math.abs(amt),
      direction: isReversal ? 'in' : 'out',
      actorId: String((req.user && req.user.userId) || 'admin'),
      actorRole: 'admin',
      actorName: doc.partnerName,
      reference: receiptNo,
      note: doc.note || (isReversal
        ? `استُرد فائضٌ من الشريك ${doc.partnerName || partnerId} — مرجع ${reference}`
        : `دُفع للشريك ${doc.partnerName || partnerId} — مرجع ${reference}`),
      meta: { partnerId, payoutId: ref.id, bankReference: reference, isReversal },
    }).catch(() => {});

    _cache = { at: 0, data: null };
    console.log(`🧾 دفعة شريك ${receiptNo}: ${doc.partnerName || partnerId} — ${amt} ₪`);
    res.status(201).json({ success: true, id: ref.id, ...doc });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* GET /api/refunds/pending — ما عليك للزبائن ولم يُسدَّد بعد.
 * قائمة عملٍ لا تقرير: كل سطرٍ فيها زبونٌ ينتظر ماله. */
router.get('/refunds/pending', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json({ count: 0, total: 0, items: [] });
    const snap = await db.collection('orders').where('refundStatus', '==', 'pending').get();
    meter.addReads(snap.size || 1, 'استردادات معلّقة');
    const items = [];
    snap.forEach(d => {
      const o = d.data() || {};
      items.push({
        orderId: d.id,
        amount: Number(o.refundDue || 0),
        customerName: o.customerName || '',
        customerPhone: o.customerPhone || '',
        cancelledAt: o.cancelledAt || null,
        cancelReason: o.cancelReason || '',
        paymentReference: o.paymentReference || null,
      });
    });
    items.sort((a, b) => b.amount - a.amount);
    res.json({
      count: items.length,
      total: r2(items.reduce((s, x) => s + x.amount, 0)),
      items,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* GET /api/reconcile — هل الأرقام متّزنة؟
 *
 * فحصٌ ثقيل نسبياً (يقرأ الطلبات والمناديب والتسويات)، فلا يُنادى في
 * كل تحديث شاشة. تفتحه أنت مرّةً في اليوم، أو يناديه فحصٌ مجدول. */
router.get('/reconcile', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    const reconcile = require('../utils/reconcile');
    const out = await reconcile.fullCheck(db, {
      since: req.query.since ? new Date(req.query.since).getTime() : undefined,
    });
    res.json(out);
  } catch (e) { res.status(500).json({ severity: 'alert', error: e.message }); }
});

module.exports = router;
