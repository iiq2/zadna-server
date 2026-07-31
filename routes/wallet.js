const express = require('express');
const router = express.Router();

const getDb = (req) => req.app.get('db');

// ===== إعدادات العمولات =====
const RESTAURANT_COMMISSION = parseFloat(process.env.RESTAURANT_COMMISSION || '0.10'); // 10% من قيمة الطلب
const DRIVER_COMMISSION = parseFloat(process.env.DRIVER_COMMISSION || '0.10');         // 10% من أجرة التوصيل
const DEFAULT_DELIVERY_FEE = parseFloat(process.env.DEFAULT_DELIVERY_FEE || '5');      // أجرة توصيل افتراضية إذا غير محددة

// قيمة الطلب من أي صيغة
const orderTotal = (o) => {
  const v = o.totalAmount != null ? o.totalAmount : (o.total != null ? o.total : 0);
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : n;
};
const orderDate = (o) => (o.createdAt && o.createdAt._seconds) ? new Date(o.createdAt._seconds * 1000) : null;
const driverKeyOf = (o) => {
  if (o.driver && typeof o.driver === 'object') return String(o.driver.id || o.driver.phone || o.driver.name || '');
  if (o.driverId) return String(o.driverId);
  return '';
};

function periodStart(period) {
  const d = new Date();
  if (period === 'today') { d.setHours(0, 0, 0, 0); return d; }
  if (period === 'week')  { d.setDate(d.getDate() - 7); return d; }
  if (period === 'month') { d.setDate(d.getDate() - 30); return d; }
  return null; // all
}

async function fetchDelivered(db) {
  const snap = await db.collection('orders').where('status', '==', 'DELIVERED').get();
  const list = [];
  snap.forEach(doc => list.push({ _id: doc.id, ...doc.data() }));
  return list;
}

async function paidSum(db, ownerType, ownerId) {
  const snap = await db.collection('payouts')
    .where('ownerType', '==', ownerType)
    .where('ownerId', '==', String(ownerId))
    .get();
  let sum = 0; const items = [];
  snap.forEach(doc => { const p = doc.data(); sum += Number(p.amount) || 0; items.push({ id: doc.id, ...p }); });
  items.sort((a, b) => ((b.createdAt && b.createdAt._seconds) || 0) - ((a.createdAt && a.createdAt._seconds) || 0));
  return { sum, items };
}

