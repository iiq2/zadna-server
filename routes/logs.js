const express = require('express');
const router = express.Router();

const getDb = (req) => req.app.get('db');
const MAX_KEEP = 300; // نحتفظ بآخر 300 خطأ فقط (توفير حصة Firestore)

// POST /api/logs — التطبيقات تبلّغ عن أي خطأ يواجهه المستخدم
router.post('/logs', async (req, res) => {
  try {
    const b = req.body || {};
    const entry = {
      level: b.level || 'error',              // error | warn | info
      app: b.app || 'unknown',                // customer | captain | merchant | admin | server
      screen: b.screen || '',                 // الشاشة التي حدث فيها
      message: String(b.message || '').slice(0, 500),
      detail: String(b.detail || '').slice(0, 1500),
      userId: b.userId || '',
      userPhone: b.userPhone || '',
      device: String(b.device || '').slice(0, 120),
      appVersion: b.appVersion || '',
      createdAt: new Date()
    };
    // اطبع دائماً في سجل Render (مجاني ولا يستهلك حصة)
    console.error(`🐞 [${entry.app}/${entry.screen}] ${entry.message} | ${entry.userPhone} | ${entry.detail.slice(0,200)}`);

    const db = getDb(req);
    if (db) {
      try { await db.collection('error_logs').add(entry); } catch (e) { /* لا نفشل الطلب بسبب التسجيل */ }
    }
    res.status(201).json({ success: true });
  } catch (e) {
    res.status(200).json({ success: false }); // لا نُفشل التطبيق أبداً بسبب التسجيل
  }
});

// GET /api/logs?limit=50&app=customer — للوحة المدير
router.get('/logs', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json([]);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const snap = await db.collection('error_logs').orderBy('createdAt', 'desc').limit(limit).get();
    let list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    if (req.query.app) list = list.filter(x => x.app === req.query.app);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/logs — مسح السجل (بعد المعالجة)
router.delete('/logs', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json({ success: true, deleted: 0 });
    const snap = await db.collection('error_logs').get();
    const batch = db.batch();
    let n = 0;
    snap.forEach(d => { batch.delete(d.ref); n++; });
    await batch.commit();
    res.json({ success: true, deleted: n });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/diagnostics — فحص صحة النظام (استهلاك حصة ضئيل جداً)
router.get('/diagnostics', async (req, res) => {
  const out = {
    server: 'up',
    uptimeMinutes: Math.round(process.uptime() / 60),
    time: new Date().toISOString(),
    firestore: 'unknown',
    firestoreError: null,
    jwtSecretSet: !!process.env.JWT_SECRET,
    firebaseKeySet: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1048576)
  };
  try {
    const db = getDb(req);
    if (!db) { out.firestore = 'not_connected'; return res.json(out); }
    // قراءة مستند واحد فقط للفحص
    await db.collection('orders').limit(1).get();
    out.firestore = 'ok';
  } catch (e) {
    const msg = String(e.message || e);
    out.firestore = msg.includes('RESOURCE_EXHAUSTED') ? 'quota_exceeded' : 'error';
    out.firestoreError = msg.slice(0, 200);
  }
  res.json(out);
});

module.exports = router;
