const express = require('express');
const router = express.Router();

const getDb = (req) => req.app.get('db');
/** اعتماد الشركاء وتجميدهم وتوليد الأكواد — للإدارة وحدها. */
const adminOnly = (req, res, next) => {
  const fn = req.app.get('requireAdmin');
  return fn ? fn(req, res, next) : next();
};
const { cached, invalidate } = require('../utils/cache');
// 5 دقائق: أي اعتماد أو تجميد أو تسجيل جديد يُبطل الكاش فوراً.
const PARTNERS_TTL = 300000;

// ==============================
// أكواد الشركاء الأحادية (partner_codes)
// الكود نفسه = document ID (يمنع التكرار تلقائياً)
// ==============================

// POST /api/partner_codes — توليد كود جديد من لوحة المدير
router.post('/partner_codes', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const { type, code } = req.body || {};
    if (!['driver', 'restaurant'].includes(type)) {
      return res.status(400).json({ success: false, error: 'نوع الشريك غير صحيح' });
    }
    const prefix = type === 'driver' ? 'ZADNA-DRV' : 'ZADNA-RST';
    const finalCode = String(code || (prefix + '-' + Math.floor(1000 + Math.random() * 9000))).toUpperCase().trim();
    const ref = db.collection('partner_codes').doc(finalCode);
    const existing = await ref.get();
    if (existing.exists) {
      return res.status(409).json({ success: false, error: 'هذا الكود موجود سابقاً' });
    }
    await ref.set({
      code: finalCode,
      type,
      isUsed: false,
      usedBy: null,
      createdAt: new Date()
    });
    res.status(201).json({ success: true, code: finalCode, type });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/partner_codes — قائمة الأكواد وحالتها
router.get('/partner_codes', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json([]);
    const snapshot = await db.collection('partner_codes').get();
    const codes = [];
    snapshot.forEach(doc => codes.push(doc.data()));
    codes.sort((a, b) => ((b.createdAt && b.createdAt._seconds) || 0) - ((a.createdAt && a.createdAt._seconds) || 0));
    res.json(codes);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/partner_codes/:code — حذف/إبطال كود
router.delete('/partner_codes/:code', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    await db.collection('partner_codes').doc(String(req.params.code).toUpperCase()).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==============================
// الشركاء المسجلون (من users الحقيقية)
// استعلامان بسيطان بدون orderBy => لا حاجة لفهرس مركب
// ==============================

// GET /api/registered_partners
router.get('/registered_partners', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json([]);
    const partners = await cached('partners:all', PARTNERS_TTL, async () => {
      const list = [];
      for (const t of ['driver', 'restaurant']) {
        const snap = await db.collection('users').where('userType', '==', t).get();
        snap.forEach(doc => {
          const u = doc.data();
          list.push({
            id: doc.id,
            name: u.name || '',
            phone: u.phone || '',
            email: u.email || '',
            type: t,
            status: u.status || 'approved',
            date: (u.createdAt && u.createdAt._seconds) ? new Date(u.createdAt._seconds * 1000).toLocaleString('ar-EG') : ''
          });
        });
      }
      return list;
    });
    res.json(partners);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/registered_partners/approve
router.post('/registered_partners/approve', adminOnly, async (req, res) => {
  try {
    invalidate('partners:all');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'id مطلوب' });
    await db.collection('users').doc(String(id)).update({ status: 'approved' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/registered_partners/reject
router.post('/registered_partners/reject', adminOnly, async (req, res) => {
  try {
    invalidate('partners:all');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'id مطلوب' });
    const note = (req.body && req.body.note) || '';
    await db.collection('users').doc(String(id)).update({ status: 'rejected', statusNote: note, statusAt: new Date() });
    const io = req.app.get('socketio');
    if (io) io.emit('partner_status_changed', { id: String(id), status: 'rejected', note });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/registered_partners/freeze — تجميد مؤقت
router.post('/registered_partners/freeze', adminOnly, async (req, res) => {
  try {
    invalidate('partners:all');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'id مطلوب' });
    const note = (req.body && req.body.note) || '';
    await db.collection('users').doc(String(id)).update({ status: 'frozen', statusNote: note, statusAt: new Date() });
    // أبلغ الشريك فوراً عبر السوكت
    const io = req.app.get('socketio');
    if (io) io.emit('partner_status_changed', { id: String(id), status: 'frozen', note });
    res.json({ success: true, status: 'frozen' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/registered_partners/unfreeze — فك التجميد (يرجع معتمد)
router.post('/registered_partners/unfreeze', adminOnly, async (req, res) => {
  try {
    invalidate('partners:all');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'id مطلوب' });
    await db.collection('users').doc(String(id)).update({ status: 'approved', statusNote: '', statusAt: new Date() });
    const io = req.app.get('socketio');
    if (io) io.emit('partner_status_changed', { id: String(id), status: 'approved', note: '' });
    res.json({ success: true, status: 'approved' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/registered_partners/delete
router.post('/registered_partners/delete', adminOnly, async (req, res) => {
  try {
    invalidate('partners:all');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'id مطلوب' });
    await db.collection('users').doc(String(id)).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/registered_partners — التطبيق يبلّغ عن شريك جديد (توافقية)
router.post('/registered_partners', async (req, res) => {
  try {
    invalidate('partners:all');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const b = req.body || {};
    const io = req.app.get('socketio');
    if (io) {
      const payload = { id: b.id || null, name: b.name || '', phone: b.phone || '', type: b.type || b.userType || 'driver', date: new Date() };
      io.emit('new_partner_request', payload);
      io.to('manager_monitor').emit('new_partner_request', payload);
    }
    res.status(200).json({ success: true, message: 'تم استلام الطلب' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/partner_codes/:code/verify — التحقق من صلاحية الكود قبل التسجيل
router.get('/partner_codes/:code/verify', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json({ valid: false, error: 'Database not connected' });
    const snap = await db.collection('partner_codes').doc(String(req.params.code).toUpperCase().trim()).get();
    if (!snap.exists) return res.json({ valid: false, error: 'كود الاعتماد غير صحيح ❌' });
    const c = snap.data();
    if (c.isUsed) return res.json({ valid: false, error: 'هذا الكود مستخدم سابقاً ❌' });
    res.json({ valid: true, type: c.type });
  } catch (error) {
    res.json({ valid: false, error: error.message });
  }
});

// GET /api/partner_status?phone=... أو ?id=... — حالة الشريك (للتحقق من التجميد بالتطبيق)
router.get('/partner_status', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json({ status: 'approved' });
    const { phone, id, email } = req.query;
    let data = null;
    if (id) {
      const d = await db.collection('users').doc(String(id)).get();
      if (d.exists) data = d.data();
    } else if (phone || email) {
      const field = phone ? 'phone' : 'email';
      const snap = await db.collection('users').where(field, '==', String(phone || email)).limit(1).get();
      if (!snap.empty) data = snap.docs[0].data();
    }
    if (!data) return res.status(404).json({ status: 'unknown', error: 'المستخدم غير موجود' });
    const status = data.status || 'approved';
    res.json({
      status,
      statusNote: data.statusNote || '',
      isFrozen: status === 'frozen',
      isRejected: status === 'rejected',
      isPending: status === 'pending',
      canWork: status === 'approved'
    });
  } catch (error) {
    res.status(500).json({ status: 'unknown', error: error.message });
  }
});

// GET /api/top_driver — أفضل مندوب لليوم (إعفاء من العمولة يوم واحد)
// نسبة إعفاء أفضل مندوب — نفس المتغير المستخدم في المحفظة
const TOP_DRIVER_WAIVER = Math.min(1, Math.max(0, parseFloat(process.env.TOP_DRIVER_WAIVER || '0')));

router.get('/top_driver', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json({ topDriverId: null, deliveries: 0, date: null });
    const start = new Date(); start.setHours(0, 0, 0, 0);
    // تطبيق المندوب يستطلع هذا المسار؛ بلا كاش كان كل نداء يقرأ
    // مجموعة الطلبات كاملة من كل جهاز.
    const docs = await cached('top_driver:delivered', 300000, async () => {
      const snap = await db.collection('orders').where('status', '==', 'DELIVERED').get();
      const out = [];
      snap.forEach(d => out.push(d.data()));
      return out;
    });
    const counts = {};
    docs.forEach(o => {
      const ts = o.createdAt && o.createdAt._seconds ? new Date(o.createdAt._seconds * 1000) : null;
      if (!ts || ts < start) return;
      const drvId = (o.driver && (o.driver.id || o.driver.phone || o.driver.name)) || o.driverId;
      if (!drvId) return;
      const key = String(drvId);
      if (!counts[key]) counts[key] = { id: key, name: (o.driver && o.driver.name) || key, deliveries: 0 };
      counts[key].deliveries++;
    });
    const list = Object.values(counts).sort((a, b) => b.deliveries - a.deliveries);
    const top = list[0] || null;
    res.json({
      topDriverId: top ? top.id : null,
      topDriverName: top ? top.name : null,
      deliveries: top ? top.deliveries : 0,
      // الجائزة الأساسية عرض الاسم؛ الإعفاء المالي حسب النسبة المضبوطة
      commissionExempt: !!top && TOP_DRIVER_WAIVER > 0,
      waiverRate: TOP_DRIVER_WAIVER,
      period: 'اليوم',
      date: start.toISOString().slice(0, 10),
      leaderboard: list.slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
