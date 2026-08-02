const express = require('express');
const router = express.Router();

// Get Firestore from app
const getDb = (req) => req.app.get('db');
/** إنشاء طلب أو تغيير حالته يتطلب هوية — كان أي أحد يعلّم أي طلب "تم التسليم". */
const needsIdentity = (req, res, next) => {
  const fn = req.app.get('requireIdentity');
  return fn ? fn(req, res, next) : next();
};
const { cached, invalidate, updateCached } = require('../utils/cache');
// 5 دقائق: آمنة لأن كل إنشاء/تعديل طلب يُبطل الكاش فوراً،
// و Socket.io يدفع التحديث للأجهزة لحظياً. الاستطلاع مجرد شبكة أمان.
const ORDERS_TTL = 1800000;  // 30 دقيقة — الكاش يُحدَّث مكانه بعد كل كتابة
                             // فتبقى البيانات صحيحة، وهذه المدة شبكة أمان فقط
const ORDERS_LIMIT = 250;

// الترجمة العربية لكل الحالات. كانت ناقصة فتُخزَّن الحالات غير المذكورة
// باسمها الإنجليزي ويراها الزبون هكذا: "AT_RESTAURANT" بدل نص مفهوم.
const STATUS_AR = {
  PENDING_RESTAURANT: 'بانتظار موافقة المطعم ⏳',
  ACCEPTED:           'المطعم قبل طلبك ✅',
  PREPARING:          'قيد التحضير 👨‍🍳',
  READY_FOR_PICKUP:   'جاهز — بانتظار مندوب 📦',
  DRIVER_ASSIGNED:    'المندوب قبل الطلب 🛵',
  AT_RESTAURANT:      'المندوب وصل المطعم 📍',
  PICKED_UP:          'المندوب استلم طلبك وفي الطريق إليك 🚀',
  ON_THE_WAY:         'المندوب في الطريق إليك 🛵',
  DELIVERED:          'تم التوصيل ✅',
  CANCELLED:          'ملغي ❌'
};  // أحدث 250 طلباً — يغطي أيام العمل بوفرة

// =====================
// Routes - Orders
// =====================

/**
 * POST /api/orders
 */
router.post('/', needsIdentity, async (req, res) => {
    try {
          const db = getDb(req);
          const orderData = req.body;

      // Ensure ID is set
      const orderId = orderData.id || 'ORD_' + Date.now();

      // Check if Mart Order
      // طلبات المارت تذهب للمناديب مباشرة — لا مطعم يوافق عليها.
      // كان الفحص بالمعرّف فقط بينما التطبيق يفحص الاسم أيضاً؛ أي اختلاف
      // بينهما يترك طلب مارت عالقاً في "بانتظار موافقة المطعم" إلى الأبد.
      const restNameRaw = String(orderData.restaurant || orderData.restaurantName || '');
      const isMart = orderData.restaurantId === 'mart_001'
        || restNameRaw.includes('مارت')
        || restNameRaw.toLowerCase().includes('mart');
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
        const { restaurantId, driverId, customerPhone } = req.query;

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

        // مفتاح المندوب على الطلب قد يكون كائناً متداخلاً أو حقلاً مسطّحاً
        const drvKeyOf = (o) => {
            if (o.driver && typeof o.driver === 'object') {
                return String(o.driver.id || o.driver.phone || o.driver.name || '');
            }
            return String(o.driverId || '');
        };
        // الطلب متاح لأي مندوب ما دام لم يقبله أحد
        const UNASSIGNED = ['READY_FOR_PICKUP', 'PENDING_RESTAURANT', 'ACCEPTED', 'PREPARING'];

        let filtered = all;
        if (restaurantId) {
            filtered = filtered.filter(o => o.restaurantId === restaurantId);
        }
        if (customerPhone) {
            // بدونها كان كل زبون يرى طلبات كل زبائن المنصة بأسمائهم وأرقامهم
            const want = String(customerPhone).trim();
            filtered = filtered.filter(o => String(o.customerPhone || '').trim() === want);
        }
        if (driverId) {
            // كان أي مندوب يرى طلبات كل المناديب ويستطيع تعليمها "تم التوصيل"
            filtered = filtered.filter(o =>
                drvKeyOf(o) === String(driverId) || UNASSIGNED.includes(String(o.status))
            );
        }

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
router.patch('/:id', needsIdentity, async (req, res) => {
    try {
          const db = getDb(req);
          const { id } = req.params;
          const { status, driver } = req.body;

      const updateData = {};
          if (status) {
                  updateData.status = status;
                  updateData.statusAr = STATUS_AR[status] || status;
          }
          if (driver) updateData.driver = driver;

      const docRef = db.collection('orders').doc(id);
      const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    }

    // ===== من يملك حق تعديل هذا الطلب؟ =====
    //
    // كان needsIdentity يتحقق من وجود توكن صالح فقط — أي حساب مسجّل، زبوناً
    // كان أو مندوباً. فكان بإمكان أي أحد أن يضع نفسه مندوباً على طلب غيره
    // ثم يعلّمه «تم التوصيل»، فتُنسب أرباحه إليه ويخسر المندوب الحقيقي حقه،
    // بل ويمكن تلفيق طلبات مسلَّمة وهمية تُفسد كل الأرقام المالية.
    const cur = snap.data() || {};
    const curDrvKey = cur.driver && typeof cur.driver === 'object'
      ? String(cur.driver.id || cur.driver.phone || '')
      : String(cur.driverId || '');
    const meId = String(req.user?.userId || '');
    const UNASSIGNED_STATES = ['READY_FOR_PICKUP', 'PENDING_RESTAURANT', 'ACCEPTED', 'PREPARING'];

    if (!req.isAdmin) {
      const isOwner = curDrvKey && meId && curDrvKey === meId;
      const isFreeToTake = !curDrvKey || UNASSIGNED_STATES.includes(String(cur.status));

      if (!isOwner && !isFreeToTake) {
        console.warn('🔒 محاولة تعديل طلب ليس لصاحبها:', id, '| الطلب لـ:', curDrvKey, '| الطالب:', meId);
        return res.status(403).json({
          success: false,
          error: 'هذا الطلب مُسند لمندوب آخر'
        });
      }
      // لا يجوز لأحد أن ينسب الطلب لغيره — يأخذه لنفسه أو لا يأخذه
      if (driver) {
        const newKey = String(driver.id || driver.phone || '');
        if (meId && newKey && newKey !== meId) {
          return res.status(403).json({
            success: false,
            error: 'لا يمكن إسناد الطلب لحساب آخر'
          });
        }
      }
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
