const express = require('express');
const router = express.Router();

// Get Firestore from app
const getDb = (req) => req.app.get('db');
/** إنشاء طلب أو تغيير حالته يتطلب هوية — كان أي أحد يعلّم أي طلب "تم التسليم". */
const needsIdentity = (req, res, next) => {
  const fn = req.app.get('requireIdentity');
  return fn ? fn(req, res, next) : next();
};
const { cached, peekCached, invalidate, updateCached } = require('../utils/cache');
const { quoteDelivery } = require('./zones');
const { notifyRestaurant, notifyDrivers, notifyCustomer, notifyDriverById, releaseHeldOrder } = require('./push');
const { priceMartItems } = require('./mart');
const meter = require('../utils/meter');
/* المصدر الوحيد لكل رقم مالي. التطبيقات الثلاثة واللوحة تعرض ما يأتي
 * من هنا ولا يحسب أيٌّ منها شيئاً — انظر utils/money.js. */
const { breakdown, applyPayment } = require('../utils/money');
// تقريبٌ لقرشين — نفس قاعدة money.js كي لا يختلف رقمان لنفس المبلغ
const r2m = (n) => Math.round((Number(n) || 0) * 100) / 100;
/* دفتر الأستاذ — قيدٌ عند كل حركة مال. الطلب يحمل الصورة، والدفتر
 * يحمل القصّة: من فعل ماذا ومتى. راجع utils/ledger.js. */
const ledger = require('../utils/ledger');
const { normRef } = require('../utils/refs');   // نفس التطبيع الذي يستعمله مسار البنك

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
/* بصمات الطلبات الأخيرة — حارس التكرار عند انقطاع الشبكة.
 * في الذاكرة عمداً: لا قراءة ولا كتابة من الحصة، وتُمسح بإعادة التشغيل. */
const _recentOrders = new Map();
const DUP_WINDOW_MS = Number(process.env.ORDER_DUP_WINDOW_SEC || 90) * 1000;

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
  PENDING_PAYMENT:    'بانتظار تأكيد دفعك 💳',
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

/* ═══════════════════════════════════════════════════════════════════
   الإلغاء — حقيقةٌ واحدة لا أربع.

   كان لكلّ مسار إلغاءٍ نسخته: `/cancel` وحده يكتب `refundDue` ويقيّده،
   بينما `reject_by_shop` والمكنستان (المطعم لم يردّ · مهجور ١٢ ساعة)
   يكتبن `CANCELLED` عارية، **ويَعِدن الزبون «المبلغ سيُعاد إليك»**
   نصّاً بلا أن يخلّفن أثراً: لا `refundStatus`، فلا يظهر في
   `refunds/pending`، ولا يلتقطه `reconcile.lateRefunds`. مالٌ حقيقي
   وُعد به وضاع من كل سجلّ.

   فصار الإلغاء بابه واحد: هذا الحقلُ والقيدُ. من يضيف مسار إلغاءٍ
   خامساً غداً يمرّ من هنا — أو لا يُلغي.

   ترجع: { patch, ledgerEntries } — patch يُدمَج في update، والقيود
   تُمرَّر لـ recordMany.
   ═══════════════════════════════════════════════════════════════════ */
