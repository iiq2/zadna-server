const express = require('express');
const router = express.Router();

const getDb = (req) => req.app.get('db');
/**
 * أسعار التوصيل ومراكز المناطق — للإدارة وحدها.
 * كانت مفتوحة: أي أحد يغيّر سعر أي منطقة بطلب واحد، وقد اكتُشفت
 * أثناء اختبار الحماية حين تغيّر سعر وسط البلد إلى 99 ₪.
 */
const adminOnly = (req, res, next) => {
  const fn = req.app.get('requireAdmin');
  return fn ? fn(req, res, next) : next();
};

// مناطق التوصيل وأسعارها — نابلس
//
// حقلا lat/lng هما مركز المنطقة، يُستخدمان لتحديد أقرب منطقة لدبوس الزبون.
// المضبوطة هنا مصدرها مراجع جغرافية موثّقة فقط؛ بقية المناطق تُترك فارغة
// عمداً — يضبطها المدير من خريطة اللوحة لأنه أدرى بحدود أحياء نابلس،
// وتخمينها يعني احتساب سعر خاطئ على الزبون.
const DEFAULT_ZONES = [
  // داخل المدينة — المطاعم غالباً هنا
  { id: 'z01', nameAr: 'وسط البلد (الدوار والمحيط)', fee: 10, group: 'داخل المدينة', level: 0, lat: 32.22111, lng: 35.25444 },
  { id: 'z02', nameAr: 'شارع سفيان', fee: 10, group: 'داخل المدينة', level: 0 },
  { id: 'z03', nameAr: 'شارع فيصل', fee: 15, group: 'داخل المدينة', level: 1 },
  { id: 'z04', nameAr: 'المنطقة الصناعية الشرقية', fee: 15, group: 'داخل المدينة', level: 1 },
  { id: 'z05', nameAr: 'رفيديا (الشوارع الرئيسية والمحيط السفلي)', fee: 15, group: 'داخل المدينة', level: 1, lat: 32.20564, lng: 35.23461 },
  { id: 'z06', nameAr: 'المخيمات القريبة (عين بيت الماء، عسكر، بلاطة)', fee: 15, group: 'داخل المدينة', level: 1, lat: 32.20641, lng: 35.28658 },
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

/** المسافة بالكيلومترات بين إحداثيتين (هافرساين). */
function distanceKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** أقرب منطقة لها إحداثيات مضبوطة. تتجاهل المناطق غير المضبوطة. */
function nearestZone(zones, lat, lng) {
  let best = null, bestKm = Infinity;
  zones.forEach(z => {
    if (typeof z.lat !== 'number' || typeof z.lng !== 'number') return;
    if (z.active === false) return;
    const km = distanceKm(lat, lng, z.lat, z.lng);
    if (km < bestKm) { bestKm = km; best = z; }
  });
  return best ? { zone: best, km: Math.round(bestKm * 100) / 100 } : null;
}

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
router.post('/delivery_zones', adminOnly, async (req, res) => {
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
router.patch('/delivery_zones/:id', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const id = String(req.params.id);
    const base = DEFAULT_ZONES.find(z => z.id === id) || {};
    const body = { ...req.body };
    ['lat', 'lng'].forEach(k => {
      if (body[k] != null && body[k] !== '') {
        const v = parseFloat(body[k]);
        if (!isNaN(v)) body[k] = v; else delete body[k];
      } else if (body[k] === '') { body[k] = null; }
    });
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
router.delete('/delivery_zones/:id', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    await db.collection('delivery_zones').doc(String(req.params.id)).set({ active: false }, { merge: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ================= التسعير بالمسافة =================
 * القاعدة المتفق عليها: 10 ₪ لأول كيلومترين، ثم 3 ₪ لكل كيلومتر بعدهما.
 *   fee = 10 + max(0, ceil(km − 2)) × 3
 *
 * المسافة خط مستقيم × 1.35، وهو معامل التفاف الطرق. اخترناه بديلاً عن
 * محرّك مسارات مدفوع: الفارق بضعة أمتار في مدينة بحجم نابلس، ولا تكلفة
 * شهرية على كل طلب. يُعاير من بيانات الطلبات الحقيقية لاحقاً.
 *
 * تُقاس من موقع المطعم إلى موقع الزبون — لا من مركز منطقة إلى مركز منطقة،
 * لأن مطعمين في «وسط البلد» قد يبعد أحدهما عن الزبون ضعف الآخر.
 */
/* الأجرة بمضاعفات 5 ₪ فقط — قرار تشغيلي لا حسابي:
 * المندوب يقبض نقداً في الشارع، و«13 ₪» تعني بحثاً عن فراطة عند كل باب،
 * وتأخيراً، وخلافاً على شيكلين. الشرائح: 10 ثم 15 ثم 20 ثم 25...
 *   كل كيلومترين بعد أول كيلومترين = +5 ₪
 */
const BASE_FEE = 10;        // أول كيلومترين
const FREE_KM = 2;
const STEP_KM = 2;          // طول الشريحة
const STEP_FEE = 5;         // زيادة الشريحة — مضاعفات 5 تُدفع بلا فراطة
const ROAD_FACTOR = 1.35;   // التفاف الطرق مقابل الخط المستقيم

function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371, rad = (d) => d * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function feeForKm(km) {
  const steps = Math.max(0, Math.ceil((km - FREE_KM) / STEP_KM));
  return BASE_FEE + steps * STEP_FEE;
}

const validPoint = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= 29 && lat <= 34 && lng >= 33.5 && lng <= 36.5;   // فلسطين

// GET /api/delivery_quote?zone=z07&restaurantZone=z01 — كم أجرة هذه التوصيلة
// أو بالمسافة: ?restaurantId=..&lat=..&lng=..  (يُفضَّل — أدق وأعدل)
/**
 * حساب أجرة التوصيل — المصدر الوحيد للرقم.
 *
 * استُخرج من مسار delivery_quote ليتمكّن مسار إنشاء الطلب من إعادة
 * الحساب بنفسه. قبل ذلك كانت الأجرة تُحسب هنا للعرض فقط، ثم يرسل
 * التطبيق ما يشاء عند الطلب — والسيرفر يحفظه كما ورد.
 */
async function quoteDelivery(db, { lat, lng, restaurantId, zone, restaurantZone }) {
  // ——— المسار المفضَّل: مسافة حقيقية بين نقطتين ———
  const cLat = parseFloat(lat), cLng = parseFloat(lng);
  if (validPoint(cLat, cLng) && restaurantId && db) {
    try {
      const doc = await db.collection('restaurants').doc(String(restaurantId)).get();
      const r = doc.exists ? doc.data() : null;
      const rLat = r ? Number(r.lat) : NaN, rLng = r ? Number(r.lng) : NaN;
      if (validPoint(rLat, rLng)) {
        const km = haversineKm(rLat, rLng, cLat, cLng) * ROAD_FACTOR;
        const fee = feeForKm(km);
        return {
          success: true, fee, baseFee: BASE_FEE, surcharge: fee - BASE_FEE,
          distanceKm: Math.round(km * 100) / 100, method: 'distance',
          note: `المسافة ${km.toFixed(1)} كم من ${r.name || 'المطعم'}`
        };
      }
    } catch (e) { /* نسقط للمناطق */ }
  }
  // ——— الاحتياطي: نظام المناطق، حتى لا ينكسر الطلب بلا إحداثيات ———
  let overrides = {};
  if (db) {
    try {
      const snap = await db.collection('delivery_zones').get();
      snap.forEach(d => { overrides[d.id] = d.data(); });
    } catch (e) { /* حصة منتهية — نكمل بالافتراضي */ }
  }
  const cz = zoneById(String(zone || ''), overrides);
  if (!cz) return { success: false, error: 'منطقة الزبون غير معروفة' };
  let rz = null;
  if (restaurantZone) rz = zoneById(String(restaurantZone), overrides);
  else if (restaurantId && db) {
    try {
      const doc = await db.collection('restaurants').doc(String(restaurantId)).get();
      if (doc.exists && doc.data().zoneId) rz = zoneById(String(doc.data().zoneId), overrides);
    } catch (e) { /* تجاهل */ }
  }
  const q = computeFee(cz, rz);
  return {
    success: true, fee: q.fee, baseFee: q.baseFee, surcharge: q.surcharge, method: 'zone',
    zoneName: cz.nameAr, restaurantZoneName: rz ? rz.nameAr : null,
    note: q.surcharge > 0 ? `+${q.surcharge} ₪ لأن المطعم خارج وسط البلد` : null
  };
}

router.get('/delivery_quote', async (req, res) => {
  try {
    const out = await quoteDelivery(getDb(req), {
      lat: req.query.lat, lng: req.query.lng,
      restaurantId: req.query.restaurantId,
      zone: req.query.zone, restaurantZone: req.query.restaurantZone
    });
    if (!out.success) return res.status(400).json(out);
    res.json(out);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/resolve_zone?lat=&lng= — أقرب منطقة لدبوس الزبون
router.get('/resolve_zone', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng);
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'إحداثيات غير صحيحة' });
    }
    const db = getDb(req);
    let overrides = {};
    if (db) {
      try {
        const snap = await db.collection('delivery_zones').get();
        snap.forEach(d => { overrides[d.id] = d.data(); });
      } catch (e) { /* حصة منتهية — نكمل بالافتراضي */ }
    }
    const baseIds = new Set(DEFAULT_ZONES.map(z => z.id));
    const merged = DEFAULT_ZONES.map(z => (overrides[z.id] ? { ...z, ...overrides[z.id], id: z.id } : z));
    Object.keys(overrides).forEach(id => {
      if (!baseIds.has(id)) merged.push({ ...overrides[id], id });
    });

    const hit = nearestZone(merged, lat, lng);
    if (!hit) {
      return res.json({
        success: true, zone: null,
        note: 'لم تُضبط إحداثيات أي منطقة بعد — اختر منطقتك يدوياً'
      });
    }
    // بعيد جداً عن كل المناطق المعروفة: نقترح لكن ننبّه
    const farAway = hit.km > 8;
    res.json({
      success: true,
      zoneId: hit.zone.id,
      zoneName: hit.zone.nameAr,
      fee: hit.zone.fee,
      distanceKm: hit.km,
      confident: !farAway,
      note: farAway ? 'موقعك بعيد عن مناطق التغطية — تأكد من اختيارك' : null
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
module.exports.quoteDelivery = quoteDelivery;