// GET /api/wallet/restaurant/:id?period=today|week|month|all
router.get('/wallet/restaurant/:id', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const id = String(req.params.id);
    const from = periodStart(req.query.period || 'all');
    const all = await fetchDelivered(db);
    const mine = all.filter(o => String(o.restaurantId) === id);
    const inPeriod = from ? mine.filter(o => { const d = orderDate(o); return d && d >= from; }) : mine;

    const gross = inPeriod.reduce((s, o) => s + orderTotal(o), 0);
    const commission = gross * RESTAURANT_COMMISSION;
    const net = gross - commission;

    // الرصيد المستحق = صافي كل الفترات - ما تم صرفه
    const grossAll = mine.reduce((s, o) => s + orderTotal(o), 0);
    const netAll = grossAll * (1 - RESTAURANT_COMMISSION);
    const { sum: paid, items: payouts } = await paidSum(db, 'restaurant', id);

    res.json({
      success: true,
      ownerType: 'restaurant', ownerId: id,
      period: req.query.period || 'all',
      ordersCount: inPeriod.length,
      gross: Math.round(gross * 100) / 100,
      commissionRate: RESTAURANT_COMMISSION,
      commission: Math.round(commission * 100) / 100,
      net: Math.round(net * 100) / 100,
      lifetimeNet: Math.round(netAll * 100) / 100,
      totalPaid: Math.round(paid * 100) / 100,
      balanceDue: Math.round((netAll - paid) * 100) / 100,
      payouts: payouts.slice(0, 20)
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/wallet/driver/:id?period=...
router.get('/wallet/driver/:id', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const id = String(req.params.id);
    const from = periodStart(req.query.period || 'all');
    const all = await fetchDelivered(db);
    const mine = all.filter(o => driverKeyOf(o) === id);
    const inPeriod = from ? mine.filter(o => { const d = orderDate(o); return d && d >= from; }) : mine;

    // إعفاء أفضل مندوب اليوم من الرسوم
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const counts = {};
    all.forEach(o => {
      const d = orderDate(o); if (!d || d < todayStart) return;
      const k = driverKeyOf(o); if (!k) return;
      counts[k] = (counts[k] || 0) + 1;
    });
    const topId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || null;
    const isTopToday = topId === id;

    const feeOf = (o) => Number(o.deliveryFee) || DEFAULT_DELIVERY_FEE;
    const isToday = (o) => { const d = orderDate(o); return d && d >= todayStart; };

    const deliveries = inPeriod.length;
    const deliveryEarnings = inPeriod.reduce((s, o) => s + feeOf(o), 0);
    // أفضل مندوب اليوم: إعفاء من عمولة طلبات اليوم فقط
    const feesPeriod = inPeriod.reduce((s, o) => s + ((isTopToday && isToday(o)) ? 0 : feeOf(o) * DRIVER_COMMISSION), 0);
    const todayOrders = mine.filter(isToday);
    const waivedToday = isTopToday ? todayOrders.reduce((s, o) => s + feeOf(o) * DRIVER_COMMISSION, 0) : 0;

    const lifetimeEarn = mine.reduce((s, o) => s + feeOf(o), 0);
    const lifetimeFees = mine.reduce((s, o) => s + ((isTopToday && isToday(o)) ? 0 : feeOf(o) * DRIVER_COMMISSION), 0);
    const { sum: paid, items: payouts } = await paidSum(db, 'driver', id);

    res.json({
      success: true,
      ownerType: 'driver', ownerId: id,
      period: req.query.period || 'all',
      deliveries,
      deliveryEarnings: Math.round(deliveryEarnings * 100) / 100,
      platformFees: Math.round(feesPeriod * 100) / 100,
      net: Math.round((deliveryEarnings - feesPeriod) * 100) / 100,
      isTopDriverToday: isTopToday,
      feeExemptToday: isTopToday,
      commissionRate: DRIVER_COMMISSION,
      feesTodayWaived: Math.round(waivedToday * 100) / 100,
      lifetimeNet: Math.round((lifetimeEarn - lifetimeFees) * 100) / 100,
      totalPaid: Math.round(paid * 100) / 100,
      balanceDue: Math.round((lifetimeEarn - lifetimeFees - paid) * 100) / 100,
      payouts: payouts.slice(0, 20)
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/wallet/summary — ملخص كل المحافظ (للوحة المدير)
router.get('/wallet/summary', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const all = await fetchDelivered(db);
    const rests = {}, drivers = {};
    all.forEach(o => {
      const t = orderTotal(o);
      const rid = String(o.restaurantId || '');
      if (rid) {
        if (!rests[rid]) rests[rid] = { id: rid, name: o.restaurant || rid, orders: 0, gross: 0 };
        rests[rid].orders++; rests[rid].gross += t;
      }
      const did = driverKeyOf(o);
      if (did) {
        if (!drivers[did]) drivers[did] = { id: did, name: (o.driver && o.driver.name) || did, deliveries: 0, earnings: 0 };
        drivers[did].deliveries++; drivers[did].earnings += (Number(o.deliveryFee) || DEFAULT_DELIVERY_FEE);
      }
    });
    const paySnap = await db.collection('payouts').get();
    const paidMap = {};
    paySnap.forEach(d => { const p = d.data(); const k = p.ownerType + ':' + p.ownerId; paidMap[k] = (paidMap[k] || 0) + (Number(p.amount) || 0); });

    const restaurants = Object.values(rests).map(r => {
      const net = r.gross * (1 - RESTAURANT_COMMISSION);
      const paid = paidMap['restaurant:' + r.id] || 0;
      return { ...r, gross: Math.round(r.gross*100)/100, commission: Math.round(r.gross*RESTAURANT_COMMISSION*100)/100,
               net: Math.round(net*100)/100, paid: Math.round(paid*100)/100, balanceDue: Math.round((net-paid)*100)/100 };
    }).sort((a,b) => b.gross - a.gross);

    const driversList = Object.values(drivers).map(d => {
      const fees = d.earnings * DRIVER_COMMISSION;
      const net = d.earnings - fees;
      const paid = paidMap['driver:' + d.id] || 0;
      return { ...d, earnings: Math.round(d.earnings*100)/100, fees: Math.round(fees*100)/100,
               net: Math.round(net*100)/100, paid: Math.round(paid*100)/100, balanceDue: Math.round((net-paid)*100)/100 };
    }).sort((a,b) => b.deliveries - a.deliveries);

    const platformRevenue = restaurants.reduce((s,r) => s + r.commission, 0) + driversList.reduce((s,d) => s + d.fees, 0);

    res.json({
      success: true,
      restaurants, drivers: driversList,
      totals: {
        ordersDelivered: all.length,
        grossVolume: Math.round(restaurants.reduce((s,r)=>s+r.gross,0)*100)/100,
        platformRevenue: Math.round(platformRevenue*100)/100,
        dueToRestaurants: Math.round(restaurants.reduce((s,r)=>s+r.balanceDue,0)*100)/100,
        dueToDrivers: Math.round(driversList.reduce((s,d)=>s+d.balanceDue,0)*100)/100
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/wallet/payout — تسجيل تسوية/دفعة (من المدير)
router.post('/wallet/payout', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const { ownerType, ownerId, amount, note } = req.body || {};
    if (!['restaurant', 'driver'].includes(ownerType)) return res.status(400).json({ success: false, error: 'ownerType غير صحيح' });
    if (!ownerId) return res.status(400).json({ success: false, error: 'ownerId مطلوب' });
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ success: false, error: 'المبلغ غير صحيح' });
    const doc = { ownerType, ownerId: String(ownerId), amount: amt, note: note || '', createdAt: new Date() };
    const ref = await db.collection('payouts').add(doc);
    res.status(201).json({ success: true, id: ref.id, ...doc });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
