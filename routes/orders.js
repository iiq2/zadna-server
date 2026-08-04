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
const { priceMartItems } = require('./mart');
const meter = require('../utils/meter');
/* المصدر الوحيد لكل رقم مالي. التطبيقات الثلاثة واللوحة تعرض ما يأتي
 * من هنا ولا يحسب أيٌّ منها شيئاً — انظر utils/money.js. */
const { breakdown, applyPayment } = require('../utils/money');

/* رسالة الخطأ للزبون: عربية ومفيدة، والتفصيل يُسجَّل عندنا لا يُرسَل إليه.
   نأخذها من السيرفر ليكون لسان المنصّة واحداً في كل مسار. */
const fail = (req, res, error, what) => {
  const fn = req.app.get('failJson');
  if (fn) return fn(res, error, what);
  console.error(`❌ ${what}:`, error && error.message);
  return res.status(500).json({ success: false, error: 'تعذّر إتمام العملية — أعد المحاولة' });
};


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
  const doc = await db.collection('restaurants').doc(String(restaurantId)).get();
  if (!doc.exists) return { error: 'المحل غير موجود' };
  const partner = doc.data() || {};

  /* السوبرماركت يُسعَّر من كتالوجه هو.
   *
   * كان الشرط `restaurantId === 'mart_001'` وحده — أي مارت واحد في
   * الدنيا، وأسعاره في مجموعة عامة يكتب فيها الجميع فوق الجميع.
   * الآن لكل محلّ كتالوجه، ولكل صنف وحداته وأسعاره التي وضعها صاحبه.
   *
   * والفرق الجوهري عن المطعم: هناك سعر واحد للصنف، وهنا سعر لكل
   * وحدة — كيلو البندورة غير حبّتها. لذلك مسار حساب مستقلّ لا شرط
   * داخل المسار نفسه. */
  const isMart = String(partner.partnerType || '') === 'market'
    || String(restaurantId) === 'mart_001';
  if (isMart) {
    return await priceMartItems(db, restaurantId, items);
  }

  const priceOf = new Map();
  (partner.menu || []).forEach(m => priceOf.set(String(m.id), Number(m.price) || 0));

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

      /* صاحب الطلب — من التوكن لا من الجسم.
       *
       * الرقم وحده لا يكفي هويةً: صفحة الدفع تسمح بتعديله، فيطلب
       * الزبون برقم زوجته أو بصيغة أخرى، ثم يُمنع من شات طلبه هو
       * لأن الحارس لا يعرفه. والمعرّف من التوكن لا يُنتحل ولا يتبدّل.
       *
       * ولا نقبله من الجسم: من يرسله بنفسه ينسب طلبه لغيره. */
      orderData.customerId = String((req.user && req.user.userId) || '');

      /* رقم الزبون يُطبَّع قبل الحفظ.
       * صفحة الدفع تسمح بتعديل الرقم، فيُكتب بأربع صور مختلفة لنفس
       * الجوال. وطلبٌ حُفظ بصيغة غير صيغة حساب صاحبه يسقط من سجلّه،
       * ولا يصله إشعاره، ويُردّ عن شات طلبه. نُوحّده هنا مرّة واحدة. */
      const normPhoneFn = req.app.get('normPhone');
      if (normPhoneFn && orderData.customerPhone) {
        orderData.customerPhone = normPhoneFn(orderData.customerPhone);
      }

      // Ensure ID is set
      const orderId = orderData.id || 'ORD_' + Date.now();

      // Check if Mart Order
      // طلبات المارت تذهب للمناديب مباشرة — لا مطعم يوافق عليها.
      // كان الفحص بالمعرّف فقط بينما التطبيق يفحص الاسم أيضاً؛ أي اختلاف
      // بينهما يترك طلب مارت عالقاً في "بانتظار موافقة المطعم" إلى الأبد.
      /* ============================================================
         «أهذا طلب ماركت؟» — يُسأل المستند لا الاسم.

         كان الفحص بالمعرّف `mart_001` وبكلمة «مارت» في الاسم. وكلاهما
         سقط يوم صار لكل سوبرماركت معرّفه (`mkt_...`) واسمه الحقيقي
         («سوبرماركت الأمين» لا تحوي كلمة مارت).

         وأثر السقوط أن طلب الماركت يُحفظ `PENDING_RESTAURANT` — أي
         بانتظار موافقة محلٍّ قد لا يفتح تطبيقه أصلاً، فيعلق الطلب ولا
         يصل مندوباً ولا يعرف الزبون لماذا.

         الحقيقة في `partnerType` على مستند المحلّ — وهو ما يقرؤه
         التسعير في هذا الملفّ نفسه. نقرأه مرّة ونستعمله للاثنين.
         ============================================================ */
      let isMart = false;
      if (orderData.restaurantId) {
        try {
          const pDoc = await db.collection('restaurants').doc(String(orderData.restaurantId)).get();
          isMart = pDoc.exists && String((pDoc.data() || {}).partnerType || '') === 'market';
        } catch (e) {
          console.warn('⚠️ تعذّر تمييز نوع الشريك:', e.message);
        }
      }
      // معرّف المارت القديم يبقى مقبولاً للطلبات المحفوظة قبل التحوّل
      if (orderData.restaurantId === 'mart_001') isMart = true;

      if (isMart) {
        /* الماركت لا يوافق: بضاعته على الرفّ لا في المطبخ. الطلب يذهب
         * للمناديب مباشرة، والمندوب يلتقط الأصناف ويوصّلها. */
        orderData.statusAr = "جاهز للتسليم 📦";
        orderData.status = "READY_FOR_PICKUP";
        orderData.isMarketOrder = true;   // يقرؤه التطبيق فلا يقول «ننتظر موافقة المطعم»
      }

      /* ============================================================
         المطعم المغلق لا يستقبل طلباً.

         كان صاحب المطعم يُطفئ مفتاح «مفتوح» ويقفل مطبخه ويمشي، ثم
         تصله طلبات. والسبب أن الإغلاق كان يعمل في مكان واحد: إخفاء
         المطعم من قائمة الزبون. لكن الزبون الذي فتح صفحة المطعم قبل
         الإغلاق بدقيقة، أو جاء من إشعار أو من سجلّ طلباته، تبقى
         الصفحة مفتوحة عنده ويكمل طلبه بلا أن يعلم شيئاً.

         والنتيجة أسوأ من رفضٍ صريح: زبونٌ ينتظر طعاماً لن يُطبخ،
         ومندوبٌ يذهب إلى محلٍّ مغلق، وشريكٌ يُتَّهم بإهمال طلب لم يره.

         الإخفاء واجهة؛ وهذا هو المنع. والفحص هنا لأن السيرفر هو الوحيد
         الذي يعرف الحالة لحظةَ الطلب لا لحظةَ فتح الشاشة.

         والمارت **يمرّ من هنا أيضاً** — وكان مستثنى، وكانت ثغرةً لا
         استثناءً: عبارة «لا مطعم يوافق عليه» صحيحةٌ عن الموافقة، لكن
         الفحص هنا ليس موافقة — هو بوابة المغلق والمجمّد. فماركتٌ
         جمّدتَه من اللوحة، أو أغلقه صاحبه ومشى، كان يواصل استقبال
         الطلبات وتذهب `READY_FOR_PICKUP` مباشرة: المندوب يُساق إلى
         بابٍ مقفل، والزبون ينتظر بضاعة من محلٍّ لا يعمل.

         (شاشة «أقرب ماركت» تعرض المفتوح فقط — لكنها لقطةُ لحظةِ الفتح:
         من فتحها قبل الإغلاق بدقيقة تبقى سلّته حيّةً وتُرسل.)

         ونحتفظ بمستند المحلّ في `shopDoc` — إحداثياته تلزم بعد أسطر
         لترتيب «أقرب مندوب أولاً»، فلا نقرأ المستند مرّتين.
         ============================================================ */
      let shopDoc = null;
      if (orderData.restaurantId) {
        try {
          const rDoc = await db.collection('restaurants').doc(String(orderData.restaurantId)).get();
          if (!rDoc.exists) {
            return res.status(404).json({ success: false, error: 'هذا المحلّ لم يعد موجوداً' });
          }
          const r = rDoc.data() || {};
          shopDoc = r;
          const kindAr = isMart ? 'السوبرماركت' : 'المطعم';
          if (r.isOpen === false) {
            return res.status(409).json({
              success: false, restaurantClosed: true,
              error: `${r.name || kindAr} مغلق الآن ولا يستقبل طلبات. ${isMart ? 'جرّب لاحقاً — أو حدّث الشاشة ليظهر الأقرب المفتوح.' : 'جرّب مطعماً آخر أو عُد لاحقاً.'}`
            });
          }
          if (r.status && r.status !== 'approved') {
            return res.status(409).json({
              success: false, restaurantClosed: true,
              error: `هذا ${kindAr} غير متاح حالياً`
            });
          }
        } catch (e) {
          /* عطلٌ في القراءة لا يُسقط طلباً سليماً — الأصل أن المحلّ
           * مفتوح، وهذه الحالة نادرة ومسجَّلة كي تُرى إن تكرّرت. */
          console.warn('⚠️ تعذّر فحص حالة المحلّ قبل الطلب:', e.message);
        }
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

      /* المجموع وكل تفصيل مالي يُشتقّ هنا ولا يُستقبل، ويُخزَّن داخل
       * الطلب نفسه. سببان لتخزينه لا حسابه عند القراءة:
       *   ١ · النِّسَب قد تتغيّر على Render، وطلبٌ سُلّم بنسبة قديمة يجب
       *       أن يبقى محاسَباً بها — وإلا اختلفت التسوية عن يوم التسليم.
       *   ٢ · اللوحة والتطبيقات تقرأ الرقم نفسه حرفياً، فلا مجال لخلاف. */
      /* طريقة الدفع تُثبَّت من السيرفر لا من التطبيق.
       *
       * كلّها `cash` اليوم — البوابة لم تُربط بعد. لكن الحقول تُكتب من
       * الآن كي لا نُهاجر بيانات ألف طلب يوم تُربط. ولا نقبل `paid` من
       * التطبيق أبداً: من يقول «دفعتُ» هو مزوّد الدفع عبر مساره الخاص،
       * لا الجهاز الذي بيد الزبون. */
      const askedMethod = String(orderData.paymentMethod || 'cash');
      orderData.paymentMethod = ['cash', 'wallet', 'card'].includes(askedMethod) ? askedMethod : 'cash';
      orderData.paymentStatus = 'pending';
      orderData.paidOnline = false;
      // الخصم صفرٌ حتى تُبنى الكوبونات — والحقل موجود ليُحسب صحيحاً حين تُبنى
      orderData.discount = 0;
      orderData.discountBy = 'restaurant';   // العروض من المطاعم — قرار العمل

      const m = applyPayment(breakdown(orderData), orderData);
      orderData.grandTotal = m.grandTotal;
      orderData.money = m;

      // Save to Firestore
      //
      // create لا set: كان معرّف الطلب ستّ خانات من الميلي ثانية، تتكرّر
      // كل 16.67 دقيقة، و set تكتب فوق الموجود بصمت. عند ألف طلب يصير
      // احتمال أن طلباً دهس طلباً 39% — زبون دفع ومندوب سلّم ولا أثر.
      // create يرفض التكرار، فنولّد بديلاً بدل أن نمحو طلباً حقيقياً.
      let finalId = orderId;
      /* createdAt يُكتب على orderData نفسه لا داخل نداء الحفظ وحده.
       *
       * كان `createdAt: new Date()` يُضاف في سطر الحفظ فيصل مستندَ
       * Firestore ولا يصل نسخةَ الكاش (تُدفع orderData كما هي). فطلبٌ
       * جديد يعيش في الكاش **بلا تاريخ**، وقارئ التاريخ القديم كان
       * يحوّل الفراغ إلى سنة ٢٠٠٠ — فرأت المكنسة طلباً عمره ٢٦ سنة
       * وألغته بعد خمس ثوانٍ من إنشائه. هذا ما أخفى طلب المارت 642443. */
      orderData.createdAt = new Date();
      try {
        await db.collection('orders').doc(finalId).create({ ...orderData, id: finalId });
      } catch (e) {
        if (e && (e.code === 6 || /ALREADY_EXISTS/i.test(String(e.message)))) {
          finalId = `${orderId}-${Math.random().toString(36).slice(2, 7)}`;
          console.warn(`⚠️ تصادم معرّف طلب — أُنقذ الطلب القديم ووُلّد بديل: ${finalId}`);
          await db.collection('orders').doc(finalId).create({ ...orderData, id: finalId });
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
        /* طلب مارت يذهب للمناديب مباشرة — لا موافقة تسبقه.
         *
         * ومعه إحداثيات المحلّ (من `shopDoc` الذي قرأته البوابة
         * أعلاه): كانت تُغفَل هنا وحدها، فيتعطّل ترتيب «الأقرب أولاً»
         * لطلبات المارت بالذات ويُقصف كل المناديب بالتساوي. */
        notifyDrivers(req.app, {
          title: 'طلب جاهز للاستلام 📦',
          body: `${orderData.restaurant || 'زادنا مارت'} — ${money}`,
          data: { orderId: savedId, type: 'new_ready_order' },
          restaurantLat: shopDoc ? Number(shopDoc.lat) : undefined,
          restaurantLng: shopDoc ? Number(shopDoc.lng) : undefined,
        }).catch(() => {});

        /* وصاحب الماركت يُخطَر — وكان لا يُخطَر إطلاقاً.
         *
         * «لا موافقة عليه» صارت تُقرأ «لا إشعار له»، وهما شيئان:
         * لا يوافق، لكنه **يجهّز**. بدون هذا الإشعار لا يعلم بالطلب
         * إلا إن صادف تطبيقه مفتوحاً على السوكت — فيصل المندوب إلى
         * الرفوف ولا أحد جمع شيئاً، وينتظر واقفاً ما كان يجب أن
         * يكون جاهزاً قبل وصوله. */
        notifyRestaurant(req.app, orderData.restaurantId, {
          title: 'طلب جديد — جهّز الأصناف 🛒',
          body: `${orderData.itemsSummary || 'طلب'} — ${money} · المندوب في الطريق`,
          data: { orderId: savedId, type: 'new_order' },
        }).catch(() => {});
      } else {
        notifyRestaurant(req.app, orderData.restaurantId, {
          title: 'طلب جديد وصلك 🔔',
          body: `${orderData.itemsSummary || 'طلب جديد'} — ${money}`,
          data: { orderId: savedId, type: 'new_order' },
        }).catch(() => {});
      }
      /* الزبون: وصلنا طلبك — بنغمة تحديث، لا بالأغنية.
       *
       * كانت الأغنية تعمل هنا وعند التسليم معاً، فيسمعها الزبون
       * مرّتين في الطلب الواحد. واللحن الذي يتكرّر يفقد معناه:
       * يصير صوتاً كأي صوت، ثم يُملّ، ثم يُطفأ.
       *
       * مكانها الصحيح لحظة واحدة: حين يمسك طلبه بيده. عندها تكون
       * خاتمةً يتذكّرها، لا إشعاراً يمرّ. */
      notifyCustomer(req.app, orderData.customerPhone, {
        title: 'تم استلام طلبك 🎉',
        body: `طلبك من ${orderData.restaurant || 'زادنا'} — ${money}`,
        channel: 'update',
        data: { orderId: savedId, type: 'order_placed' },
      }).catch(() => {});

      // نحدّث الكاش مكانه بدل مسحه — يوفّر قراءة كاملة لكل طلب جديد

      updateCached('orders:all', list => [{ ...orderData, id: savedId }, ...list].slice(0, ORDERS_LIMIT));

      /* نُعيد المبالغ التي أقرّها السيرفر ليعرضها التطبيق بدل أرقامه،
       * و`id` هو **المعرّف المحفوظ فعلاً** لا الذي أرسله التطبيق: عند
       * تصادم يولّد السيرفر بديلاً، وتطبيقٌ يتابع معرّفه القديم يفتح
       * شاشة تتبّع لطلب غير موجود. */
      res.status(201).json({
        success: true,
        id: savedId,
        totalAmount: orderData.totalAmount,
        deliveryFee: orderData.deliveryFee,
        grandTotal: orderData.grandTotal,
        money: orderData.money
      });
    } catch (error) {
          return fail(req, res, error, 'إنشاء طلب');
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
        // هل يتصفّح بصلاحية إدارة؟ (بمفتاح الإدارة أو بحساب مدير)
        let asManager = !!req.isAdmin;
        let myUserId = '';   // يُملأ بعد التعرّف — يُطابَق به الطلب حين يختلف شكل الرقم
        if (!req.isAdmin) {
            const loadUser = req.app.get('loadUser');
            const me = loadUser ? await loadUser(req.user && req.user.userId) : null;
            if (!me) {
                return res.status(403).json({ success: false, error: 'تعذّر التعرّف على حسابك' });
            }
            const type = String(me.userType || 'customer');
            const myId = String(me.id), myPhone = String(me.phone || '');
            myUserId = myId;
            const myRest = String(me.ownedRestaurantId || '');
            const q = req.query;
            restaurantId = driverId = customerPhone = undefined;

            /* القاعدة: يحقّ لك أن تطلب أي نطاق تُثبت أنه لك.
             *
             * كنت أشتقّ النطاق من userType وحده. وهذا يكسر كل حالة يعمل
             * فيها شخص بأكثر من دور — وهي الحالة الطبيعية عندنا: صاحب
             * المنصّة يوصّل بنفسه، وصاحب مطعم قد يكون مندوباً أيضاً.
             * فحسابٌ نوعه «مطعم» يفتح تطبيق الكابتن ويقبل طلباً، ثم
             * يختفي الطلب من أمامه لأن السيرفر أعطاه طلبات مطعمه لا
             * طلباته كمندوب — وهو ماسكٌ الطلب بيده.
             *
             * الأمان محفوظ: لا يُقبل إلا ما يطابق هويتك المسجّلة.
             */
            if (type === 'manager' || type === 'admin') {
                asManager = true;
                restaurantId = q.restaurantId; driverId = q.driverId; customerPhone = q.customerPhone;
            } else {
                if (q.driverId && (String(q.driverId) === myId || (myPhone && String(q.driverId) === myPhone))) {
                    driverId = String(q.driverId);
                }
                if (q.restaurantId && myRest && String(q.restaurantId) === myRest) {
                    restaurantId = myRest;
                }
                // مقارنة مُطبَّعة: التطبيق قد يرسل الرقم بصيغة تختلف عن
                // المحفوظة في الحساب، فيسقط النطاق ويُحرم صاحبه من طلباته
                const sp = req.app.get('samePhone') || ((a, b) => String(a) === String(b));
                if (q.customerPhone && myPhone && sp(q.customerPhone, myPhone)) {
                    customerPhone = myPhone;
                }
                // لم يطلب نطاقاً صالحاً؟ نُعطيه نطاقه الافتراضي حسب نوعه
                if (!driverId && !restaurantId && !customerPhone) {
                    if (type === 'driver') driverId = myId;
                    else if (type === 'restaurant' && myRest) restaurantId = myRest;
                    else if (myPhone) customerPhone = myPhone;
                    else return res.json([]);
                }
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
            meter.addReads(snapshot.size, 'الطلبات');
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
            /* بدونها كان كل زبون يرى طلبات كل زبائن المنصة بأسمائهم وأرقامهم.
             *
             * لكن المطابقة كانت **نصّية حرفية**، فكل طلب حُفظ برقمٍ بصيغة
             * مختلفة (‎+970‎ · ‎00972‎ · شرطة · مسافة) يسقط من سجلّ صاحبه —
             * فيرى الزبون تاريخه وقد مُحي، ويظنّ أننا حذفنا طلباته.
             * والطلب لم يُمسّ: هو في قاعدة البيانات ولا يُطابَق.
             *
             * نطابق الآن بمعرّف الحساب أولاً — وهو لا يتغيّر شكله — ثم
             * بالرقم مُطبَّعاً. `samePhone` هي نفسها التي يستعملها الدخول. */
            const samePhone = req.app.get('samePhone') || ((a, b) => String(a).trim() === String(b).trim());
            const want = String(customerPhone).trim();
            filtered = filtered.filter(o =>
                (myUserId && o.customerId && String(o.customerId) === myUserId)
                || samePhone(o.customerPhone, want)
            );
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
                meter.addReads(snap.size, 'المطاعم');
                return list;
            });
            rests.forEach(r => { if (r.phone) phoneById[String(r.id)] = String(r.phone); });
        } catch (e) { /* بلا أرقام أفضل من فشل الطلب كله */ }

        /* ============================================================
           رقم الزبون للمندوب وحده.

           المطعم والسوبرماركت لا يتّصلان بالزبون — التواصل رسائل، وما
           استُشكل يأتي للإدارة. وشاشاتهما لا تعرض الرقم فعلاً، لكن
           السيرفر كان **يرسله في الاستجابة**: موجود في ذاكرة التطبيق،
           وفي أي أداة تُراقب الشبكة، وفي أي نسخة معدَّلة من التطبيق.
           إخفاؤه في الواجهة ليس حمايةً — الحماية أن لا يُرسَل.

           والقرار على **النطاق الممنوح لا على نوع الحساب**: صاحب حساب
           «مطعم» يعمل مندوباً — وهي حالتك — يرى الرقم حين يتصفّح
           كمندوب، ولا يراه حين يتصفّح كمطعم. الدور لحظتها هو الفيصل،
           لا ما كُتب في سجلّه.
           ============================================================ */
        const hideCustomerPhone = !asManager && !!restaurantId && !driverId && !customerPhone;

        const orders = filtered.map(o => {
            const out = {
                ...o,
                restaurantPhone: o.restaurantPhone || phoneById[String(o.restaurantId)] || '',
                /* الطلبات التي أُنشئت قبل وحدة المال لا تحمل الحقل، فنحسبه
                 * لحظة الإرجاع. الجديدة تحمله مخزَّناً فنُبقيه كما هو —
                 * لأن طلباً سُلّم بنسبة قديمة يجب أن يبقى محاسَباً بها. */
                money: o.money || applyPayment(breakdown(o), o)
            };
            if (hideCustomerPhone) delete out.customerPhone;
            return out;
        });

        res.json(orders);
    } catch (error) {
        return fail(req, res, error, 'جلب الطلبات');
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
      /* المندوب له هويتان: معرّف حسابه ورقم هاتفه — والقبول قد يسجّل
       * أيّاً منهما في `driver.id` (نسخ التطبيق القديمة ترسل الرقم).
       *
       * كانت المقارنة بالمعرّف وحده، فمن قُبل طلبه برقمه يضغط «تم
       * التوصيل» فيُرفض 403 «مُسند لمندوب آخر» — **لصاحبه نفسه**.
       * التطبيق يُرجع البطاقة (revert) فيراها المندوب «تروح وترجع»
       * ولا يفهم لماذا، والطلب لا يُغلق أبداً.
       *
       * نقبل الآن أيّ الهويتين، والرقم مُطبَّعاً — فـ+970 والصيغة
       * المحلية رقمٌ واحد. */
      const sp = req.app.get('samePhone') || ((a, b) => String(a) === String(b));
      const me = await (req.app.get('loadUser')?.(meId));
      const mePhone = String(me?.phone || '');
      const isOwner = !!curDrvKey && (
        curDrvKey === meId ||
        (mePhone && sp(curDrvKey, mePhone))
      );
      const isFreeToTake = !curDrvKey || UNASSIGNED_STATES.includes(String(cur.status));

      /* صاحب المطعم يتحكّم بمراحل مطبخه دائماً — حتى بعد إسناد مندوب.
       *
       * كان يمرّ بالمصادفة وحدها: مراحل المطبخ ضمن UNASSIGNED_STATES،
       * فما إن يقبل مندوبٌ سريعٌ الطلب حتى يصير كل زرّ في لوحة المطعم
       * يردّ 403 «مُسند لمندوب آخر». والطعام في مطبخه لا في يد المندوب.
       *
       * لا يوسّع هذا صلاحيته: `ownedRestaurantId` يُقرأ من حسابه هو،
       * ويطابَق مع `restaurantId` المكتوب في الطلب — لا يمسّ طلب غيره. */
      const RESTAURANT_STAGES = ['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'CANCELLED'];
      const myRest = String(me?.ownedRestaurantId || '');
      const isMyRestaurantOrder =
        !!myRest && String(cur.restaurantId || '') === myRest &&
        (!status || RESTAURANT_STAGES.includes(String(status)));

      if (!isOwner && !isFreeToTake && !isMyRestaurantOrder) {
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
        // المناديب: صار في طلب جاهز — والأقرب للمطعم أولاً
        if (status === 'READY_FOR_PICKUP') {
          const total = Number(cur.grandTotal || cur.totalAmount || 0);
          let rLat, rLng;
          try {
            const rd = await db.collection('restaurants').doc(String(cur.restaurantId || '')).get();
            if (rd.exists) { rLat = Number(rd.data().lat); rLng = Number(rd.data().lng); }
          } catch (e) { /* بلا إحداثيات: يُنبَّه الجميع كما كان */ }
          notifyDrivers(req.app, {
            title: 'طلب جاهز للاستلام 📦',
            body: `${cur.restaurant || 'مطعم'} — ${total} ₪`,
            data: { orderId: String(id), type: 'new_ready_order' },
            restaurantLat: rLat, restaurantLng: rLng,
          }).catch(() => {});
        }
      }

      updateCached('orders:all', list => list.map(o => (String(o.id) === String(id) ? { ...o, ...updateData } : o)));


      res.json({ success: true });
    } catch (error) {
          return fail(req, res, error, 'تحديث طلب');
    }
});