function buildCancellation(order, { by, reason, actorId, actorName }) {
  const wasPaid = order.paidOnline === true || order.paymentStatus === 'paid';
  const grand = Number((order.money && order.money.grandTotal) != null
    ? order.money.grandTotal : order.grandTotal) || 0;
  const refundAmt = wasPaid ? grand : 0;

  const patch = {
    status: 'CANCELLED',
    statusAr: STATUS_AR.CANCELLED,
    cancelledBy: by,
    cancelReason: reason,
    cancelledAt: new Date(),
    ...(wasPaid ? {
      refundDue: refundAmt,
      refundStatus: 'pending',
      paymentStatus: 'refund_pending',
    } : {}),
  };

  const ledgerEntries = [{
    kind: ledger.KINDS.CANCELLED,
    orderId: String(order.id || ''),
    amount: grand,
    direction: 'neutral',
    actorId: actorId || null,
    actorRole: by,
    actorName: actorName || order.customerName || '',
    note: reason || 'بلا سبب مذكور',
    meta: { wasPaid },
  }];
  if (wasPaid && refundAmt > 0) {
    ledgerEntries.push({
      kind: ledger.KINDS.REFUND_DUE,
      orderId: String(order.id || ''),
      amount: refundAmt,
      direction: 'neutral',
      actorId: actorId || null,
      actorRole: by,
      actorName: actorName || order.customerName || '',
      note: `استرداد مستحقّ للزبون ${order.customerPhone || ''} — لم يُنفَّذ بعد`,
      meta: { phone: order.customerPhone || '' },
    });
  }
  return { patch, ledgerEntries, wasPaid, refundAmt };
}

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

      /* ============================================================
         حارس الطلب المكرَّر — أخطر ما تُنتجه شبكة نابلس.

         السيناريو الواقعي: الزبون يضغط «تأكيد»، فيصل الطلب السيرفر
         ويُحفظ، ثم ينقطع النت قبل أن يعود الردّ. التطبيق ينتظر ستين
         ثانية ثم يقول «تعذّر الاتصال» ويحذف الطلب من شاشته. فيضغط
         الزبون ثانيةً — والتطبيق يولّد **معرّفاً جديداً** من الساعة،
         فيصير طلبان حقيقيان بمعرّفين مختلفين.

         والنتيجة: مطعمٌ يطبخ مرّتين، ومندوبان يتحرّكان، وأجرتا توصيل.
         الزبون يرفض الثاني، والمندوب خسر رحلته، وأنت تدفع الفرق.
         وليس نادراً — هذا هو الحال الغالب في الطابق الأرضي بنابلس.

         والحلّ الصحيح مفتاح تكرار من التطبيق، وهو يحتاج بناءً. وهذا
         بديلٌ يعمل **الآن على الأجهزة المثبَّتة**: بصمة من (الزبون +
         المحلّ + المبلغ + ملخّص الأصناف). فطلبٌ بنفس البصمة خلال ٩٠
         ثانية هو إعادةُ محاولةٍ لا طلبٌ ثانٍ — نردّ الطلب الأول نفسه
         بنجاح، فيرى الزبون طلبه ولا يُنشأ شيء.

         ولماذا ٩٠ ثانية؟ أطول من مهلة التطبيق (٦٠) بهامش، وأقصر من
         أن تمنع زبوناً أراد فعلاً طلباً ثانياً مطابقاً — وهو نادر،
         ومن أراده ينتظر دقيقة ونصفاً أو يغيّر صنفاً.

         والكاش في الذاكرة لا في Firestore: لا قراءة ولا كتابة إضافية،
         وإعادة تشغيل السيرفر تمسحه — وهي لحظة لا يكون فيها تكرار أصلاً.
         ============================================================ */
      const dupKey = [
        orderData.customerId || orderData.customerPhone || '',
        orderData.restaurantId || '',
        Number(orderData.totalAmount || 0),
        String(orderData.itemsSummary || '').slice(0, 60),
      ].join('|');
      const now0 = Date.now();
      for (const [k, v] of _recentOrders) {
        if (now0 - v.at > DUP_WINDOW_MS) _recentOrders.delete(k);
      }
      const seen = _recentOrders.get(dupKey);
      if (seen && now0 - seen.at < DUP_WINDOW_MS) {
        /* ============================================================
           والطلب المنتهي لا يُعدّ تكراراً — تصحيحٌ لخطأ في تصميمي.

           بنيتُ الحارس على افتراضٍ واحد: «طلبان متطابقان في دقيقة ونصف
           = إعادة محاولة». وهو صحيح للطلب **المعلّق**، وخاطئ تماماً
           للطلب الذي **انتهى**.

           فمن سلّم طلبه ثم طلب مثله فوراً — أو ألغاه ثم أعاده — يريد
           طلباً جديداً بيقين، لا نسخةً من طلبٍ فرغ منه. وحارسي كان
           يردّ عليه معرّف القديم، فيتبنّاه التطبيق ويظنّ صاحبه أن
           طلبه «علق» — وهو لم يُنشأ أصلاً.

           وقد ظهر هذا في أول ساعة من عمر الحارس: سجلّ الأخطاء يقول
           «أُرسل 034921 وحُفظ 962060».

           فالشرط الصحيح: يُمنع التكرار ما دام الطلب الأول **حيّاً**.
           والفحص من الكاش لا من Firestore — بلا قراءة إضافية. */
        let prevAlive = true;
        try {
          const cachedList = peekCached('orders:all');
          const prev = Array.isArray(cachedList)
            ? cachedList.find(x => String(x.id) === String(seen.id)) : null;
          if (prev && ['DELIVERED', 'CANCELLED'].includes(String(prev.status || ''))) {
            prevAlive = false;
          }
        } catch (e) { /* تعذّر الفحص: نبقى على الحماية */ }

        if (prevAlive) {
          console.warn(`♻️ طلب مكرَّر مُنع: ${dupKey.slice(0, 40)} → أُعيد ${seen.id}`);
          return res.status(200).json({
            success: true, duplicate: true, id: seen.id, orderId: seen.id,
            message: 'طلبك وصلنا بالفعل ✅',
          });
        }
        // الأول انتهى — نمسح بصمته ونمضي في إنشاء طلبٍ جديد حقيقي
        _recentOrders.delete(dupKey);
        console.log(`✅ طلب جديد بنفس بصمة طلبٍ منتهٍ (${seen.id}) — يمرّ`);
      }

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
      /* `qr` طريقةٌ يختارها الزبون كما يختار الكاش — والفرق أن ماله
       * يصل حسابَ زادنا لا جيبَ المندوب. لكن اختيارَه ليس دفعاً:
       * تبقى `paymentStatus = 'pending'` حتى يُؤكَّد وصولُ التحويل. */
      orderData.paymentMethod = ['cash', 'wallet', 'card', 'qr'].includes(askedMethod) ? askedMethod : 'cash';
      orderData.paymentStatus = 'pending';
      orderData.paidOnline = false;

      /* ═══ حجب طلب الـQR حتى يتأكّد الدفع (قرار يزن ٨ آب) ═══
       * الزبون اختار QR؟ لا يصل المطعم حتى يؤكّد البنك وصول التحويل.
       * يُحفظ `PENDING_PAYMENT` بدل ما يُبثّ للمطعم، ويُطلَق فور التأكيد
       * (`releaseHeldOrder`). خلف علَمٍ مطفأ افتراضاً: بلا قارئ بنكٍ حيّ
       * لن يصل تأكيدٌ أبداً فيتجمّد الطلب — فلا يُفعَّل إلا حين يجهز القارئ.
       * `=1` يشغّله بعد ضبط `SMS_HOOK_KEY` وتشغيل التطبيق القارئ. */
      const holdForPayment =
        process.env.HOLD_QR_UNTIL_PAID === '1' &&
        orderData.paymentMethod === 'qr' &&
        orderData.paidOnline !== true;
      // الخصم صفرٌ حتى تُبنى الكوبونات — والحقل موجود ليُحسب صحيحاً حين تُبنى
      orderData.discount = 0;
      orderData.discountBy = 'restaurant';   // العروض من المطاعم — قرار العمل

      const m = applyPayment(breakdown(orderData), orderData);
      orderData.grandTotal = m.grandTotal;
      orderData.money = m;

      /* الحجب يُلبِس الطلب حالته الخاصّة — يعلو على `READY_FOR_PICKUP`
       * التي وسمها المارت أعلاه. `heldAt` منه تُحسب مهلة الإلغاء. */
      if (holdForPayment) {
        orderData.status = 'PENDING_PAYMENT';
        orderData.heldForPayment = true;
        orderData.heldAt = new Date();
      }

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
        _recentOrders.set(dupKey, { id: finalId, at: Date.now() });
      } catch (e) {
        if (e && (e.code === 6 || /ALREADY_EXISTS/i.test(String(e.message)))) {
          finalId = `${orderId}-${Math.random().toString(36).slice(2, 7)}`;
          console.warn(`⚠️ تصادم معرّف طلب — أُنقذ الطلب القديم ووُلّد بديل: ${finalId}`);
          await db.collection('orders').doc(finalId).create({ ...orderData, id: finalId });
        } else throw e;
      }
      const savedId = finalId;

      console.log(`✅ [Firestore] تم حفظ طلب جديد: ${savedId}`);

      /* أوّل قيدٍ في قصّة الطلب: نشأ التزامٌ بمبلغٍ محدَّد.
       * `neutral` لأن شيئاً لم يدخل خزنتك بعد — نشأ الالتزام فقط. */
      ledger.record(db, {
        kind: ledger.KINDS.ORDER_CREATED,
        orderId: savedId,
        amount: m.grandTotal,
        direction: 'neutral',
        actorId: (req.user && req.user.userId) || orderData.customerId || null,
        actorRole: 'customer',
        actorName: orderData.customerName || '',
        note: `${m.itemsTotal} أصناف + ${m.deliveryFee} توصيل · ${orderData.restaurant || ''}`,
        meta: { restaurantId: orderData.restaurantId || null, isMart },
      }).catch(() => {});

      // Emit Real-time update
      // ملاحظة: نستعمل savedId لا orderId — عند التصادم يختلفان، وبثّ
      // الرقم القديم يجعل المندوب يفتح طلباً غير موجود.
      const io = req.app.get('socketio');
          if (io && isMart && !holdForPayment) {
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
      if (io && !isMart && !holdForPayment) {
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
      /* الطلب المحجوز بانتظار الدفع لا يُخطَر به المطعم ولا المناديب —
       * يُطلَق فور تأكيد التحويل (releaseHeldOrder). الشرط يحكم الـif/else
       * كاملاً (جملةٌ واحدة) فلا يحتاج قوساً. */
      if (!holdForPayment)
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
          // المدفوع إلكترونياً لا يضع نقداً في جيبه — فلا يحجبه سقف الكاش
          paidOnline: orderData.paidOnline === true,
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
      notifyCustomer(req.app, orderData.customerPhone, holdForPayment ? {
        title: 'طلبك بانتظار تأكيد تحويلك 💳',
        body: `حوّل ${money} عبر الكود — يصل المطعم فور تأكيد وصول المبلغ`,
        channel: 'update',
        data: { orderId: savedId, type: 'awaiting_payment' },
      } : {
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
                /* ===== نطاق المندوب لمن هو مندوب — لا لمن يدّعيه =====
                 *
                 * كان الشرط: «هل `driverId` هو معرّفك؟» ولا شيء غيره.
                 * وهذا يعني أن **أي حساب مسجَّل** — زبونٌ عاديّ نزّل
                 * التطبيق قبل دقيقة — ينادي:
                 *
                 *     GET /api/orders?driverId=<معرّفه هو>
                 *
                 * فيُمنح نطاق المندوب، ويرى **كل طلب غير مُسنَد**: اسم
                 * الزبون وعنوان بيته ورقمه ومبلغه. ثم يقبله، لأن حارس
                 * التعديل يسمح بأخذ ما لا مندوب له.
                 *
                 * أي أن باب القراءة كان مفتوحاً بلا حارس، وباب الإشعار
                 * مغلقاً بأربعة. ومن ثمّ كان صاحب المنصّة يرى الطلبات
                 * ويوصّلها ولا يُنادى عليه — وهو ما حيّرنا يوماً كاملاً.
                 *
                 * القاعدة الآن هي قاعدة `notifyDrivers` نفسها: مندوبٌ
                 * بنوع حسابه، أو من سجّل جهاز كابتن فعلاً. حقيقة واحدة
                 * في المكانين — لا حارسان مختلفان لبابين على غرفة واحدة. */
                const isDriverAccount = type === 'driver' || me.worksAsDriver === true;
                if (q.driverId && isDriverAccount &&
                    (String(q.driverId) === myId || (myPhone && String(q.driverId) === myPhone))) {
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
                    // نفس القاعدة في النطاق الافتراضي — وإلا دخل من الباب الخلفي
                    if (isDriverAccount) driverId = myId;
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
            /* الطلب المحجوز بانتظار تأكيد الدفع لا يظهر للمطعم — يظهر فور
             * تأكيد البنك (releaseHeldOrder ينقله عن PENDING_PAYMENT).
             * المندوب لا يراه أصلاً (ليس في UNASSIGNED)، والزبون يراه في
             * نطاقه ليتابع تحويله. الحجب عن المطعم وحده. */
            filtered = filtered.filter(o => String(o.status || '') !== 'PENDING_PAYMENT');
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
            /* ===== المعرّف يحكم، والرقم احتياطٌ لا شريك =====
             *
             * كانت `||`: يُقبل الطلب إن طابق المعرّف **أو** الرقم. وهذا
             * يعني أنّ حسابين يحملان رقماً واحداً يريان طلبات بعضهما.
             *
             * ورآها يزن بعينه: طلبَ بحساب، ثم خرج ودخل بحساب آخر —
             * فانتقل الطلب إليه. والسيرفر لم يُخطئ في التنفيذ، أخطأ في
             * القاعدة: جعل الرقم دليلَ ملكية، والرقم يتكرّر.
             *
             * وهذا تسريب لا مجرّد إرباك: اسم الزبون وعنوان بيته ورقمه
             * يظهر لصاحب أي حساب يشاركه الرقم.
             *
             * القاعدة الصحيحة: الطلب الذي **يحمل معرّف صاحبه** يُحكم به
             * وحده، ولا يُسأل الرقم أصلاً. والرقم لا يُستعمل إلا للطلبات
             * القديمة التي أُنشئت قبل أن نكتب `customerId` — وهي وحدها
             * التي لا سبيل آخر لنسبتها. */
            filtered = filtered.filter(o => {
                const oid = o.customerId ? String(o.customerId) : '';
                if (oid) return !!myUserId && oid === myUserId;
                return samePhone(o.customerPhone, want);
            });
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

    /* ============================================================
       الطلب المنتهي لا يُحيا — لا كاش ولا مندوب ولا حالة.

       كان `PATCH` وحده بين كل المسارات لا يفحص الحالة الحالية:
       `isFreeToTake` تصير صحيحةً لأي طلبٍ بلا مندوب **بما فيها
       الملغى** (`!curDrvKey` وحدها تكفي). فمندوبٌ يصله نداءٌ لطلبٍ
       أُلغي للتوّ يقبله فينقلب من CANCELLED إلى DRIVER_ASSIGNED
       بصمت، ويسلّمه، فيُقيَّد كاشٌ ووُيدفع للمطعم عن طلبٍ أُلغي
       واستُرِدّ للزبون ماله. مالٌ يُدفع مرّتين.

       والإدارة تُستثنى: تصحيحُ حالةٍ عالقة قرارُها. */
    if (!req.isAdmin && ['CANCELLED', 'DELIVERED'].includes(String(cur.status || ''))) {
      return res.status(409).json({
        success: false,
        error: String(cur.status) === 'CANCELLED'
          ? 'هذا الطلب أُلغي — لم يعد قابلاً للتعديل'
          : 'هذا الطلب سُلّم — انتهى'
      });
    }

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

      /* ============================================================
         التقاطُ طلبٍ حرّ حقٌّ للمندوب وحده — لا لأي حساب مسجَّل.

         كان `isFreeToTake` لا يسأل: هل الطالب مندوبٌ أصلاً؟ فأي زبون
         مسجّلٍ يعرف رقم طلبٍ حرّ يعيّن نفسه مندوباً عليه ويسلّمه، فتُنسب
         له أرباح، ويُلفَّق تسليمٌ وهمي يُفسد كل الأرقام. نفس فحص الدور
         المطبَّق في `notifyDrivers` و`GET /orders` — كان غائباً هنا
         وحده. */
      const iAmDriver = me && (me.userType === 'driver' || me.worksAsDriver === true);
      const isFreeToTake = iAmDriver &&
        (!curDrvKey || UNASSIGNED_STATES.includes(String(cur.status)));

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

      /* ============================================================
         عدّاد الكاش في جيب المندوب — يُحدَّث لحظة التسليم.

         السقف في push.js يحرس هذا الرقم، وبلا تحديثه هنا يبقى صفراً
         أبداً فيصير الحارس حرفاً ميتاً.

         وما يُضاف هو **ما يبقى في جيبه فعلاً**: يحصّل من الزبون
         `cashToCollect`، ويدفع للمحلّ `payToRestaurant` نقداً، فيبقى
         معه الفرق — وهو حصّة زادنا وأجرته معاً. حصّتك أنت من ذلك
         الفرق هي ما ينتظر التسوية.

         والطلب المدفوع إلكترونياً `cashToCollect = 0` بحكم money.js،
         فلا يزيد جيبه شيئاً — والحساب يبقى صحيحاً بلا شرط إضافي.

         `increment` لا قراءة-ثم-كتابة: طلبان يُسلَّمان في نفس الثانية
         لا يدهس أحدهما الآخر. وفشلُه لا يُسقط التسليم — تسليمٌ تمّ
         فعلاً أهمّ من عدّاد. */
      /* التسليم يُقيَّد المالَ ويزيد الكاش — فلا يُقبل إلا من حالةٍ
       * يصحّ أن يسبقها تسليم. القفز من PENDING إلى DELIVERED مباشرةً
       * (نداءٌ ملفَّق) كان يُقيَّد كاشاً ويكتب ثلاثة قيود عن طلبٍ لم
       * يمرّ بمندوبٍ قطّ. الإدارة تُستثنى — تصحيحُها قرارُها. */
      const DELIVERABLE_FROM = ['DRIVER_ASSIGNED', 'AT_RESTAURANT', 'PICKED_UP', 'ON_THE_WAY'];
      const deliveryIsValid = status === 'DELIVERED' &&
        (req.isAdmin || DELIVERABLE_FROM.includes(String(cur.status || '')));

      if (status === 'DELIVERED' && !deliveryIsValid) {
        console.warn('🔒 تسليم من حالة غير صالحة:', id, '| من:', cur.status, '| الطالب:', meId);
        return res.status(409).json({
          success: false,
          error: 'لا يمكن تسليم طلبٍ لم يُستلم بعد'
        });
      }

      if (deliveryIsValid) {
        const m = cur.money || {};
        const drvId = curDrvKey || meId;
        try {
          const FV = require('firebase-admin').firestore.FieldValue;
          /* رقمان مختلفان لحقيقتين مختلفتين:

             `cashOnHand` = الكاش الزائد في جيبه = التحصيل ناقص ما دفعه
               للمحلّ = عمولة زادنا + أجرته معاً. رقمٌ تشغيليّ للعرض.

             `debtToZadna` = ما يدين به لك فعلاً = العمولة وحدها
               (`driverOwesZadna`: صفرٌ للطلب الإلكتروني). وهذا وحده ما
               يُحجَب عليه.

             خلطُهما كان العطب: الحجب على `cashOnHand` يبلغ سقفه بأجرة
             المندوب — مالِه هو — فيُحجَب مندوبٌ دَينه صفر بعد ~٥٩ طلباً.
             الآن الحجب على الدَّين وحده، فمن سدّد عاد فوراً. */
          const patchUser = {};
          const kept = Math.max(0, Number(m.cashToCollect || 0) - Number(m.payToRestaurant || 0));
          if (kept > 0) patchUser.cashOnHand = FV.increment(kept);
          const owes = Number(m.driverOwesZadna || 0);
          if (owes > 0) patchUser.debtToZadna = FV.increment(owes);
          if (drvId && Object.keys(patchUser).length) {
            await db.collection('users').doc(String(drvId)).update(patchUser);
          }
        } catch (e) {
          console.warn('⚠️ تعذّر تحديث كاش/دَين المندوب:', e.message);
        }

        /* ═══ قيود لحظة التسليم ═══
         *
         * هنا يتحرّك المال فعلياً، فهنا تُكتب القصّة. وثلاثة قيود لا
         * واحد، لأن ثلاثة أشياء وقعت: قُبض من الزبون، ودُفع للمحلّ،
         * وانتقلت البضاعة.
         *
         * وكلّها `neutral` في الكاش: لا شيء دخل خزنتك ولا خرج منها —
         * المال مرّ بين الزبون والمندوب والمحلّ. ما يبقى لك هو
         * العمولة، وتُقيَّد يوم التسوية لا اليوم. */
        const drvName = (cur.driver && cur.driver.name) || '';
        const collectedVia = String(cur.collectedVia || '');
        const paidOnline = (m.paidOnline === true);

        const entries = [];

        if (!paidOnline && Number(m.cashToCollect) > 0) {
          entries.push({
            kind: collectedVia === 'qr' ? ledger.KINDS.COLLECTED_QR : ledger.KINDS.COLLECTED_CASH,
            orderId: String(id),
            amount: m.cashToCollect,
            direction: 'neutral',
            actorId: drvId || null, actorRole: 'driver', actorName: drvName,
            reference: cur.paymentReference || null,
            note: collectedVia === 'qr'
              ? 'تحويل على حساب المندوب — لم يمرّ بزادنا'
              : 'نقداً من الزبون',
          });
        }

        if (!paidOnline && Number(m.payToRestaurant) > 0) {
          entries.push({
            kind: ledger.KINDS.PAID_RESTAURANT,
            orderId: String(id),
            amount: m.payToRestaurant,
            direction: 'neutral',
            actorId: drvId || null, actorRole: 'driver', actorName: drvName,
            note: `للمحلّ ${cur.restaurant || cur.restaurantId || ''} — نقداً وقت الاستلام`,
            meta: { restaurantId: cur.restaurantId || null },
          });
        }

        entries.push({
          kind: ledger.KINDS.DELIVERED,
          orderId: String(id),
          amount: m.grandTotal || 0,
          direction: 'neutral',
          actorId: drvId || null, actorRole: 'driver', actorName: drvName,
          note: paidOnline
            ? `مدفوع مسبقاً — عليك ${m.owedToRestaurant || 0} للمحلّ و${m.owedToDriver || 0} للمندوب`
            : `عمولة زادنا ${m.zadnaCommission || 0} ₪ تنتظر التسوية`,
          meta: { paidOnline, zadnaCommission: m.zadnaCommission || 0 },
        });

        ledger.recordMany(db, entries).catch(() => {});
      }

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
            paidOnline: cur.paidOnline === true,
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

/* ============================================================
   POST /api/orders/:id/payment — الباب الوحيد الذي يجعل طلباً مدفوعاً.

   ولماذا مسارٌ خاصّ ولا يكفي `PATCH` بحقلٍ واحد؟

   لأن `paidOnline` ليست علامةً تُرفع — هي **حدثٌ يقلب كل الحساب**.
   والمال محسوبٌ ومُجمَّدٌ داخل الطلب منذ إنشائه (`order.money`)، وكل
   قارئ يُفضّل المُجمَّد على إعادة الحساب — وهذا صحيحٌ ومقصود: طلبٌ
   سُلّم بنسبةٍ يبقى محاسَباً بها.

   فلو رفعنا العلامة وحدها لبقي `cashToCollect` كما جُمّد: **المندوب
   يذهب يطالب زبوناً دفع بالبطاقة بمئةٍ وخمسة عشر شيكلاً**. وتُطالبه
   أنت بعمولةٍ اقتطعتَها أصلاً من المال الذي وصلك — تحصيلٌ مرّتين.

   فالقاعدة: **من يرفع العلامة يُعيد الحساب في النداء نفسه.** لا يمرّ
   أحدهما دون الآخر، ولا يُترك للمستقبل أن يتذكّر.

   ومن يستطيع مناداته: الإدارة وحدها (أو ويب-هوك البوابة بمفتاحها).
   لا التطبيق — من يقول «دفعتُ» هو مزوّد الدفع لا الجهاز الذي بيد
   الزبون.
   ============================================================ */
router.post('/:id/payment', async (req, res) => {
  try {
    const requireAdmin = req.app.get('requireAdmin');
    if (!requireAdmin) return res.status(503).json({ success: false, error: 'الحماية غير مضبوطة' });
    // نغلّف يدوياً كي نُرجع رسالةً عربية بدل تمرير الطلب
    await new Promise((resolve, reject) =>
      requireAdmin(req, res, (e) => (e ? reject(e) : resolve())));
  } catch (e) {
    return; // الحارس ردّ بنفسه
  }

  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'لا قاعدة بيانات' });

    const b = req.body || {};
    const id = String(req.params.id);
    const ref = db.collection('orders').doc(id);
    const snap = await ref.get();
    meter.addReads(1, 'تأكيد دفع');
    if (!snap.exists) return res.status(404).json({ success: false, error: 'الطلب غير موجود' });

    const cur = snap.data() || {};
    const status = String(cur.status || '');
    if (status === 'CANCELLED') {
      return res.status(409).json({
        success: false,
        error: 'الطلب ملغيّ — لا يُعلَّم مدفوعاً. سجّل استرداداً بدل ذلك.'
      });
    }
    if (cur.paidOnline === true) {
      return res.json({ success: true, already: true, money: cur.money, message: 'مسجَّل مدفوعاً سابقاً' });
    }

    /* `qr` هنا كأختيها: مالٌ وصل زادنا فعلاً. والحسابات تنقلب
     * انقلابها نفسه — المندوب لا يحصّل ولا يدفع ولا يدين. */
    const method = ['card', 'wallet', 'qr'].includes(String(b.method)) ? String(b.method) : 'card';

    /* المرجع من البوابة — بدونه لا سبيل لمطابقة كشفك بكشفها عند خلاف.
     * ونجعله مطلوباً: تأكيدُ دفعٍ بلا مرجع كلامٌ لا وثيقة. */
    const reference = String(b.reference || '').trim().slice(0, 120);
    if (!reference) {
      return res.status(400).json({ success: false, error: 'مرجع العملية من البوابة مطلوب' });
    }

    /* لا نصدّق مبلغاً من الخارج: نتحقّق أنه يطابق ما حسبناه نحن.
     * بوابةٌ تقول «دُفع ٥٠» على طلبٍ ثمنه ١١٥ إمّا خطأٌ أو تلاعب. */
    const expected = Number((cur.money && cur.money.grandTotal) != null
      ? cur.money.grandTotal : cur.grandTotal);
    const paidAmt = Number(b.amount);
    if (Number.isFinite(paidAmt) && Number.isFinite(expected) && Math.abs(paidAmt - expected) > 0.01) {
      return res.status(409).json({
        success: false,
        error: `المبلغ المدفوع (${paidAmt}) لا يطابق قيمة الطلب (${expected}) — لم يُعلَّم مدفوعاً`
      });
    }

    /* وهنا بيت القصيد: نُعيد بناء `money` كاملاً بحقول الدفع الجديدة.
     * والنسب تبقى مجمَّدة لأن `breakdown` تقرأ `o.money.restaurantRate`
     * أولاً — فالطلب يُحاسَب بنسبته لا بنسبة اليوم. */
    const patched = { ...cur, paidOnline: true, paymentStatus: 'paid', paymentMethod: method };
    const m = applyPayment(breakdown(patched), patched);

    /* ══════════════════════════════════════════════════════════════
       التأكيد المتأخّر — ومن يستحقّ التسعين.

       `applyPayment` تفترض أنك المدين للمحلّ، وهو صحيحٌ حين يُدفع
       الثمن قبل أن يتحرّك المندوب. لكن تأكيدَ تحويلٍ بالـQR قد يصلك
       بعد أن يكون المندوب استلم الطلب — وهو يدفع للمحلّ نقداً لحظة
       الاستلام.

       فلو تركنا الحساب على حاله لدفعتَ التسعين ثانيةً للمحلّ الذي
       قبضها، ولم تُعِد للمندوب ما أخرجه من جيبه. تسعون تضيع في كل
       طلب، ولا شاشة تُظهر الفرق — لأن المجموع يبقى متّزناً ظاهرياً.

       فنُحوّل الدَّين إلى صاحبه: المحلّ قبض، والمندوب هو الدائن الآن
       بما دفع مضافاً إليه أجرته.
       ══════════════════════════════════════════════════════════════ */
    const AFTER_PICKUP = ['PICKED_UP', 'ON_THE_WAY', 'DELIVERED'];
    const driverAlreadyPaid = AFTER_PICKUP.includes(status) && !(cur.paidOnline === true);

    if (driverAlreadyPaid && m.owedToRestaurant > 0) {
      const reimburse = m.owedToRestaurant;
      m.owedToDriver      = r2m(m.owedToDriver + reimburse);
      m.zadnaOwesDriver   = r2m(m.zadnaOwesDriver + reimburse);
      m.owedToRestaurant  = 0;
      m.driverPaidRestaurant = reimburse;   // أثرٌ يبقى: لماذا كبر دَينك للمندوب
    }

    await ref.update({
      paidOnline: true,
      paymentStatus: 'paid',
      paymentMethod: method,
      paymentReference: reference,
      paidAt: new Date(),
      money: m,
      grandTotal: m.grandTotal,
    });

    // الكاش يحمل نسخةً بـ`cashToCollect` القديمة — ولو بقيت لطالب المندوب بها
    invalidate('orders:all');

    /* المال دخل خزنتك فعلاً — `in`، وهو الفرق بين الإلكتروني والكاش.
     * وهذا القيد هو ما يجعل «ما عليّ للشركاء» رقماً موثّقاً لا تقديراً. */
    ledger.record(db, {
      kind: ledger.KINDS.PAID_ONLINE,
      orderId: String(id),
      amount: m.grandTotal,
      direction: 'in',
      actorId: (req.user && req.user.userId) || cur.customerId || null,
      actorRole: req.isAdmin ? 'admin' : 'customer',
      actorName: cur.customerName || '',
      reference,
      note: `${method} — عليك للمحلّ ${m.owedToRestaurant} وللمندوب ${m.owedToDriver}`,
      meta: { method, owedToRestaurant: m.owedToRestaurant, owedToDriver: m.owedToDriver },
    }).catch(() => {});

    const io = req.app.get('socketio');
    if (io) io.emit('order_paid', { orderId: id, method, money: m });

    /* إن كان محجوزاً بانتظار الدفع — يصل المطعم الآن، لا قبل التأكيد.
     * لا شيء يحدث إن لم يكن محجوزاً (طلبٌ حيّ دُفع لاحقاً، أو كاش). */
    try { await releaseHeldOrder(req.app, db, id, { ...cur, grandTotal: m.grandTotal }); } catch (_) {}

    console.log(`💳 دُفع إلكترونياً: #${id} · ${m.grandTotal} ₪ · ${method} · مرجع ${reference}`
      + ` — عليك للمحلّ ${m.owedToRestaurant} وللمندوب ${m.owedToDriver}`);

    res.json({
      success: true,
      orderId: id,
      money: m,
      note: 'أُعيد حساب المال: المندوب لا يحصّل ولا يدين — وأنت تدين للمحلّ والمندوب',
    });
  } catch (e) {
    console.error('❌ تأكيد الدفع:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   POST /api/orders/:id/qr-claim — الزبون يبلّغ أنه حوّل.

   وهذا المسار **لا يجعل الطلب مدفوعاً**، وهذا كلّ الأمر.

   الفرق بين «قال إنه دفع» و«وصلني المال» هو الفرق بين منصّةٍ تُسرَق
   وأخرى لا تُسرَق. صورةُ شاشةٍ تُزوَّر في دقيقة، ورقمُ مرجعٍ يُخترع
   بلا كلفة. فلو كان هذا المسار يقلب `paidOnline` إلى true لصار بابَ
   سرقةٍ مفتوحاً: يطلب، يكتب رقماً من رأسه، يستلم طعامه، ولا شيء وصلك.

   ما يفعله: يسجّل الادّعاء بوقته ورقمه، ويُنبّهك، ويكتب سطراً في
   الدفتر. والتأكيد يبقى عندك — من اللوحة اليوم، ومن رسائل بنكك حين
   نبنيها. ثم يمرّ على `/payment` الذي يتحقّق من المبلغ ويقلب الحساب.

   ولماذا نقبل الادّعاء أصلاً بدل تجاهله؟ لأنه يوفّر عليك البحث:
   يأتيك الرقم والمبلغ والوقت جاهزةً، فتطابقها بكشفك في ثوانٍ بدل أن
   تسأل الزبون وتنتظر ردّه.
   ══════════════════════════════════════════════════════════════════ */
router.post('/:id/qr-claim', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    const id = String(req.params.id);
    if (!db) return res.status(503).json({ success: false, error: 'لا قاعدة بيانات' });

    const ref = db.collection('orders').doc(id);
    const snap = await ref.get();
    meter.addReads(1, 'ادّعاء تحويل');
    if (!snap.exists) return res.status(404).json({ success: false, error: 'الطلب غير موجود' });

    const o = snap.data() || {};

    if (String(o.status || '') === 'CANCELLED') {
      return res.status(409).json({ success: false, error: 'الطلب ملغيّ' });
    }
    if (o.paidOnline === true) {
      return res.json({ success: true, already: true, message: 'الطلب مؤكَّد الدفع سلفاً' });
    }

    /* صاحبُ الطلب وحده يبلّغ عنه. وبلا هذا يستطيع أي مستخدمٍ مسجَّل
     * أن يُغرق طلبات الآخرين بادّعاءاتٍ كاذبة فيُربك كشفك. */
    const me = req.user || {};
    const meId = String(me.userId || me.id || '');
    const mePhone = String(me.phone || '');
    const isOwner = (meId && String(o.customerId || '') === meId)
                 || (mePhone && String(o.customerPhone || '') === mePhone);
    if (!req.isAdmin && !isOwner) {
      return res.status(403).json({ success: false, error: 'هذا الطلب ليس لك' });
    }

    const reference = String((req.body || {}).reference || '').trim().slice(0, 120);
    if (reference.length < 3) {
      return res.status(400).json({ success: false, error: 'اكتب رقم عملية التحويل كما ظهر لك' });
    }

    /* ═══════════════════════════════════════════════════════════════
       رقم التحويل الواحد لا يُبلَّغ عنه مرّتين.

       تحويلٌ بنكي واحد يخصّ طلباً واحداً. وبلا هذا الحارس يستطيع
       الزبون (سهواً أو قصداً) كتابة نفس رقم العملية على طلبين، فيصير
       تحويلٌ حقيقي واحد «يؤكّد» طلبين — أحدهما دفعه فعلاً والآخر لا.
       مسار البنك يطابق أوّل ما يجده، فيبقى الثاني قابلاً للتأكيد
       اليدوي بلا أن يقابله مالٌ حقيقي.

       نطبّع المرجع (فـ«١٢٣» و«123» و«ABC 123» رقمٌ واحد) ونرفض
       المكرَّر على طلبٍ حيٍّ آخر. المُلغى لا يمنع — رقمه تحرّر. */
    const refNorm = normRef(reference);
    try {
      const dup = await db.collection('orders')
        .where('qrClaim.refNorm', '==', refNorm).limit(5).get();
      meter.addReads(dup.size, 'فحص تكرار مرجع QR');
      const clash = dup.docs.find(d => {
        if (d.id === id) return false;                    // نفس الطلب — تحديث لا تكرار
        const od = d.data() || {};
        return String(od.status || '') !== 'CANCELLED';   // المُلغى حرّر رقمه
      });
      if (clash) {
        return res.status(409).json({
          success: false,
          error: 'رقم هذا التحويل مسجَّل على طلبٍ آخر. تأكّد من الرقم — كل تحويلٍ لطلبٍ واحد.',
        });
      }
    } catch (e) {
      /* غياب الفهرس المركّب يُسقط الاستعلام — لا نمنع البلاغ لأجله،
       * فالتأكيد لاحقاً يبقى بيدك. لكن نُسجّله كي لا يمرّ صامتاً. */
      console.warn('⚠️ تعذّر فحص تكرار مرجع QR (فهرس؟):', e.message);
    }

    const expected = Number((o.money && o.money.grandTotal) != null ? o.money.grandTotal : o.grandTotal) || 0;

    await ref.update({
      paymentMethod: 'qr',
      paymentStatus: 'claim_pending',
      qrClaim: {
        reference,
        /* الصيغة المطبَّعة بجانب الخام: الخام يُعرض للزبون كما كتبه،
         * والمطبَّع هو ما يطابقه مسار البنك. */
        refNorm: normRef(reference),
        amount: expected,
        at: new Date(),
        by: meId || mePhone || 'customer',
      },
    });
    invalidate('orders:all');

    ledger.record(db, {
      kind: ledger.KINDS.QR_CLAIMED,
      orderId: id,
      amount: 0,                 // لا مال تحرّك — الميزان لا يتأثّر
      direction: 'neutral',
      actorId: meId || null,
      actorRole: req.isAdmin ? 'admin' : 'customer',
      actorName: o.customerName || '',
      reference,
      note: `أبلغ عن تحويل ${expected} ₪ — بانتظار تأكيدك`,
      meta: { claimedAmount: expected },
    }).catch(() => {});

    /* تنبيهك أنت لا المندوب: المندوب لا يملك تأكيد وصول مالٍ لحسابك،
     * وإخباره يغريه بتسليم الطلب على ادّعاءٍ لم يُتحقّق منه. */
    const io = req.app.get('socketio');
    if (io) {
      io.emit('qr_claim', {
        orderId: id, reference, amount: expected,
        customerName: o.customerName || '', customerPhone: o.customerPhone || '',
        at: new Date(),
      });
    }

    console.log(`🔔 ادّعاء تحويل #${id} · مرجع ${reference} · ${expected} ₪ — لم يُؤكَّد`);

    res.status(201).json({
      success: true,
      confirmed: false,
      message: 'وصلنا بلاغك — نتأكّد من التحويل ونؤكّد طلبك',
    });
  } catch (e) {
    console.error('❌ ادّعاء تحويل:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

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
      /* نفس قاعدة الفلتر: المعرّف يحكم وحده إن وُجد.
       * وهنا أخطر — من يشاركك الرقم كان يستطيع **إلغاء طلبك**. */
      const oid = o.customerId ? String(o.customerId) : '';
      const mine = oid
        ? (!!myId && oid === myId)
        : samePhone(o.customerPhone, me && me.phone);
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

    /* ============================================================
       إلغاءُ طلبٍ **دُفع ثمنه** ليس إلغاءً — هو دَينٌ عليك للزبون.

       ثلاث رسائل في هذا الملفّ تقول للزبون «لم يُخصم منك شيء». وهي
       صحيحة في الكاش (لم يدفع بعد)، وكذبٌ صريح في الإلكتروني (دفع
       ووصلك ماله).

       فنُعلّم الطلب بأن استرداداً مستحقّاً، ويظهر في اللوحة. ولا
       نُنفّذ الاسترداد آلياً: إعادةُ المال تمرّ ببوابة الدفع بمسارها
       الخاص، وقرارُ الإرجاع قرارُك أنت. لكن **لا يضيع الأثر**. */
    const wasPaid = o.paidOnline === true || o.paymentStatus === 'paid';
    const refundAmt = wasPaid
      ? Number((o.money && o.money.grandTotal) != null ? o.money.grandTotal : o.grandTotal) || 0
      : 0;

    await ref.update({
      status: 'CANCELLED',
      statusAr: STATUS_AR.CANCELLED,
      cancelledBy: req.isAdmin ? 'admin' : 'customer',
      cancelReason: reason,
      cancelledAt: new Date(),
      ...(wasPaid ? {
        refundDue: refundAmt,
        refundStatus: 'pending',
        paymentStatus: 'refund_pending',
      } : {}),
    });

    /* الإلغاء حدثٌ يُقيَّد ولو لم يتحرّك فيه قرش: الطلب الذي اختفى بلا
     * أثرٍ في الدفتر هو بابُ كل خلاف لاحق. */
    {
      const who = req.isAdmin ? 'admin' : 'customer';
      const cancelEntries = [{
        kind: ledger.KINDS.CANCELLED,
        orderId: String(id),
        amount: Number((o.money && o.money.grandTotal) || o.grandTotal || 0),
        direction: 'neutral',
        actorId: (req.user && req.user.userId) || null,
        actorRole: who, actorName: o.customerName || '',
        note: reason || 'بلا سبب مذكور',
        meta: { wasPaid },
      }];
      /* ودَينُ الاسترداد قيدٌ مستقلّ: المال لم يخرج بعد، لكنه صار
       * التزاماً. يخرج يوم تُنفَّذ الإعادة بقيد refund_paid. */
      if (wasPaid && refundAmt > 0) {
        cancelEntries.push({
          kind: ledger.KINDS.REFUND_DUE,
          orderId: String(id),
          amount: refundAmt,
          direction: 'neutral',
          actorId: (req.user && req.user.userId) || null,
          actorRole: who,
          actorName: o.customerName || '',
          note: `استرداد مستحقّ للزبون ${o.customerPhone || ''} — لم يُنفَّذ بعد`,
          meta: { phone: o.customerPhone || '' },
        });
      }
      ledger.recordMany(db, cancelEntries).catch(() => {});
    }

    if (wasPaid) {
      console.warn(`💸 إلغاء طلبٍ مدفوع #${id} — استرداد مستحقّ ${refundAmt} ₪ للزبون ${o.customerPhone || ''}`);
      const io2 = req.app.get('socketio');
      if (io2) io2.emit('refund_due', { orderId: String(id), amount: refundAmt, phone: o.customerPhone || '' });
    }
    /* statusAr مع status — لا أحدهما.
     *
     * التطبيق يقرأ `statusAr` **قبل** `status` (سطر ١١١ في
     * OrdersViewModel). فكتابةُ الإنجليزي وحده في الكاش تترك العربيَّ
     * على حاله القديم، والتطبيق يصدّق القديم: طلبٌ أُلغي يبقى ظاهراً
     * حيّاً حتى ينتهي عمر الكاش. الحقيقة في مكانين، فلتُكتب في كليهما. */
    updateCached('orders:all', list =>
      list.map(x => (String(x.id) === String(id)
        ? { ...x, status: 'CANCELLED', statusAr: STATUS_AR.CANCELLED } : x)));

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

/* ============================================================
   نداء واحد لكل دورة مهما كثرت الطلبات العالقة — تصحيحُ خطأٍ لي.

   بنيتُ النداء المتجدّد لكل طلب على حدة، ولم أُقيّده على مستوى
   الدورة. فبطلبين عالقين يُنادى المناديب **مرّتين في نفس الثانية**،
   وبثلاثة ثلاثاً — كلها بنفس النصّ تقريباً.

   وظهر أثره فوراً: السجلّ يُظهر `alert → أُرسل 2` ثلاث مرات متتالية،
   أي أن كل مندوب تلقّى ثلاثة إنذارات متطابقة. ومن يُقصف هكذا يُطفئ
   إشعارات زادنا — فنخسر إنذار الطلب الحقيقي حين يأتي.

   والصواب: نداء واحد في كل دورة مكنسة مهما كان عدد المعلّقين — يكفي
   أن يفتح المندوب تطبيقه ليرى الجميع. */
let _nudgedThisTick = false;

/* ============================================================
   الطلب المهجور — بعد اثنتي عشرة ساعة لم يعد طلباً.

   قرارك «لا إلغاء آلياً» صحيح ومحفوظ: طلبٌ عمره ساعة قد يلتقطه
   مندوب، وروبوتٌ يلغيه يُخسر شريكاً مالاً.

   لكن طلباً عمره **ثلاث عشرة ساعة** ليس معلّقاً — هو مهجور. وجوده
   ضررٌ خالص: المكنسة تنادي المناديب من أجله كل دورة، فيُقصفون
   بإنذارات لطلبٍ من الأمس، ويظنّ صاحب المنصّة أن التوزيع معطّل.
   وهذا ما حدث حرفياً بالطلبين 862307 و647921.

   والزبون؟ نام وصحا ولم يأته شيء. أن نقول له «اعتذارنا» بعد نصف
   يوم أصدق من أن نتركه ينتظر أبداً.

   اثنتا عشرة ساعة حدٌّ لا يمسّ قرارك: لا طلب حقيقي ينتظرها.
   ZADNA_ABANDON_HOURS=0 يُعطّله كلياً.
   ============================================================ */
const ABANDON_MS = Number(process.env.ZADNA_ABANDON_HOURS || 12) * 3600 * 1000;

async function sweepReadyUnclaimed(app, db, o) {
  const id = String(o.id);
  const created = orderCreatedMs(o);
  if (!created) return;                    // تاريخ لا نفهمه = لا حكم عليه
  const age = Date.now() - created;

  if (ABANDON_MS > 0 && age >= ABANDON_MS) {
    _readySeen.delete(id);
    try {
      // الباب الموحّد — يكتب `refundDue` إن كان مدفوعاً
      const { patch, ledgerEntries } = buildCancellation({ ...o, id }, {
        by: 'system', reason: 'مهجور — لم يلتقطه مندوب خلال ١٢ ساعة',
      });
      await db.collection('orders').doc(id).update(patch);
      ledger.recordMany(db, ledgerEntries).catch(() => {});
      updateCached('orders:all', l => l.map(x => (String(x.id) === id ? { ...x, status: 'CANCELLED', statusAr: STATUS_AR.CANCELLED } : x)));
      const io = app.get('socketio');
      if (io) io.emit('order_updated', { orderId: id, status: 'CANCELLED', timestamp: new Date() });
      notifyCustomer(app, o.customerPhone, {
        title: 'اعتذارنا — أُلغي طلبك',
        body: (o.paidOnline === true)
          ? 'لم نستطع توصيله. المبلغ سيُعاد إليك — نأسف على الانتظار'
          : 'لم نستطع توصيله. لم يُخصم منك شيء — نأسف على الانتظار',
        channel: 'update', data: { orderId: id, type: 'status', status: 'CANCELLED' },
      }).catch(() => {});
      console.warn(`🧹 أُلغي طلب مهجور ${id} — عمره ${Math.round(age / 3600000)} ساعة`);
    } catch (e) {
      console.warn('⚠️ تعذّر إلغاء طلب مهجور:', id, e.message);
    }
    return;
  }
  const st = _readySeen.get(id) || { stage: 0, lastNudge: 0 };

  /* حارس الدورة: أول طلب معلّق ينادي، والبقية تكتفي بتسجيل مرحلتها. */
  const nudgeDrivers = () => {
    if (_nudgedThisTick) return;
    _nudgedThisTick = true;
    return notifyDrivers(app, {
      title: 'طلب ما زال بانتظار مندوب 📦',
      body: `${o.restaurant || 'محلّ'} — ${o.grandTotal || o.totalAmount || 0} ₪`,
      data: { orderId: id, type: 'new_ready_order' },
      paidOnline: o.paidOnline === true,
    }).catch(() => {});
  };

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

/* ============================================================
   مهلة الدفع — طلب الـQR المحجوز لا ينتظر التحويل إلى الأبد.

   الزبون اختار الدفع بالكود ولم يحوّل؟ الطلب في `PENDING_PAYMENT` لا
   يراه المطعم. لكن بقاءه معلّقاً بلا نهاية يملأ اللوحة بطلباتٍ ميتة،
   والزبون قد يكون بدّل رأيه. فبعد المهلة (٣٠ دقيقة، `QR_PAYMENT_TIMEOUT_MIN`)
   يُلغى — **بلا استرداد** لأنه لم يُدفع أصلاً، بابُ الإلغاء الموحّد يتكفّل.
   `=0` يُعطّل الإلغاء التلقائي فيبقى حتى يُدفع أو يُلغى يدوياً.
   ============================================================ */
const PAY_TIMEOUT_MS = Number(process.env.QR_PAYMENT_TIMEOUT_MIN || 30) * 60000;

async function sweepUnpaidHeld(app, db, o, now) {
  if (PAY_TIMEOUT_MS <= 0) return;             // مُعطَّل صراحةً
  const created = orderCreatedMs(o);
  if (!created) return;                        // تاريخٌ لا نفهمه = لا حكم
  if ((now - created) < PAY_TIMEOUT_MS) return;
  const id = String(o.id);
  try {
    // الباب الموحّد — لم يُدفع شيء فلا `refundDue`، لكنه يكتب القيد والحالة
    const { patch, ledgerEntries } = buildCancellation({ ...o, id }, {
      by: 'system', reason: 'لم يصل تحويلك خلال مهلة الدفع',
    });
    await db.collection('orders').doc(id).update(patch);
    ledger.recordMany(db, ledgerEntries).catch(() => {});
    updateCached('orders:all', l => l.map(x => (String(x.id) === id
      ? { ...x, status: 'CANCELLED', statusAr: STATUS_AR.CANCELLED } : x)));
    const io = app.get('socketio');
    if (io) io.emit('order_updated', { orderId: id, status: 'CANCELLED', timestamp: new Date() });
    notifyCustomer(app, o.customerPhone, {
      title: 'انتهت مهلة الدفع — أُلغي طلبك',
      body: 'لم يصلنا تحويلك خلال المهلة. لم يُخصم منك شيء — أعد الطلب وقتما شئت',
      channel: 'update', data: { orderId: id, type: 'status', status: 'CANCELLED' },
    }).catch(() => {});
    console.warn(`⏳ أُلغي طلب محجوز ${id} — لم يصل تحويله خلال ${PAY_TIMEOUT_MS / 60000} دقيقة`);
  } catch (e) {
    console.warn('⚠️ مكنسة مهلة الدفع:', id, e.message);
  }
}

function startRestaurantTimeout(app) {
  const tick = async () => {
    try {
      const db = app.get('db');
      if (!db) return;
      // نقرأ الكاش نفسه الذي يستعمله GET — بلا استعلام جديد
      const list = peekCached('orders:all');
      if (!Array.isArray(list) || !list.length) return;
      const now = Date.now();
      _nudgedThisTick = false;   // دورة جديدة → يُسمح بنداء واحد

      for (const o of list) {
        const st = String(o.status || '');
        // الطلب المحجوز بانتظار الدفع — مهلته الخاصّة قبل كل شيء
        if (st === 'PENDING_PAYMENT') { await sweepUnpaidHeld(app, db, o, now); continue; }
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

        /* `EXPIRE_MS > 0` شرطٌ ناقص كان فخّاً.
         *
         * `ZADNA_ABANDON_HOURS=0` تُعطّل مكنسة المهجور (شرطها صريح).
         * فمن يقيس عليها ويضع `REST_EXPIRE_MIN=0` ظانّاً أنه يُعطّل
         * مهلة المطعم — يفعل العكس تماماً: `age >= 0` صادقة دائماً،
         * فيُلغى **كل طلب في اللحظة التي يُنشأ فيها**، ويصل كل زبون
         * «اعتذارنا، المطعم لم يردّ» قبل أن يرفع المطعم رأسه.
         *
         * متغيّرٌ اسمه «عطّلني» لا يجوز أن يعني «ألغِ كل شيء». */
        if (EXPIRE_MS > 0 && age >= EXPIRE_MS && stage < 3) {
          _staleSeen.set(id, 3);
          // الباب الموحّد — يكتب `refundDue` إن كان مدفوعاً
          const { patch, ledgerEntries } = buildCancellation({ ...o, id }, {
            by: 'system', reason: 'لم يردّ المطعم',
          });
          await db.collection('orders').doc(id).update(patch);
          ledger.recordMany(db, ledgerEntries).catch(() => {});
          updateCached('orders:all', l => l.map(x => (String(x.id) === id ? { ...x, status: 'CANCELLED', statusAr: STATUS_AR.CANCELLED } : x)));
          const io = app.get('socketio');
          if (io) io.emit('order_updated', { orderId: id, status: 'CANCELLED', timestamp: new Date() });
          notifyCustomer(app, o.customerPhone, {
            title: 'اعتذارنا — أُلغي طلبك',
            body: (o.paidOnline === true)
              ? 'المطعم لم يردّ. المبلغ سيُعاد إليك، وجرّب مطعماً آخر'
              : 'المطعم لم يردّ. لم يُخصم منك شيء، وجرّب مطعماً آخر',
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

    /* الباب الموحّد: يكتب `refundDue` إن كان مدفوعاً — فوعدُ «سيُعاد
     * إليك» أدناه يصير أثراً في `refunds/pending` لا كلمةً تضيع. */
    const { patch, ledgerEntries } = buildCancellation({ ...o, id }, {
      by: 'shop', reason: `رفض المحلّ: ${code}`,
      actorId: (req.user && req.user.userId) || null, actorName: o.customerName,
    });
    await ref.update({ ...patch, cancelReason: code, cancelReasonAr: reasonAr });
    ledger.recordMany(db, ledgerEntries).catch(() => {});
    updateCached('orders:all', l => l.map(x => (String(x.id) === id ? { ...x, status: 'CANCELLED', statusAr: STATUS_AR.CANCELLED } : x)));
    const io = req.app.get('socketio');
    if (io) io.emit('order_updated', { orderId: id, status: 'CANCELLED', timestamp: new Date() });

    // الصدق مع الزبون: السبب الحقيقي بلسان مهذّب، لا «أُلغي» غامضة
    notifyCustomer(req.app, o.customerPhone, {
      title: 'اعتذارنا — المحلّ لم يستطع تلبية طلبك',
      body: (o.paidOnline === true)
        ? `${reasonAr}. المبلغ سيُعاد إليك — جرّب محلاً آخر`
        : `${reasonAr}. لم يُخصم منك شيء — جرّب محلاً آخر أو أعد المحاولة لاحقاً`,
      channel: 'update', data: { orderId: id, type: 'status', status: 'CANCELLED' },
    }).catch(() => {});

    console.log(`🚫 رفض المحلّ ${o.restaurantId} الطلب ${id} — السبب: ${code}`);
    res.json({ success: true, reason: code });
  } catch (e) { fail(req, res, e, 'رفض المحلّ'); }
});

/* ============================================================
   إسناد الطلب وسحبه — يد الإدارة على التوزيع.

   لماذا وُجد: التوزيع آليّ (بثّ للجميع، الأقرب يُنبَّه أولاً) وهو
   يعمل في الحالة العادية. لكن الواقع فيه ما لا تحسبه خوارزمية:
   مندوبٌ تعطّلت درّاجته وطلبُه في يده، وزبونٌ يتّصل مستعجلاً، وطلبٌ
   لا يلتقطه أحد وأنت تعرف من يستطيع.

   وقبل هذا لم يكن أمامك إلا الإلغاء — وهو أسوأ ما يمكن: خسارة طلبٍ
   لأن أداةً بسيطة غير موجودة.

   ثلاثة أفعال:
     · assign  — أسند لمندوب بعينه (المعلّق أو المُسنَد لغيره)
     · unassign — اسحب من المندوب وأعده متاحاً للجميع
     · candidates — من المتاح الآن ومسافته من المحلّ، لتقرّر برقم

   والإسناد لا يقفز فوق الحقائق: المندوب المجمَّد أو خارج الدوام أو
   فوق سقف الكاش يُرفض بسبب مكتوب — لا نُسند طلباً لمن لا يستطيع.
   ============================================================ */

const ADMIN_ASSIGNABLE = ['PENDING_RESTAURANT', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP',
                          'DRIVER_ASSIGNED', 'AT_RESTAURANT', 'PICKED_UP', 'ON_THE_WAY'];

/** GET /api/orders/:id/candidates — المناديب المتاحون ومسافاتهم من المحلّ. */
router.get('/:id/candidates', async (req, res) => {
  try {
    if (!req.isAdmin) return res.status(403).json({ success: false, error: 'للإدارة فقط' });
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });

    const oSnap = await db.collection('orders').doc(String(req.params.id)).get();
    meter.addReads(1, 'مرشّحو الإسناد');
    if (!oSnap.exists) return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    const o = oSnap.data() || {};

    // موقع المحلّ لحساب المسافة — من الكاش المشترك لا بقراءة جديدة
    let sLat = null, sLng = null;
    try {
      const rests = peekCached('restaurants:raw');
      const r = Array.isArray(rests) ? rests.find(x => String(x.id) === String(o.restaurantId)) : null;
      if (r && Number.isFinite(Number(r.lat))) { sLat = Number(r.lat); sLng = Number(r.lng); }
    } catch (e) {}

    const snap = await db.collection('users').where('userType', '==', 'driver').get();
    meter.addReads(snap.size, 'مرشّحو الإسناد');
    const locs = req.app.get('lastDriverLocation') || new Map();
    /* سقف الكاش يُلغى للطلب المدفوع إلكترونياً — لا يضع في جيبه شيئاً.
     * وهنا نعرف الطلب (خلافاً لـ`notifyDrivers`)، فالفحص أدقّ. */
    const cap = (o.paidOnline === true) ? 0 : Number(process.env.ZADNA_CASH_CAP || 800);

    const out = [];
    snap.forEach(d => {
      const u = d.data() || {};
      const st = String(u.status || 'approved');
      const l = locs.get(String(d.id));
      let km = null;
      if (l && sLat != null) {
        const R = 6371, rad = x => x * Math.PI / 180;
        const dLat = rad(l.lat - sLat), dLng = rad(l.lng - sLng);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(sLat)) * Math.cos(rad(l.lat)) * Math.sin(dLng / 2) ** 2;
        km = Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.35 * 10) / 10;
      }
      /* نُرجع الجميع مع سبب المنع — لا نُخفي مندوباً ونترك السؤال
       * «وين فلان؟» بلا جواب. */
      const blocked = st !== 'approved' ? `الحساب ${st}`
        : u.onShift === false ? 'خارج الدوام'
        : (cap > 0 && Number(u.cashOnHand || 0) >= cap) ? `كاشه ${Math.round(u.cashOnHand)} ₪ (فوق السقف)`
        : null;
      out.push({
        id: d.id, name: u.name || d.id, phone: u.phone || '',
        km, online: !!l, cashOnHand: Number(u.cashOnHand || 0), blocked,
      });
    });

    // المتاح أولاً، ثم الأقرب
    out.sort((a, b) => (!!a.blocked - !!b.blocked) || ((a.km ?? 999) - (b.km ?? 999)));
    res.json({ success: true, orderId: String(req.params.id), shopHasLocation: sLat != null, drivers: out });
  } catch (e) { fail(req, res, e, 'مرشّحو الإسناد'); }
});

/** POST /api/orders/:id/assign  { driverId }  — أو {} للسحب. */
router.post('/:id/assign', async (req, res) => {
  try {
    if (!req.isAdmin) return res.status(403).json({ success: false, error: 'للإدارة فقط' });
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });

    const id = String(req.params.id);
    const ref = db.collection('orders').doc(id);
    const snap = await ref.get();
    meter.addReads(1, 'إسناد طلب');
    if (!snap.exists) return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    const o = snap.data() || {};

    const st = String(o.status || '');
    if (!ADMIN_ASSIGNABLE.includes(st)) {
      return res.status(409).json({
        success: false,
        error: st === 'DELIVERED' ? 'الطلب سُلّم — لا يُسند' : 'الطلب ملغى — لا يُسند',
      });
    }

    const driverId = String((req.body && req.body.driverId) || '').trim();

    /* ===== السحب: يعود متاحاً للجميع ===== */
    if (!driverId) {
      const prevKey = (o.driver && typeof o.driver === 'object')
        ? String(o.driver.id || o.driver.phone || '') : String(o.driverId || '');
      await ref.update({
        driver: null, driverId: null,
        status: 'READY_FOR_PICKUP', statusAr: STATUS_AR.READY_FOR_PICKUP,
        unassignedAt: new Date(), unassignedBy: 'admin',
      });
      updateCached('orders:all', l => l.map(x => (String(x.id) === id
        ? { ...x, driver: null, driverId: null, status: 'READY_FOR_PICKUP', statusAr: STATUS_AR.READY_FOR_PICKUP } : x)));
      const io = req.app.get('socketio');
      if (io) io.emit('order_updated', { orderId: id, status: 'READY_FOR_PICKUP', timestamp: new Date() });

      // المندوب السابق يُخبَر — لا يبحث عن طلبٍ اختفى من شاشته
      if (prevKey) {
        notifyDriverById(req.app, prevKey, {
          title: 'سُحب الطلب منك',
          body: 'الإدارة أعادت توزيعه. لا شيء عليك — تابع طلباتك الأخرى.',
          data: { orderId: id, type: 'unassigned' },
        }).catch(() => {});
      }
      notifyDrivers(req.app, {
        title: 'طلب متاح الآن 📦',
        body: `${o.restaurant || 'محلّ'} — ${o.grandTotal || o.totalAmount || 0} ₪`,
        data: { orderId: id, type: 'new_ready_order' },
        paidOnline: o.paidOnline === true,
      }).catch(() => {});

      console.log(`↩️ سُحب الطلب ${id} من ${prevKey || '—'} وأُعيد متاحاً`);
      return res.json({ success: true, unassigned: true, previousDriver: prevKey || null });
    }

    /* ===== الإسناد لمندوب بعينه ===== */
    const uSnap = await db.collection('users').doc(driverId).get();
    meter.addReads(1, 'إسناد طلب');
    if (!uSnap.exists) return res.status(404).json({ success: false, error: 'المندوب غير موجود' });
    const u = uSnap.data() || {};
    if (String(u.userType || '') !== 'driver') {
      return res.status(400).json({ success: false, error: 'هذا الحساب ليس مندوباً' });
    }
    const uSt = String(u.status || 'approved');
    if (uSt !== 'approved') {
      return res.status(409).json({ success: false, error: `لا يمكن الإسناد — حساب المندوب ${uSt}` });
    }

    const driver = { id: driverId, name: u.name || '', phone: u.phone || '' };
    await ref.update({
      driver, driverId,
      status: 'DRIVER_ASSIGNED', statusAr: STATUS_AR.DRIVER_ASSIGNED,
      assignedBy: 'admin', assignedAt: new Date(),
    });
    updateCached('orders:all', l => l.map(x => (String(x.id) === id
      ? { ...x, driver, driverId, status: 'DRIVER_ASSIGNED', statusAr: STATUS_AR.DRIVER_ASSIGNED } : x)));
    const io2 = req.app.get('socketio');
    if (io2) io2.emit('order_updated', { orderId: id, status: 'DRIVER_ASSIGNED', timestamp: new Date() });

    /* إشعارٌ خاصّ به بقناة الإنذار — هذا ليس عرضاً يختار قبوله،
     * هو إسنادٌ من الإدارة، فيستحق نغمة الكابتن لا همسة تحديث. */
    notifyDriverById(req.app, driverId, {
      title: '📌 أُسند إليك طلب',
      body: `${o.restaurant || 'محلّ'} — ${o.grandTotal || o.totalAmount || 0} ₪ · من الإدارة`,
      channel: 'alert',
      data: { orderId: id, type: 'assigned' },
    }).catch(() => {});

    console.log(`📌 أُسند الطلب ${id} إلى ${driver.name || driverId} بقرار الإدارة`);
    res.json({ success: true, assigned: driver });
  } catch (e) { fail(req, res, e, 'إسناد طلب'); }
});

module.exports = router;
// مُصدَّرة للاختبار: مسار المال يستحق اختباراً مباشراً لا فحصاً بالنظر
module.exports.priceItems = priceItems;
module.exports.startRestaurantTimeout = startRestaurantTimeout;
