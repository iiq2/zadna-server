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
const { quoteDelivery } = require('./zones');
const { notifyRestaurant, notifyDrivers, notifyCustomer } = require('./push');

/* نصّ الحالة كما يراه الزبون في الإشعار.
 *
 * أربع لحظات فقط تستحق أن تُوقظ جواله. كانت تسعاً، فيصل الزبون
 * إشعار عند كل خطوة داخلية للمندوب: قبل الطلب، وصل المطعم، استلم،
 * في الطريق — أربعة تنبيهات لشيء واحد. من يُزعَج هكذا يُطفئ إشعارات
 * التطبيق كلها، فنخسر حتى التنبيه المهم.
 *
 * والنصوص تُطمئن لا تُقلق: «بانتظار مندوب» يقرأها الزبون كأن طلبه
 * عالق، وهو ماشٍ عادي. لا نُطلعه على تفاصيل تشغيلنا الداخلية.
 *
 * الحالات المحذوفة عمداً: PREPARING (يكرّر ACCEPTED) ·
 * DRIVER_ASSIGNED و AT_RESTAURANT (شأن داخلي) · ON_THE_WAY (يكرّر PICKED_UP)
 */
const CUSTOMER_NOTE = {
  ACCEPTED:         ['المطعم قبل طلبك ✅', 'جارٍ تحضير طلبك الآن'],
  READY_FOR_PICKUP: ['طلبك جاهز 📦', 'المندوب في طريقه لاستلامه'],
  PICKED_UP:        ['المندوب استلم طلبك 🚀', 'في الطريق إليك الآن'],
  DELIVERED:        ['تم التوصيل ✅', 'صحتين وعافية — شكراً لطلبك من زادنا'],
  CANCELLED:        ['أُلغي الطلب ❌', 'تواصل معنا إن كان هناك خطأ'],
};

/* ============================================================
   تسعير الطلب — السيرفر هو من يحسب، لا التطبيق.

   كان `const orderData = req.body` يُحفظ كما ورد: لا سطر واحد يقارن
   المبلغ بأسعار المنيو. من يعدّل التطبيق أو يرسل الطلب مباشرة يشتري
   بشيكل واحد ما ثمنه مئتان — والرقم المزوَّر يصير هو الحقيقة المالية
   التي تُحسب عليها عمولتك ودين المندوب ومستحق المطعم.

   الآن: يرسل التطبيق الأصناف وكمياتها، والسيرفر يجلب أسعارها من
   المنيو ويحسب المجموع، ويتجاهل أي مبلغ مرسل.

   STRICT_ORDER_PRICING=1 على Render يرفض أي طلب بلا أصناف. اتركه
   مطفأً حتى يُحدِّث الجميع تطبيقاتهم، ثم شغّله ليُغلق الباب نهائياً.
   ============================================================ */
const STRICT_PRICING = process.env.STRICT_ORDER_PRICING === '1';
const r2 = (n) => Math.round(n * 100) / 100;

