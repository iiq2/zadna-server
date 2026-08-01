const express = require('express');
const router = express.Router();

const getDb = (req) => req.app.get('db');

// مناطق التوصيل وأسعارها — نابلس
const DEFAULT_ZONES = [
  // داخل المدينة — المطاعم غالباً هنا
  { id: 'z01', nameAr: 'وسط البلد (الدوار والمحيط)', fee: 10, group: 'داخل المدينة', level: 0 },
  { id: 'z02', nameAr: 'شارع سفيان', fee: 10, group: 'داخل المدينة', level: 0 },
  { id: 'z03', nameAr: 'شارع فيصل', fee: 15, group: 'داخل المدينة', level: 1 },
  { id: 'z04', nameAr: 'المنطقة الصناعية الشرقية', fee: 15, group: 'داخل المدينة', level: 1 },
  { id: 'z05', nameAr: 'رفيديا (الشوارع الرئيسية والمحيط السفلي)', fee: 15, group: 'داخل المدينة', level: 1 },
  { id: 'z06', nameAr: 'المخيمات القريبة (عين بيت الماء، عسكر، بلاطة)', fee: 15, group: 'داخل المدينة', level: 1 },
  // المرتفعات — طلوع جبل، +5 شيكل
  { id: 'z07', nameAr: 'الجبل الشمالي (الشيخ مسلم، خلة العامود)', fee: 20, group: 'المرتفعات', level: 2 },
  { id: 'z08', nameAr: 'حي نمساوي وحي الفاطمية', fee: 20, group: 'المرتفعات', level: 2 },
  { id: 'z09', nameAr: 'الأكاديمية (محيط جامعة النجاح - الحرم الجديد)', fee: 20, group: 'المرتفعات', level: 2 },
  { id: 'z10', nameAr: 'المعاجين (المناطق العلوية)', fee: 25, group: 'المرتفعات', level: 2 },
  { id: 'z11', nameAr: 'إسكان الأطباء وإسكان المهندسين', fee: 25, group: 'المرتفعات', level: 2 },
  { id: 'z12', nameAr: 'طور والسامريين (جبل جرزيم)', fee: 25, group: 'المرتفعات', level: 2 },
  // الضواحي والبلدات — خارج المدينة، لا تقل عن 20
  { id: 'z13', nameAr: 'بيت وزن', fee: 20, group: 'الضواحي والبلدات', level: 3 },
  { id: 'z14', nameAr: 'كفر قليل', fee: 20, group: 'الضواحي والبلدات', level: 3 },
  { id: 'z15', nameAr: 'زواتا', fee: 25, group: 'الضواحي والبلدات', level: 3 },
  { id: 'z16', nameAr: 'دير شرف', fee: 25, group: 'الضواحي والبلدات', level: 3 },
  { id: 'z17', nameAr: 'عصيرة الشمالية', fee: 30, group: 'الضواحي والبلدات', level: 3 },
  { id: 'z18', nameAr: 'تل', fee: 30, group: 'الضواحي والبلدات', level: 3 }
];

// الحد الأدنى حسب المجموعة — يمنع أي سعر أقل من المعقول
const GROUP_MIN = { 'داخل المدينة': 10, 'المرتفعات': 15, 'الضواحي والبلدات': 20 };

// إضافة على السعر إذا كان المطعم نفسه خارج وسط البلد (بُعد الالتقاط)
const PICKUP_SURCHARGE = { 0: 0, 1: 0, 2: 5, 3: 10 };

function zoneById(id, overrides = {}) {
  const base = DEFAULT_ZONES.find(z => z.id === id);
  if (overrides[id]) return { ...(base || {}), ...overrides[id], id };
  return base || null;
}

// حساب أجرة التوصيل: منطقة الزبون + بُعد المطعم
function computeFee(customerZone, restaurantZone) {
  if (!customerZone) return null;
  let fee = Number(customerZone.fee) || 0;
  const min = GROUP_MIN[customerZone.group];
  if (min && fee < min) fee = min;
  // المطعم بعيد عن وسط البلد → المندوب يقطع مسافة إضافية للالتقاط
  const rLevel = restaurantZone ? Number(restaurantZone.level || 0) : 0;
  const cLevel = Number(customerZone.level || 0);
  let surcharge = PICKUP_SURCHARGE[rLevel] || 0;
  // نفس المنطقة → لا إضافة، المشوار قصير
  if (restaurantZone && restaurantZone.id === customerZone.id) surcharge = 0;
  // الزبون أبعد من المطعم أو بنفس البُعد → المندوب رايح بنفس الاتجاه، لا لفة زائدة
  else if (cLevel >= rLevel) surcharge = 0;
  // السعر دائماً من مضاعفات 5 — يسهّل التعامل بالكاش
  const total = Math.ceil((fee + surcharge) / 5) * 5;
  return { fee: total, baseFee: fee, surcharge: total - fee };
}

