const express = require('express');
const router = express.Router();

const getDb = (req) => req.app.get('db');

// ==============================
// أكواد الشركاء الأحادية (partner_codes)
// الكود نفسه = document ID (يمنع التكرار تلقائياً)
// ==============================

// POST /api/partner_codes — توليد كود جديد من لوحة المدير
router.post('/partner_codes', async (req, res) => {
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
router.delete('/partner_codes/:code', async (req, res) => {
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
    const partners = [];
    for (const t of ['driver', 'restaurant']) {
      const snap = await db.collection('users').where('userType', '==', t).get();
      snap.forEach(doc => {
        const u = doc.data();
        partners.push({
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
    res.json(partners);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/registered_partners/approve
router.post('/registered_partners/approve', async (req, res) => {
  try {
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
router.post('/registered_partners/reject', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'id مطلوب' });
    await db.collection('users').doc(String(id)).update({ status: 'rejected' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/registered_partners/delete
router.post('/registered_partners/delete', async (req, res) => {
  try {
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

module.exports = router;
