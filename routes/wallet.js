const express = require('express');
const router = express.Router();

const getDb = (req) => req.app.get('db');

// ===== نموذج التحصيل =====
// المندوب يدفع للمطعم كاش وقت الاستلام (ثمن الوجبة ناقص عمولة زادنا)
// المندوب يحصّل من الزبون (الوجبة + التوصيل)
// المندوب يسدّد لزادنا يومياً: عمولة المطعم + عمولة التوصيل
const RESTAURANT_COMMISSION = parseFloat(process.env.RESTAURANT_COMMISSION || '0.10');
const DRIVER_COMMISSION     = parseFloat(process.env.DRIVER_COMMISSION || '0.10');
const DEFAULT_DELIVERY_FEE  = parseFloat(process.env.DEFAULT_DELIVERY_FEE || '5');

const orderTotal = (o) => {
  const v = o.totalAmount != null ? o.totalAmount : (o.total != null ? o.total : 0);
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : n;
};
const feeOf = (o) => Number(o.deliveryFee) || DEFAULT_DELIVERY_FEE;
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
  const snap = await db.collection('orders').where('status', '==', 'DELIVERED').limit(MAX_ORDERS).get();
  const list = []; snap.forEach(d => list.push({ _id: d.id, ...d.data() }));
  _cache = { at: Date.now(), data: list };
  return list;
}

// حساب مستحقات زادنا على طلب واحد
function orderBreakdown(o) {
  const total = orderTotal(o), fee = feeOf(o);
  const restCommission = total * RESTAURANT_COMMISSION;   // من حصة المطعم
  const drvCommission  = fee * DRIVER_COMMISSION;         // من أجرة التوصيل
  return {
    total, fee,
    paidToRestaurant: r2(total - restCommission),  // ما يدفعه المندوب للمطعم
    collectedFromCustomer: r2(total + fee),
    restCommission: r2(restCommission),
    drvCommission: r2(drvCommission),
    owedToZadna: r2(restCommission + drvCommission),
    driverNet: r2(fee - drvCommission)
  };
}

async function settlementsOf(db, driverId) {
  const snap = await db.collection('settlements').where('driverId','==',String(driverId)).get();
  let sum = 0; const items = [];
  snap.forEach(d => { const s = d.data(); sum += Number(s.amount)||0; items.push({ id: d.id, ...s }); });
  items.sort((a,b) => ((b.createdAt&&b.createdAt._seconds)||0) - ((a.createdAt&&a.createdAt._seconds)||0));
  return { sum: r2(sum), items };
}

// GET /api/wallet/driver/:id — كشف حساب المندوب (كم عليه لزادنا)
router.get('/wallet/driver/:id', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success:false, error:'Database not connected' });
    const id = String(req.params.id);
    const from = periodStart(req.query.period || 'all');
    const all = await fetchDelivered(db);
    const mine = all.filter(o => driverKeyOf(o) === id);
    const inPeriod = from ? mine.filter(o => { const d = orderDate(o); return d && d >= from; }) : mine;

    // أفضل مندوب اليوم معفى من عمولته
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const counts = {};
    all.forEach(o => { const d = orderDate(o); if (!d || d < todayStart) return; const k = driverKeyOf(o); if (k) counts[k] = (counts[k]||0)+1; });
    const topId = Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0] || null;
    const isTop = topId === id;
    const isToday = (o) => { const d = orderDate(o); return d && d >= todayStart; };

    let collected=0, paidRest=0, owed=0, net=0, waived=0;
    inPeriod.forEach(o => {
      const b = orderBreakdown(o);
      collected += b.collectedFromCustomer; paidRest += b.paidToRestaurant;
      const exempt = isTop && isToday(o);
      owed += b.restCommission + (exempt ? 0 : b.drvCommission);
      net  += exempt ? b.fee : b.driverNet;
      if (exempt) waived += b.drvCommission;
    });

    // الإجمالي التاريخي مقابل ما سدّده
    let owedAll = 0;
    mine.forEach(o => { const b = orderBreakdown(o); owedAll += b.owedToZadna; });
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
      commissionWaived: r2(waived),
      lifetimeOwed: r2(owedAll),
      totalSettled: paid,
      balanceDue: r2(owedAll - paid),
      settlements: settlements.slice(0, 20)
    });
  } catch (e) { res.status(500).json({ success:false, error:e.message }); }
});

// GET /api/wallet/restaurant/:id — كشف المطعم (معلوماتي: المندوب يدفع مباشرة)
router.get('/wallet/restaurant/:id', async (req, res) => {
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
router.get('/wallet/summary', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success:false, error:'Database not connected' });
    const all = await fetchDelivered(db);
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);

    const drivers = {}, rests = {};
    let revenue=0, revenueToday=0, volume=0;
    all.forEach(o => {
      const b = orderBreakdown(o);
      volume += b.total; revenue += b.owedToZadna;
      const d = orderDate(o); if (d && d >= todayStart) revenueToday += b.owedToZadna;
      const did = driverKeyOf(o);
      if (did) {
        if (!drivers[did]) drivers[did] = { id:did, name:driverNameOf(o), deliveries:0, collected:0, owed:0, owedToday:0, earnings:0 };
        drivers[did].deliveries++; drivers[did].collected += b.collectedFromCustomer;
        drivers[did].owed += b.owedToZadna; drivers[did].earnings += b.driverNet;
        if (d && d >= todayStart) drivers[did].owedToday += b.owedToZadna;
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
      earnings:r2(d.earnings), settled:r2(settled[d.id]||0), balanceDue:r2(d.owed - (settled[d.id]||0))
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
        revenueToday: r2(revenueToday),
        pendingFromDrivers: r2(driversList.reduce((s,d)=>s+d.balanceDue,0)),
        totalSettled: r2(Object.values(settled).reduce((s,v)=>s+v,0))
      },
      model: 'المندوب يدفع للمطعم مباشرة ويسدّد عمولة زادنا يومياً'
    });
  } catch (e) { res.status(500).json({ success:false, error:e.message }); }
});

// POST /api/wallet/settlement — تسجيل تسديد المندوب
router.post('/wallet/settlement', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success:false, error:'Database not connected' });
    const { driverId, driverName, amount, note } = req.body || {};
    if (!driverId) return res.status(400).json({ success:false, error:'driverId مطلوب' });
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ success:false, error:'المبلغ غير صحيح' });
    const doc = { driverId:String(driverId), driverName:driverName||'', amount:amt, note:note||'', createdAt:new Date() };
    const ref = await db.collection('settlements').add(doc);
    _cache = { at: 0, data: null }; // إبطال الكاش
    res.status(201).json({ success:true, id:ref.id, ...doc });
  } catch (e) { res.status(500).json({ success:false, error:e.message }); }
});

// GET /api/wallet/settlements — سجل التسويات
router.get('/wallet/settlements', async (req, res) => {
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