async function priceItems(db, restaurantId, items) {
  if (!Array.isArray(items) || items.length === 0) return null;

  // مصدر الأسعار: منيو المطعم، أو مجموعة المارت لطلبات المارت
  let priceOf = new Map();
  const isMart = String(restaurantId) === 'mart_001';
  if (isMart) {
    const ids = [...new Set(items.map(i => String(i.id)))].slice(0, 60);
    const snaps = await Promise.all(ids.map(id => db.collection('mart_products').doc(id).get()));
    snaps.forEach(s => { if (s.exists) priceOf.set(s.id, Number(s.data().price) || 0); });
  } else {
    const doc = await db.collection('restaurants').doc(String(restaurantId)).get();
    if (!doc.exists) return { error: 'المطعم غير موجود' };
    (doc.data().menu || []).forEach(m => priceOf.set(String(m.id), Number(m.price) || 0));
  }

  let total = 0;
  const unknown = [];
  for (const it of items) {
    const id = String(it.id || '');
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    if (!priceOf.has(id)) { unknown.push(id); continue; }
    // الإضافات يرسلها التطبيق كمبلغ لكل وحدة؛ نقبلها ضمن سقف معقول
    const extras = Math.max(0, Math.min(200, Number(it.extras) || 0));
    total += (priceOf.get(id) + extras) * qty;
  }
  if (unknown.length) return { error: 'أصناف غير موجودة في المنيو: ' + unknown.join(', ') };
  return { total: r2(total) };
}
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

      // ===== التسعير من السيرفر =====
      const priced = await priceItems(db, orderData.restaurantId, orderData.items);
      if (priced && priced.error) {
        return res.status(400).json({ success: false, error: priced.error });
      }
      if (priced) {
        const claimed = Number(orderData.totalAmount) || 0;
        if (Math.abs(claimed - priced.total) > 0.01) {
          console.warn(`💰 مبلغ مخالف للمنيو: أرسل ${claimed} والصحيح ${priced.total} | طلب ${orderId}`);
        }
        orderData.totalAmount = priced.total;
        orderData.amount = priced.total;
      } else {
        const msg = `طلب بلا أصناف — تعذّر التحقق من مبلغه (${orderData.totalAmount}) | ${orderId}`;
        if (STRICT_PRICING) {
          console.warn('⛔ ' + msg);
          return res.status(400).json({ success: false, error: 'حدّث التطبيق لإتمام الطلب' });
        }
        console.warn('⚠️ ' + msg);
      }

      // أجرة التوصيل تُحسب هنا أيضاً — كانت تصل من التطبيق كما يشاء
      try {
        const q = await quoteDelivery(db, {
          lat: orderData.customerLat, lng: orderData.customerLng,
          restaurantId: orderData.restaurantId, zone: orderData.deliveryZone
        });
        if (q && q.success && Number.isFinite(Number(q.fee))) {
          const sentFee = Number(orderData.deliveryFee) || 0;
          if (Math.abs(sentFee - Number(q.fee)) > 0.01) {
            console.warn(`🚚 أجرة مخالفة: أرسل ${sentFee} والصحيح ${q.fee} | طلب ${orderId}`);
          }
          orderData.deliveryFee = Number(q.fee);
        }
      } catch (e) { /* تعذّر التسعير: نُبقي المرسل ولا نُسقط الطلب */ }

      // المجموع الذي يدفعه الزبون يُشتقّ ولا يُستقبل
      orderData.grandTotal = r2((Number(orderData.totalAmount) || 0) + (Number(orderData.deliveryFee) || 0));

      // Save to Firestore
      //
      // create لا set: كان معرّف الطلب ستّ خانات من الميلي ثانية، تتكرّر
      // كل 16.67 دقيقة، و set تكتب فوق الموجود بصمت. عند ألف طلب يصير
      // احتمال أن طلباً دهس طلباً 39% — زبون دفع ومندوب سلّم ولا أثر.
      // create يرفض التكرار، فنولّد بديلاً بدل أن نمحو طلباً حقيقياً.
      let finalId = orderId;
      try {
        await db.collection('orders').doc(finalId).create({ ...orderData, id: finalId, createdAt: new Date() });
      } catch (e) {
        if (e && (e.code === 6 || /ALREADY_EXISTS/i.test(String(e.message)))) {
          finalId = `${orderId}-${Math.random().toString(36).slice(2, 7)}`;
          console.warn(`⚠️ تصادم معرّف طلب — أُنقذ الطلب القديم ووُلّد بديل: ${finalId}`);
          await db.collection('orders').doc(finalId).create({ ...orderData, id: finalId, createdAt: new Date() });
        } else throw e;
      }
      const savedId = finalId;

      console.log(`✅ [Firestore] تم حفظ طلب جديد: ${savedId}`);

      // Emit Real-time update
      // ملاحظة: نستعمل savedId لا orderId — عند التصادم يختلفان، وبثّ
      // الرقم القديم يجعل المندوب يفتح طلباً غير موجود.
      const io = req.app.get('socketio');
          if (io && isMart) {
                  io.emit('new_ready_order', {
                            orderId: savedId,
                            restaurantName: orderData.restaurant || 'زادنا مارت',
                            location: { lat: 32.2211, lng: 35.2622 }
                  });
          }

      /* إشعار المطعم بطلبه الجديد.
       *
       * كان البثّ لطلبات المارت وحدها. أما طلب المطعم فلا يُبثّ له شيء:
       * يجلس صاحب المطعم أمام شاشته والطلب محفوظ على السيرفر منذ لحظات
       * ولا يعلم به حتى يأتي الاستطلاع الدوري (45 ثانية) — والزبون في
       * تلك الأثناء ينتظر ويظن أن المطعم يتجاهله.
       *
       * order_updated يكفي: كل التطبيقات تسمعه أصلاً وتُعيد الجلب عنده،
       * فلا يحتاج الأمر حدثاً جديداً ولا تعديلاً في أي تطبيق. */
      if (io && !isMart) {
        io.emit('order_updated', {
          orderId: savedId,
          status: orderData.status || 'PENDING_RESTAURANT',
          restaurantId: orderData.restaurantId || '',
          isNew: true,
          timestamp: new Date()
        });
      }

      /* ===== الإشعارات =====
       * السوكت يكفي إن كان التطبيق مفتوحاً. وهو ليس مفتوحاً عادةً:
       * صاحب المطعم في المطبخ. لذلك الإشعار هو القناة الحقيقية. */
      const money = `${orderData.grandTotal || orderData.totalAmount || 0} ₪`;
      if (isMart) {
        // طلب مارت يذهب للمناديب مباشرة — لا مطعم يوافق عليه
        notifyDrivers(req.app, {
          title: 'طلب جاهز للاستلام 📦',
          body: `${orderData.restaurant || 'زادنا مارت'} — ${money}`,
          data: { orderId: savedId, type: 'new_ready_order' },
        }).catch(() => {});
      } else {
        notifyRestaurant(req.app, orderData.restaurantId, {
          title: 'طلب جديد وصلك 🔔',
          body: `${orderData.itemsSummary || 'طلب جديد'} — ${money}`,
          data: { orderId: savedId, type: 'new_order' },
        }).catch(() => {});
      }
      // الزبون: نجح الطلب — هنا تأتي أغنية زادنا
      notifyCustomer(req.app, orderData.customerPhone, {
        title: 'تم استلام طلبك 🎉',
        body: `طلبك من ${orderData.restaurant || 'زادنا'} — ${money}`,
        channel: 'success',
        data: { orderId: savedId, type: 'order_placed' },
      }).catch(() => {});

      // نحدّث الكاش مكانه بدل مسحه — يوفّر قراءة كاملة لكل طلب جديد

      updateCached('orders:all', list => [{ ...orderData, id: savedId }, ...list].slice(0, ORDERS_LIMIT));

      // نُعيد المبالغ التي أقرّها السيرفر ليعرضها التطبيق بدل أرقامه
      res.status(201).json({
        success: true,
        id: savedId,
        totalAmount: orderData.totalAmount,
        deliveryFee: orderData.deliveryFee,
        grandTotal: orderData.grandTotal
      });
    } catch (error) {
          console.error('❌ خطأ Firestore:', error);
          res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/orders
 */
router.get('/', needsIdentity, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) return res.json([]);
        let { restaurantId, driverId, customerPhone } = req.query;

        /* ===== النطاق يُفرض من التوكن، لا يُصدَّق من الاستعلام =====
         *
         * كان هذا المسار مفتوحاً بلا حارس، والفلاتر اختيارية: من يناديه بلا
         * أي فلتر يحصل على كل طلبات المنصة — أسماء الزبائن وأرقامهم وعناوين
         * بيوتهم ومبالغهم. أي متصفح، بلا حساب.
         *
         * الآن السيرفر يقرأ سجلّ صاحب التوكن ويشتقّ نطاقه بنفسه، ويتجاهل
         * ما أرسله التطبيق. فحتى لو عُدِّل التطبيق ليطلب طلبات غيره، لا يصله
         * إلا ما يخصّه. الإدارة وحدها تمرّ بلا تقييد.
         */
        if (!req.isAdmin) {
            const loadUser = req.app.get('loadUser');
            const me = loadUser ? await loadUser(req.user && req.user.userId) : null;
            if (!me) {
                return res.status(403).json({ success: false, error: 'تعذّر التعرّف على حسابك' });
            }
            const type = String(me.userType || 'customer');
            restaurantId = driverId = customerPhone = undefined;

            // المدير الداخل من التطبيق (لا من اللوحة بالمفتاح) يرى كل شيء،
            // وإلا عُومل كزبون فلا يرى إلا طلباته هو — وشاشة الإدارة تفرغ.
            if (type === 'manager' || type === 'admin') {
                restaurantId = req.query.restaurantId;
                driverId = req.query.driverId;
                customerPhone = req.query.customerPhone;
            } else if (type === 'driver') {
                driverId = String(me.id);
            } else if (type === 'restaurant') {
                if (!me.ownedRestaurantId) {
                    return res.json([]);   // مطعم بلا مطعم مرتبط: لا شيء يخصّه
                }
                restaurantId = String(me.ownedRestaurantId);
            } else {
                if (!me.phone) return res.json([]);   // زبون بلا رقم: لا طلبات بعد
                customerPhone = String(me.phone);
            }
        }

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

      /* ===== إشعارات تغيّر الحالة =====
       * السوكت يصل التطبيق المفتوح فقط. الزبون يضع جواله جانباً
       * وينتظر، والمندوب على الطريق — فالإشعار هو ما يصلهم فعلاً. */
      if (status) {
        // الزبون: نصّ مفهوم لكل حالة، ونغمة تناسبها
        const note = CUSTOMER_NOTE[status];
        if (note && cur.customerPhone) {
          // success للتسليم (أغنية زادنا) · arrived للحظة خروج المندوب
          // إليه · update للباقي. كانت arrived تُستعمل لـ«في الطريق»
          // وهي نغمة جرس الباب — تُوهم الزبون أن أحداً على بابه.
          const ch = status === 'DELIVERED' ? 'success'
                   : status === 'PICKED_UP' ? 'arrived'
                   : 'update';
          notifyCustomer(req.app, cur.customerPhone, {
            title: note[0], body: note[1], channel: ch,
            data: { orderId: String(id), type: 'status', status },
          }).catch(() => {});
        }
        // المناديب: صار في طلب جاهز
        if (status === 'READY_FOR_PICKUP') {
          const total = Number(cur.grandTotal || cur.totalAmount || 0);
          notifyDrivers(req.app, {
            title: 'طلب جاهز للاستلام 📦',
            body: `${cur.restaurant || 'مطعم'} — ${total} ₪`,
            data: { orderId: String(id), type: 'new_ready_order' },
          }).catch(() => {});
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
// مُصدَّرة للاختبار: مسار المال يستحق اختباراً مباشراً لا فحصاً بالنظر
module.exports.priceItems = priceItems;