// GET /api/delivery_zones — تعمل حتى لو حصة قاعدة البيانات منتهية
router.get('/delivery_zones', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json(DEFAULT_ZONES);
    let overrides = {};
    try {
      const snap = await db.collection('delivery_zones').get();
      snap.forEach(d => { overrides[d.id] = d.data(); });
    } catch (e) {
      return res.json(DEFAULT_ZONES);
    }
    const baseIds = new Set(DEFAULT_ZONES.map(z => z.id));
    const merged = DEFAULT_ZONES
      .map(z => (overrides[z.id] ? { ...z, ...overrides[z.id], id: z.id } : z))
      .filter(z => z.active !== false);
    Object.keys(overrides).forEach(id => {
      if (!baseIds.has(id) && overrides[id].active !== false) merged.push({ ...overrides[id], id });
    });
    merged.sort((a, b) => (a.fee - b.fee) || String(a.nameAr).localeCompare(String(b.nameAr), 'ar'));
    res.json(merged);
  } catch (e) {
    res.json(DEFAULT_ZONES);
  }
});

// POST /api/delivery_zones — إضافة/تعديل منطقة
router.post('/delivery_zones', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const z = req.body || {};
    if (!z.nameAr || !String(z.nameAr).trim()) return res.status(400).json({ success: false, error: 'اسم المنطقة مطلوب' });
    const fee = Number(z.fee);
    if (isNaN(fee) || fee < 0) return res.status(400).json({ success: false, error: 'سعر التوصيل غير صحيح' });
    const id = z.id || ('z' + Date.now());
    await db.collection('delivery_zones').doc(String(id)).set(
      { id, nameAr: String(z.nameAr).trim(), fee, group: z.group || 'أخرى', active: z.active !== false },
      { merge: true }
    );
    res.status(201).json({ success: true, id, fee });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PATCH /api/delivery_zones/:id — تعديل سعر منطقة
router.patch('/delivery_zones/:id', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const id = String(req.params.id);
    const base = DEFAULT_ZONES.find(z => z.id === id) || {};
    const body = { ...req.body };
    if (body.fee != null) {
      const f = Number(body.fee);
      if (isNaN(f) || f < 0) return res.status(400).json({ success: false, error: 'سعر غير صحيح' });
      body.fee = f;
    }
    await db.collection('delivery_zones').doc(id).set({ ...base, ...body, id }, { merge: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/delivery_zones/:id — إخفاء منطقة
router.delete('/delivery_zones/:id', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    await db.collection('delivery_zones').doc(String(req.params.id)).set({ active: false }, { merge: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/delivery_quote?zone=z07&restaurantZone=z01 — كم أجرة هذه التوصيلة
router.get('/delivery_quote', async (req, res) => {
  try {
    const db = getDb(req);
    let overrides = {};
    if (db) {
      try {
        const snap = await db.collection('delivery_zones').get();
        snap.forEach(d => { overrides[d.id] = d.data(); });
      } catch (e) { /* حصة منتهية — نكمل بالافتراضي */ }
    }
    const cz = zoneById(String(req.query.zone || ''), overrides);
    if (!cz) return res.status(400).json({ success: false, error: 'منطقة الزبون غير معروفة' });
    let rz = null;
    if (req.query.restaurantZone) rz = zoneById(String(req.query.restaurantZone), overrides);
    else if (req.query.restaurantId && db) {
      try {
        const doc = await db.collection('restaurants').doc(String(req.query.restaurantId)).get();
        if (doc.exists && doc.data().zoneId) rz = zoneById(String(doc.data().zoneId), overrides);
      } catch (e) { /* تجاهل */ }
    }
    const q = computeFee(cz, rz);
    res.json({
      success: true, fee: q.fee, baseFee: q.baseFee, surcharge: q.surcharge,
      zoneName: cz.nameAr, restaurantZoneName: rz ? rz.nameAr : null,
      note: q.surcharge > 0 ? `+${q.surcharge} ₪ لأن المطعم خارج وسط البلد` : null
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
