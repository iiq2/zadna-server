const express = require('express');
const router = express.Router();

// Get Firestore from app
const getDb = (req) => req.app.get('db');
const { cached, invalidate, updateCached } = require('../utils/cache');
// 5 دقائق: آمنة لأن كل إنشاء/تعديل طلب يُبطل الكاش فوراً،
// و Socket.io يدفع التحديث للأجهزة لحظياً. الاستطلاع مجرد شبكة أمان.
const ORDERS_TTL = 1800000;  // 30 دقيقة — الكاش يُحدَّث مكانه بعد كل كتابة
                             // فتبقى البيانات صحيحة، وهذه المدة شبكة أمان فقط
const ORDERS_LIMIT = 250;  // أحدث 250 طلباً — يغطي أيام العمل بوفرة

// =====================
// Routes - Orders
// =====================

/**
 * POST /api/orders
 */
router.post('/', async (req, res) => {
    try {
          const db = getDb(req);
          const orderData = req.body;

      // Ensure ID is set
      const orderId = orderData.id || 'ORD_' + Date.now();

      // Check if Mart Order
      const isMart = orderData.restaurantId === 'mart_001';
          if (isMart) {
                  orderData.statusAr = "جاهز للتسليم 📦";
                  orderData.status = "READY_FOR_PICKUP";
          }

      // Save to Firestore
      await db.collection('orders').doc(orderId).set({
              ...orderData,
              createdAt: new Date()
      });

      console.log(`✅ [Firestore] تم حفظ طلب جديد: ${orderId}`);

      // Emit Real-time update
      const io = req.app.get('socketio');
          if (io && isMart) {
                  io.emit('new_ready_order', {
                            orderId: orderId,
                            restaurantName: orderData.restaurant || 'زادنا مارت',
                            location: { lat: 32.2211, lng: 35.2622 }
                  });
          }

      // نحدّث الكاش مكانه بدل مسحه — يوفّر قراءة كاملة لكل طلب جديد

      updateCached('orders:all', list => [{ ...orderData, id: orderId }, ...list].slice(0, ORDERS_LIMIT));


      res.status(201).json({ success: true, id: orderId });
    } catch (error) {
          console.error('❌ خطأ Firestore:', error);
          res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/orders
 */
router.get('/', async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) return res.json([]);
        const { restaurantId } = req.query;

        // نقرأ المجموعة كاملة مرة واحدة ونُخزّنها، ثم نفلتر في الذاكرة.
        // الفلترة داخل Firestore كانت تعني قراءة جديدة لكل مطعم ولكل استطلاع.
        const all = await cached('orders:all', ORDERS_TTL, async () => {
            // سقف القراءة: مجموعة الطلبات تكبر بلا حد، وبدون سقف تصير كل
            // قراءة أغلى يوماً بعد يوم حتى تلتهم الحصة وحدها.
            const snapshot = await db.collection('orders')
                .orderBy('createdAt', 'desc')
                .limit(ORDERS_LIMIT)
                .get();
            const list = [];
            snapshot.forEach(doc => list.push(doc.data()));
            return list;
        });

        const filtered = restaurantId
            ? all.filter(o => o.restaurantId === restaurantId)
            : all;

        // نُرفق رقم المطعم مع كل طلب ليتصل به المندوب وقت الاستلام.
        // نقرأه من نفس كاش المطاعم، فلا يكلّف قراءة إضافية.
        let phoneById = {};
        try {
            const rests = await cached('restaurants:raw', 600000, async () => {
                const snap = await db.collection('restaurants').get();
                const list = [];
                snap.forEach(d => list.push({ id: d.id, ...d.data() }));
                return list;
            });
            rests.forEach(r => { if (r.phone) phoneById[String(r.id)] = String(r.phone); });
        } catch (e) { /* بلا أرقام أفضل من فشل الطلب كله */ }

        const orders = filtered.map(o => ({
            ...o,
            restaurantPhone: o.restaurantPhone || phoneById[String(o.restaurantId)] || ''
        }));

        res.json(orders);
    } catch (error) {
        console.error('❌ خطأ GET Firestore:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});



/**
 * PATCH /api/orders/:id
 */
router.patch('/:id', async (req, res) => {
    try {
          const db = getDb(req);
          const { id } = req.params;
          const { status, driver } = req.body;

      const updateData = {};
          if (status) {
                  updateData.status = status;
                  updateData.statusAr = status === 'ON_THE_WAY' ? 'في الطريق إليك 🛵' :
                                              status === 'DELIVERED' ? 'تم التسليم ✅' :
                                              status === 'PREPARING' ? 'قيد التحضير 👨‍🍳' : status;
          }
          if (driver) updateData.driver = driver;

      const docRef = db.collection('orders').doc(id);
    if (!(await docRef.get()).exists) {
      return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    }
    await docRef.update(updateData);

      // Notify via sockets
      const io = req.app.get('socketio');
      if (io) {
        io.emit('order_updated', { orderId: id, ...updateData, timestamp: new Date() });
        // الطلب صار جاهزاً → أبلغ كل المناديب فوراً
        if (status === 'READY_FOR_PICKUP') {
          const snap2 = await docRef.get();
          const o = snap2.exists ? snap2.data() : {};
          io.emit('new_ready_order', {
            orderId: id,
            restaurantName: o.restaurant || 'زادنا',
            location: o.location || { lat: 32.2211, lng: 35.2622 }
          });
        }
      }

      updateCached('orders:all', list => list.map(o => (String(o.id) === String(id) ? { ...o, ...updateData } : o)));


      res.json({ success: true });
    } catch (error) {
          console.error('❌ Error updating order:', error);
          res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