/* ============================================================
   إلغاء الطلب — للزبون.

   لم يكن له سبيل. من ضغط بالخطأ، أو ندم بعد ثانيتين، أو طلب من
   المطعم الخطأ — لا زرّ أمامه. يتصل بك أنت وتفتح اللوحة وتُلغيه بيدك.
   وهذا يعمل بثلاثة زبائن، لا بثلاثمئة.

   والقاعدة عدلٌ بين طرفين:
     • ما دام المطعم لم يقبل → الإلغاء حقّ للزبون بلا سؤال.
     • بعد أن يقبل → المطبخ اشتغل والمال صُرف، فلا يُلغى إلا عبر
       الإدارة. من يسمح بالإلغاء بعد الطبخ يُخسّر شركاءه ويفقدهم.
     • واستثناء واحد: مهلة تسعين ثانية من لحظة الطلب. النقرة الخاطئة
       تُكتشف في ثوانٍ، وقد يقبل المطعم في أقلّ منها — فلا نترك الزبون
       بلا مخرج لأن المطعم كان سريعاً.
   ============================================================ */
const GRACE_MS = 90 * 1000;

router.post('/:id/cancel', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    const { id } = req.params;
    if (!db) return res.status(500).json({ success: false, error: 'لا قاعدة بيانات' });

    const ref = db.collection('orders').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    const o = snap.data() || {};

    // صاحب الطلب وحده — أو الإدارة
    if (!req.isAdmin) {
      const loadUser = req.app.get('loadUser');
      const samePhone = req.app.get('samePhone') || ((a, b) => String(a) === String(b));
      const me = loadUser ? await loadUser(req.user && req.user.userId) : null;
      const myId = String((me && me.id) || (req.user && req.user.userId) || '');
      const myType = String((me && me.userType) || '');
      const isManager = myType === 'manager' || myType === 'admin';
      const mine = (o.customerId && String(o.customerId) === myId)
        || samePhone(o.customerPhone, me && me.phone);
      if (!mine && !isManager) {
        return res.status(403).json({ success: false, error: 'هذا ليس طلبك' });
      }
    }

    const status = String(o.status || '');
    if (status === 'CANCELLED') return res.json({ success: true, already: true });
    if (status === 'DELIVERED') {
      return res.status(400).json({ success: false, error: 'الطلب سُلّم — لا يمكن إلغاؤه' });
    }

    const createdMs = orderCreatedMs(o);
    const inGrace = createdMs && (Date.now() - createdMs) < GRACE_MS;

    /* «قبل أن يلتزم أحد» — لكلٍّ من النوعين معناه.
     *
     * المطعم يلتزم حين يقبل: `PENDING_RESTAURANT` وحدها قبل الالتزام.
     * والمارت لا موافقة فيه — طلبه يولد `READY_FOR_PICKUP`، والملتزم
     * الأول فيه هو **المندوب** حين يلتقطه.
     *
     * وكان الفحص يعرف المطاعم وحدها، فطلبُ مارت عمره دقيقتان ولم
     * يلمسه أحد يُرفض إلغاؤه بنصّ «المطعم بدأ تحضير طلبك» — لا مطعم
     * ولا تحضير ولا مندوب، ورسالةٌ يعرف الزبون أنها غير صحيحة تهدم
     * ثقته بكل رسالة بعدها. */
    const hasDriver = !!(o.driver && (o.driver.id || o.driver.phone)) || !!o.driverId;
    const beforeAccept = status === 'PENDING_RESTAURANT'
      || (status === 'READY_FOR_PICKUP' && !hasDriver);

    if (!req.isAdmin && !beforeAccept && !inGrace) {
      return res.status(409).json({
        success: false,
        error: hasDriver
          ? 'المندوب استلم طلبك وهو في الطريق — راسل الإدارة إن كان لا بدّ من الإلغاء'
          : 'المطعم بدأ تحضير طلبك — راسل الإدارة إن كان لا بدّ من الإلغاء'
      });
    }

    const reason = String((req.body && req.body.reason) || '').slice(0, 200).trim();
    await ref.update({
      status: 'CANCELLED',
      statusAr: STATUS_AR.CANCELLED,
      cancelledBy: req.isAdmin ? 'admin' : 'customer',
      cancelReason: reason,
      cancelledAt: new Date(),
    });
    updateCached('orders:all', list =>
      list.map(x => (String(x.id) === String(id) ? { ...x, status: 'CANCELLED' } : x)));

    const io = req.app.get('socketio');
    if (io) io.emit('order_updated', { orderId: String(id), status: 'CANCELLED', timestamp: new Date() });

    // المطعم يجب أن يعرف فوراً — قد يكون بدأ فعلاً رغم أن حالته لم تتغيّر
    if (o.restaurantId) {
      notifyRestaurant(req.app, o.restaurantId, {
        title: 'أُلغي طلب ❌',
        body: `${o.itemsSummary || 'طلب'} — ألغاه الزبون`,
        data: { orderId: String(id), type: 'order_cancelled' },
      }).catch(() => {});
    }

    console.log(`❌ أُلغي الطلب ${id} — ${req.isAdmin ? 'الإدارة' : 'الزبون'}${reason ? ' · ' + reason : ''}`);
    res.json({ success: true });
  } catch (e) {
    console.error('❌ إلغاء طلب:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ============================================================
   مهلة ردّ المطعم — لا طلب يعلّق إلى الأبد.

   صاحب المطعم قد يكون نائماً، أو جواله مغلق، أو نسي. والطلب يبقى
   «بانتظار موافقة المطعم» إلى ما لا نهاية: الزبون ينتظر ولا خبر،
   وأنت لا تعلم، ولا أحد يُغلق الدائرة. وهذا أسوأ ما يُروى عن تطبيق
   توصيل في أسبوعه الأول.

   ثلاث مراحل مقصودة — لا إلغاء فوريّ:
     ٥ دقائق  → تذكير للمطعم (ربّما لم يسمع الأول)
     ١٠ دقائق → إبلاغك أنت، وطمأنة الزبون بصدق
     ٢٠ دقيقة → إلغاء تلقائي، فانتظارٌ بلا نهاية أسوأ من «لا»

   وتُقرأ من الكاش لا من Firestore — فلا تكلّف قراءة واحدة إضافية.
   ============================================================ */
const NUDGE_MS  = Number(process.env.REST_NUDGE_MIN  || 5)  * 60000;
const ALERT_MS  = Number(process.env.REST_ALERT_MIN  || 10) * 60000;
const EXPIRE_MS = Number(process.env.REST_EXPIRE_MIN || 20) * 60000;

const _staleSeen = new Map();   // معرّف الطلب → آخر مرحلة أُبلغ عنها

/* ============================================================
   قراءة تاريخ الإنشاء — درسُ الطلب 642443.

   كانت القراءة: `Date.parse(o.createdAt || 0)`. وحين يكون التاريخ
   غائباً يصير النداء `Date.parse(0)` — والصفر يُقرأ **سنة ٢٠٠٠**،
   لا «لا تاريخ». فطلبُ مارت حقيقي، أول طلب بعد إصلاح الـ400، بدا
   للمكنسة عمرُه ٢٦ سنة فألغته بعد خمس ثوانٍ من ولادته.

   القاعدة: تاريخٌ لا نفهمه = صفر = «لا تحكم عليه»، لا تخمينٌ قديم
   يستوجب الإعدام. والدالة تقرأ كل الصيغ التي تمرّ فعلاً في النظام:
   Timestamp من Firestore، و{_seconds} من التسلسل، وDate من الكاش،
   ونصّ ISO، ورقم ميلي ثانية.
   ============================================================ */
function orderCreatedMs(o) {
  const c = o && o.createdAt;
  if (!c) return 0;
  try {
    if (typeof c.toDate === 'function') return c.toDate().getTime();     // Firestore Timestamp
    if (typeof c._seconds === 'number') return c._seconds * 1000;        // صيغة متسلسلة
    if (c instanceof Date) return c.getTime();                           // من الكاش
    if (typeof c === 'number') return c > 1e12 ? c : c * 1000;           // ميلي أو ثوانٍ
    if (typeof c === 'string') { const t = Date.parse(c); return Number.isFinite(t) ? t : 0; }
  } catch (e) {}
  return 0;
}

/* ============================================================
   الوجه الثاني للمهلة: طلبٌ جاهز لا يلتقطه مندوب.

   المهلة الأولى عالجت «مطعماً لا يردّ». وبقي توأمها مكشوفاً: طلبٌ
   صار `READY_FOR_PICKUP` — مارت من أول ثانية، أو مطعمٌ أنهى الطبخ —
   ولا مندوب يلتقطه. كان يبقى معلّقاً **إلى الأبد**: الزبون يحدّق في
   شاشة تتبّع لا تتحرك، ولا أحد في المنصّة كلها يعلم أن هناك مشكلة.

   ثلاث درجات كما في الأولى — لكل درجة فعلٌ لا رسالة قلق فقط:
     · ٥ دقائق:  يُعاد نداء المناديب. الرنّة الأولى تفوت من كان
                 على الدراجة — الثانية بابُها.
     · ١٢ دقيقة: يُصارَح الزبون («نبحث لك عن مندوب») وتُصرخ اللوحة.
     · ثم نداء مناديب متجدّد كل ١٠ دقائق — بلا توقف.

   **لا إلغاء تلقائياً — قرار صاحب المنصّة، حرفياً:**
   «بدل ما يختفي أعطِ الديليفري والمطعم خيار الرفض». كان هنا إلغاءٌ
   آلي بعد ٣٥ دقيقة، وأول ما فعله في الدنيا أنه أعدم طلبَ اختبارٍ
   حقيقياً بعد خمس ثوانٍ (عطل تاريخ الكاش أعلاه). والعبرة أعمق من
   العطل: روبوتٌ يلغي طلباً قرارٌ تجاري، وصاحب القرار قال لا.
   الطلب يبقى معروضاً حتى يلتقطه مندوب، أو يرفضه المحلّ صراحةً
   (مسار reject أدناه)، أو يلغيه الزبون أو الإدارة.
   ============================================================ */
const READY_NUDGE_MS   = Number(process.env.READY_NUDGE_MIN   || 5)  * 60000;
const READY_ALERT_MS   = Number(process.env.READY_ALERT_MIN   || 12) * 60000;
const READY_RENUDGE_MS = Number(process.env.READY_RENUDGE_MIN || 10) * 60000;

const _readySeen = new Map();   // معرّف الطلب → { stage, lastNudge }

async function sweepReadyUnclaimed(app, db, o) {
  const id = String(o.id);
  const created = orderCreatedMs(o);
  if (!created) return;                    // تاريخ لا نفهمه = لا حكم عليه
  const age = Date.now() - created;
  const st = _readySeen.get(id) || { stage: 0, lastNudge: 0 };

  const nudgeDrivers = () => notifyDrivers(app, {
    title: 'طلب ما زال بانتظار مندوب 📦',
    body: `${o.restaurant || 'محلّ'} — ${o.grandTotal || o.totalAmount || 0} ₪`,
    data: { orderId: id, type: 'new_ready_order' },
  }).catch(() => {});

  if (age >= READY_ALERT_MS && st.stage < 2) {
    _readySeen.set(id, { stage: 2, lastNudge: Date.now() });
    notifyCustomer(app, o.customerPhone, {
      title: 'طلبك جاهز — نبحث لك عن مندوب',
      body: 'كل المناديب مشغولون الآن. سنُبلغك فور انطلاق أحدهم إليك',
      channel: 'update', data: { orderId: id, type: 'status', status: 'READY_FOR_PICKUP' },
    }).catch(() => {});
    nudgeDrivers();
    const io = app.get('socketio');
    if (io) io.to('manager_monitor').emit('order_stuck', {
      orderId: id, restaurant: o.restaurant || '', minutes: Math.round(age / 60000),
    });
    console.warn(`🆘 الطلب ${id} جاهز بلا مندوب منذ ${Math.round(age / 60000)} دقيقة · ${o.restaurant || o.restaurantId}`);

  } else if (st.stage >= 2 && Date.now() - st.lastNudge >= READY_RENUDGE_MS) {
    // ما دام معلّقاً تتجدّد الرنّة — الطلب لا يُنسى ولا يُعدم
    _readySeen.set(id, { stage: st.stage, lastNudge: Date.now() });
    nudgeDrivers();
    console.warn(`🔁 نداء مناديب متجدّد للطلب ${id} — معلّق منذ ${Math.round(age / 60000)} دقيقة`);

  } else if (age >= READY_NUDGE_MS && st.stage < 1) {
    _readySeen.set(id, { stage: 1, lastNudge: Date.now() });
    nudgeDrivers();
  }
}

function startRestaurantTimeout(app) {
  const tick = async () => {
    try {
      const db = app.get('db');
      if (!db) return;
      // نقرأ الكاش نفسه الذي يستعمله GET — بلا استعلام جديد
      const list = await cached('orders:all', ORDERS_TTL, async () => []);
      if (!Array.isArray(list) || !list.length) return;
      const now = Date.now();

      for (const o of list) {
        const st = String(o.status || '');
        const hasDrv = !!(o.driver && (o.driver.id || o.driver.phone)) || !!o.driverId;
        // «جاهز بلا مندوب» له مكنسته الخاصة — مارت كان أو مطعماً أنهى الطبخ
        if (st === 'READY_FOR_PICKUP' && !hasDrv) {
          _staleSeen.delete(String(o.id));
          await sweepReadyUnclaimed(app, db, o);
          continue;
        }
        if (st !== 'PENDING_RESTAURANT') { _staleSeen.delete(String(o.id)); _readySeen.delete(String(o.id)); continue; }
        const created = orderCreatedMs(o);
        if (!created) continue;
        const age = now - created;
        const id = String(o.id);
        const stage = _staleSeen.get(id) || 0;

        if (age >= EXPIRE_MS && stage < 3) {
          _staleSeen.set(id, 3);
          await db.collection('orders').doc(id).update({
            status: 'CANCELLED', statusAr: STATUS_AR.CANCELLED,
            cancelledBy: 'system', cancelReason: 'لم يردّ المطعم', cancelledAt: new Date(),
          });
          updateCached('orders:all', l => l.map(x => (String(x.id) === id ? { ...x, status: 'CANCELLED' } : x)));
          const io = app.get('socketio');
          if (io) io.emit('order_updated', { orderId: id, status: 'CANCELLED', timestamp: new Date() });
          notifyCustomer(app, o.customerPhone, {
            title: 'اعتذارنا — أُلغي طلبك',
            body: 'المطعم لم يردّ. لم يُخصم منك شيء، وجرّب مطعماً آخر',
            channel: 'update', data: { orderId: id, type: 'status', status: 'CANCELLED' },
          }).catch(() => {});
          console.warn(`⏰ أُلغي الطلب ${id} — المطعم ${o.restaurantId} لم يردّ خلال ${EXPIRE_MS / 60000} دقيقة`);

        } else if (age >= ALERT_MS && stage < 2) {
          _staleSeen.set(id, 2);
          // الصدق أفضل من الصمت: الزبون ينتظر ويستحق أن يعرف
          notifyCustomer(app, o.customerPhone, {
            title: 'طلبك ما زال بانتظار المطعم',
            body: 'نحاول الوصول إليهم — سنُبلغك فوراً',
            channel: 'update', data: { orderId: id, type: 'status', status: 'PENDING_RESTAURANT' },
          }).catch(() => {});
          console.warn(`⚠️ الطلب ${id} بلا ردّ منذ ${Math.round(age / 60000)} دقيقة · مطعم ${o.restaurantId}`);

        } else if (age >= NUDGE_MS && stage < 1) {
          _staleSeen.set(id, 1);
          notifyRestaurant(app, o.restaurantId, {
            title: '⏰ طلب ينتظر ردّك',
            body: `${o.itemsSummary || 'طلب'} — زبونك ينتظر`,
            data: { orderId: id, type: 'new_order' },
          }).catch(() => {});
        }
      }
      if (_staleSeen.size > 500) _staleSeen.clear();
    } catch (e) {
      console.warn('⚠️ مهلة المطعم:', e.message);
    }
  };
  const t = setInterval(tick, 60000);
  if (t.unref) t.unref();
  console.log(`⏰ مهلة ردّ المطعم مفعّلة — تذكير ${NUDGE_MS / 60000}د · إبلاغ ${ALERT_MS / 60000}د · إلغاء ${EXPIRE_MS / 60000}د`);
}

/* ============================================================
   POST /api/orders/:id/reject_by_shop — المحلّ يرفض طلبه صراحةً.

   نصف قرار صاحب المنصّة حين ألغى الإلغاء الآلي: «أعطِ الديليفري
   والمطعم خيار الرفض». الروبوت لا يُعدم طلباً؛ **صاحب البضاعة** هو
   من يقول «ما عندي» — بسبب معدود لا نصّ حرّ، فيصير تقرير «لماذا
   نخسر طلبات» ممكناً من أول أسبوع (وهي العادة التي أخذناها من
   CoopCycle: أسبابهم SOLD_OUT/RUSH_HOUR محفورة في الكيان نفسه).

   الحارس: صاحب هذا المحلّ تحديداً أو الإدارة. والرفض ممنوع بعد أن
   يستلم المندوب البضاعة — عندها البضاعة في الشارع والقرار لم يعد
   قرار الرفّ.

   (زرّ التطبيق يأتي في دفعة البناء القادمة — المسار جاهز قبله عمداً:
   حين يُبنى الزرّ يجد باباً مفتوحاً لا جداراً.)
   ============================================================ */
const SHOP_REJECT_REASONS = {
  SOLD_OUT: 'الصنف غير متوفر حالياً',
  CLOSING:  'المحلّ على وشك الإغلاق',
  BUSY:     'ضغط شديد — لا نستطيع التجهيز الآن',
  OTHER:    'ظرف خارج عن الإرادة',
};

router.post('/:id/reject_by_shop', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const id = String(req.params.id);
    const ref = db.collection('orders').doc(id);
    const snap = await ref.get();
    meter.addReads(1, 'رفض المحلّ');
    if (!snap.exists) return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    const o = snap.data() || {};

    // الحارس: صاحب المحلّ نفسه أو الإدارة
    if (!req.isAdmin) {
      const me = await (req.app.get('loadUser')?.(String(req.user?.userId || '')));
      if (!me || String(me.ownedRestaurantId || '') !== String(o.restaurantId || '')) {
        return res.status(403).json({ success: false, error: 'هذا ليس طلب محلّك' });
      }
    }

    const st = String(o.status || '');
    if (st === 'CANCELLED') return res.json({ success: true, already: true });
    if (['PICKED_UP', 'ON_THE_WAY', 'DELIVERED'].includes(st)) {
      return res.status(409).json({ success: false, error: 'المندوب استلم البضاعة — لم يعد الرفض ممكناً. راسل الإدارة.' });
    }

    const code = String((req.body && req.body.reason) || 'OTHER').toUpperCase();
    const reasonAr = SHOP_REJECT_REASONS[code] || SHOP_REJECT_REASONS.OTHER;

    await ref.update({
      status: 'CANCELLED', statusAr: STATUS_AR.CANCELLED,
      cancelledBy: 'shop', cancelReason: code, cancelReasonAr: reasonAr, cancelledAt: new Date(),
    });
    updateCached('orders:all', l => l.map(x => (String(x.id) === id ? { ...x, status: 'CANCELLED' } : x)));
    const io = req.app.get('socketio');
    if (io) io.emit('order_updated', { orderId: id, status: 'CANCELLED', timestamp: new Date() });

    // الصدق مع الزبون: السبب الحقيقي بلسان مهذّب، لا «أُلغي» غامضة
    notifyCustomer(req.app, o.customerPhone, {
      title: 'اعتذارنا — المحلّ لم يستطع تلبية طلبك',
      body: `${reasonAr}. لم يُخصم منك شيء — جرّب محلاً آخر أو أعد المحاولة لاحقاً`,
      channel: 'update', data: { orderId: id, type: 'status', status: 'CANCELLED' },
    }).catch(() => {});

    console.log(`🚫 رفض المحلّ ${o.restaurantId} الطلب ${id} — السبب: ${code}`);
    res.json({ success: true, reason: code });
  } catch (e) { fail(req, res, e, 'رفض المحلّ'); }
});

module.exports = router;
// مُصدَّرة للاختبار: مسار المال يستحق اختباراً مباشراً لا فحصاً بالنظر
module.exports.priceItems = priceItems;
module.exports.startRestaurantTimeout = startRestaurantTimeout;
