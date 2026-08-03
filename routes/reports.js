const express = require('express');
const router = express.Router();

const getDb = (req) => req.app.get('db');
const adminOnly = (req, res, next) => {
  const fn = req.app.get('requireAdmin');
  return fn ? fn(req, res, next) : next();
};
const needsIdentity = (req, res, next) => {
  const fn = req.app.get('requireIdentity');
  return fn ? fn(req, res, next) : next();
};

/* ============================================================
   بلاغات المناديب — طلبات الاسترجاع والمشاكل الميدانية.

   كانت تُرسَل إلى /api/logs، وهو سجلّ أخطاء تقنية يحفظ حقولاً معلومة
   فقط: level, app, screen, message, detail, userId, userPhone, device.
   فكان المندوب يرسل ثلاثة عشر حقلاً في بلاغ الاسترجاع — رقم الطلب،
   الحالة، من يدفع، هل يحتفظ المندوب بأجرته، المبلغ، اسم الزبون
   ورقمه، المطعم — فتُحفظ منها أربعة ويُرمى الباقي بصمت.

   والأسوأ: يُقال للمندوب «وصل بلاغك للإدارة ✅ — انتظر ردّهم»،
   والبلاغ يقع بين رسائل الأعطال التقنية في تبويب الصحة، ولا وسيلة
   في اللوحة للردّ عليه أصلاً. فينتظر ردّاً لا يأتي، ويتصرّف في
   طلب فيه مال على مسؤوليته.

   هذه المجموعة مستقلة: تحفظ البلاغ كاملاً، ولها حالة (جديد /
   قيد المعالجة / مغلق)، وردّ الإدارة يُسجَّل عليها.
   ============================================================ */

// driver_declined ليس عطلاً بل إشارة عمل: لماذا يرفض المناديب طلبات
// مطعمٍ بعينه أو منطقةٍ بعينها؟ سؤال يستحق أن يُرى لا أن يُدفن في السجل.
const TYPES = ['return_request', 'driver_problem', 'driver_declined', 'other'];
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

// POST /api/reports — المندوب يرسل بلاغاً
router.post('/reports', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'قاعدة البيانات غير متصلة' });
    const b = req.body || {};

    const type = TYPES.includes(String(b.type)) ? String(b.type) : 'other';
    const entry = {
      type,
      status: 'new',                       // new | in_progress | closed
      // هوية المُبلِّغ من التوكن لا من الجسم — لا ينتحل أحد بلاغ غيره
      reporterId: String((req.user && req.user.userId) || ''),
      reporterName: clip(b.driverName, 80),
      reporterPhone: clip(b.driverPhone || b.myPhone, 20),

      orderId: clip(b.orderId, 60),
      case: clip(b.case || b.reason, 160),
      note: clip(b.note, 800),

      // الحقول المالية — هي سبب وجود البلاغ أصلاً
      whoPays: clip(b.whoPays, 60),
      driverKeepsFee: b.driverKeepsFee === true || b.driverKeepsFee === 'true',
      amount: Number(b.amount) || 0,

      restaurantId: clip(b.restaurantId, 60),
      restaurantName: clip(b.restaurantName, 120),
      customerName: clip(b.customerName, 120),
      customerPhone: clip(b.customerPhone, 20),

      message: clip(b.message, 300),
      adminReply: '',
      createdAt: new Date()
    };

    const ref = await db.collection('reports').add(entry);

    // نبّه اللوحة فوراً — البلاغ الميداني لا يحتمل انتظار استطلاع
    const io = req.app.get('socketio');
    if (io) io.emit('new_report', { id: ref.id, type, message: entry.message, orderId: entry.orderId });

    console.log(`🔔 بلاغ ${type} من ${entry.reporterName || entry.reporterId}: ${entry.message}`);
    res.status(201).json({ success: true, id: ref.id });
  } catch (e) {
    console.error('❌ خطأ حفظ بلاغ:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/reports — للإدارة
router.get('/reports', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json([]);
    const snap = await db.collection('reports').orderBy('createdAt', 'desc').limit(200).get();
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    const st = req.query.status;
    res.json(st ? list.filter(r => String(r.status) === String(st)) : list);
  } catch (e) {
    // ترتيب بلا فهرس قد يفشل — نُرجع بلا ترتيب بدل أن نُسقط التبويب
    try {
      const snap = await getDb(req).collection('reports').limit(200).get();
      const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      return res.json(list);
    } catch (e2) {
      res.status(500).json({ success: false, error: e2.message });
    }
  }
});

// PATCH /api/reports/:id — ردّ الإدارة وتغيير الحالة
router.patch('/reports/:id', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'قاعدة البيانات غير متصلة' });
    const b = req.body || {};
    const upd = {};
    if (b.status && ['new', 'in_progress', 'closed'].includes(String(b.status))) upd.status = String(b.status);
    if (b.adminReply !== undefined) { upd.adminReply = clip(b.adminReply, 800); upd.repliedAt = new Date(); }
    if (!Object.keys(upd).length) return res.status(400).json({ success: false, error: 'لا يوجد ما يُحدَّث' });

    const ref = db.collection('reports').doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'البلاغ غير موجود' });
    await ref.update(upd);

    /* ردّ الإدارة يصل المندوب في محادثته الخاصة.
       بدون هذا يبقى الردّ حبيس اللوحة والمندوب ينتظر في الشارع. */
    const r = snap.data() || {};
    if (upd.adminReply && r.reporterId) {
      const room = 'admin_driver_' + String(r.reporterId);
      try {
        await db.collection('chats').doc(room).collection('messages').add({
          orderId: room,
          text: `بخصوص بلاغك #${String(r.orderId || '').slice(0, 12)}:\n${upd.adminReply}`,
          senderId: 'admin_root',
          senderName: '📢 الإدارة',
          senderRole: 'manager',
          timestamp: Date.now(),
          createdAt: new Date()
        });
        const io = req.app.get('socketio');
        if (io) {
          io.to(room).emit('receive_message', {
            id: Date.now().toString(), orderId: room,
            senderId: 'admin_root', senderName: '📢 الإدارة', senderRole: 'manager',
            text: `بخصوص بلاغك: ${upd.adminReply}`,
            timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
          });
        }
      } catch (e) {
        console.warn('⚠️ تعذّر إيصال ردّ الإدارة للمندوب:', e.message);
      }
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
