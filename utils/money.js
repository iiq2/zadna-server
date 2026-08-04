/* ============================================================
   مال زادنا — المصدر الوحيد.

   قبل هذا الملفّ كانت النِّسَب مكتوبة في خمسة أماكن:
     · Models.kt → object Commission        (تطبيقا المندوب والمطعم)
     · app.js:2313 و 2330 و 2356            (لوحة المدير)
     · نصّ «١٠٪» في شاشة المطعم              (مرّتين)
     · routes/wallet.js                     (الحقيقة)
   فتعديل النسبة على Render كان يجعل ثلاث واجهات تكذب في اللحظة نفسها،
   ولا شيء يكتشف الفرق. وصاحب مطعم يمسك آلة حاسبة ويجد الرقم مختلفاً
   لا يصدّقك مرّة ثانية.

   الآن: يُحسب هنا وحده، ويُخزَّن داخل كل طلب، وتعرضه التطبيقات ولا
   تحسبه. تغيير النسبة على Render يسري على الجميع فوراً وبلا بناء.

   نموذج التحصيل (كما هو في wallet.js حرفياً):
     · المندوب يدفع للمطعم كاشاً وقت الاستلام: الوجبة ناقص عمولة زادنا
     · المندوب يحصّل من الزبون: الوجبة + التوصيل
     · المندوب يسدّد لزادنا يومياً: عمولة المطعم + عمولة التوصيل
   ============================================================ */

const RESTAURANT_COMMISSION = parseFloat(process.env.RESTAURANT_COMMISSION || '0.10');
const DRIVER_COMMISSION     = parseFloat(process.env.DRIVER_COMMISSION || '0.10');

/* ١٠ لا ٥: هذا هو BASE_FEE في نظام التسعير (zones.js). كان الرقمان
 * مختلفين، فطلب بلا أجرة مسجَّلة يُحسب بنصف قيمته في كشف الحساب —
 * فتظهر على المندوب ديون أقلّ ممّا عليه، وعلى زادنا إيراد أقلّ ممّا لها. */
const DEFAULT_DELIVERY_FEE  = parseFloat(process.env.DEFAULT_DELIVERY_FEE || '10');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** ثمن الأصناف — يقبل totalAmount أو total، رقماً أو نصّاً فيه «₪». */
function itemsTotal(o) {
  const v = o && o.totalAmount != null ? o.totalAmount
          : (o && o.total != null ? o.total : 0);
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : n;
}

/* `0 || 10` في جافاسكربت يساوي ١٠ — فطلب بتوصيل مجاني كان يُحسب بعشرة،
 * فتُفرض على المندوب عمولة على مال لم يقبضه وتُسجَّل له أرباح وهمية.
 * لذلك نفحص null و '' صراحةً بدل الاعتماد على الصدق المنطقي. */
function deliveryFeeOf(o) {
  if (!o) return DEFAULT_DELIVERY_FEE;
  if (o.deliveryFee == null || o.deliveryFee === '') return DEFAULT_DELIVERY_FEE;
  return Number(o.deliveryFee) || 0;
}

/**
 * تفصيل مال طلبٍ واحد. هذه الحقول تُخزَّن داخل الطلب وتُرسل كما هي
 * إلى التطبيقات الثلاثة واللوحة — لا يعيد أحدٌ حسابها.
 */
function breakdown(o) {
  const items = r2(itemsTotal(o));
  const fee   = r2(deliveryFeeOf(o));

  /* ============================================================
     الخصم — ومن يتحمّله.

     أُضيف اليوم فارغاً (صفراً) استعداداً للكوبونات. وسببُ إضافته
     مبكّراً أن تأجيله يخلق سؤالاً لا جواب له بعد ألف طلب: العمولة
     على السعر قبل الخصم أم بعده؟ ومن دفع الخصم — أنت أم المطعم؟

     `discountBy` يحسم الاثنين:
       · `zadna`      → أنت تموّل الخصم. المطعم يقبض ثمنه كاملاً،
                        وعمولتك تُحسب على السعر الكامل ثم تنقص منها
                        قيمة الخصم. أي أن الخصم يخرج من جيبك أنت.
       · `restaurant` → المطعم يموّل الخصم (عرضٌ من عنده). عمولتك
                        على المبلغ بعد الخصم، لأنه ما قبضه فعلاً.

     والزبون يدفع الأقلّ في الحالتين — الفرق في من يتحمّل.
     ============================================================ */
  /* الافتراضي `restaurant` بقرارٍ منك: العروض من المطاعم لا من زادنا.
   * وهو الأسلم أيضاً — خصمٌ من عندك على طلبٍ عمولتك منه ٦٫٧ شواكل
   * يعني أنك تدفع من جيبك، وهذا يمرّ بلا أن يراه أحد. */
  const discount   = Math.max(0, Math.min(items, r2(Number(o && o.discount) || 0)));
  const discountBy = String((o && o.discountBy) || 'restaurant');
  const restBase   = discountBy === 'restaurant' ? r2(items - discount) : items;

  const restaurantCommission = r2(restBase * RESTAURANT_COMMISSION);
  const driverCommission     = r2(fee * DRIVER_COMMISSION);
  // خصمُ زادنا ينقص من عمولتها لا من حصّة أحد آخر — وقد يبلغ صفراً
  const zadnaGross = r2(restaurantCommission + driverCommission);
  const zadnaNet   = discountBy === 'zadna' ? r2(Math.max(0, zadnaGross - discount)) : zadnaGross;

  const customerPays  = r2(items - discount + fee);
  const payToRestaurant = r2(restBase - restaurantCommission);
  const driverNet       = r2(fee - driverCommission);

  return {
    itemsTotal:   items,                                  // ثمن الوجبات قبل الخصم
    discount,                                             // قيمة الخصم (صفر اليوم)
    discountBy,                                           // من يتحمّله
    deliveryFee:  fee,                                    // أجرة التوصيل
    grandTotal:   customerPays,                           // ما يدفعه الزبون
    cashToCollect: customerPays,                          // ما يحصّله المندوب — انظر أدناه

    restaurantCommission,                                 // عمولة زادنا من المطعم
    driverCommission,                                     // عمولة زادنا من التوصيل
    zadnaCommission: zadnaNet,                            // ما يبقى لزادنا بعد تمويل خصمها

    payToRestaurant,                                      // ما يدفعه المندوب للمطعم
    restaurantNet:   payToRestaurant,                     // ما يقبضه المطعم (الاسم نفسه من زاويته)
    driverNet,                                            // ما يبقى للمندوب

    // النِّسَب مرفقة كي تعرض الواجهة «١٠٪» من هنا لا من نصّ محفور
    restaurantRate: RESTAURANT_COMMISSION,
    driverRate:     DRIVER_COMMISSION,
  };
}

/* ============================================================
   الدفع الإلكتروني يقلب اتجاه المال — والحقول تنتظره من اليوم.

   بالكاش: المندوب يحصّل من الزبون، ويدفع للمطعم، ويسدّد لك عمولتك.
   المال لا يمرّ بك إطلاقاً.

   بالبطاقة أو المحفظة: **المال يصل إليك أنت**. فتصير مديناً للمطعم
   بحصّته وللمندوب بأجرته، وعليك أن تدفع لهما. عكسٌ كامل.

   وأخطر ما فيه عملياً: مندوبٌ لا يعرف أن الطلب مدفوع سيحصّل من زبونٍ
   دفع أصلاً. لذلك `cashToCollect` تصير صفراً هنا، و`owedToDriver`
   تظهر صراحةً — فتعرف كم تدين له في نهاية اليوم.

   ولا شيء من هذا مفعَّل الآن: كل الطلبات `cash`. الحقول موجودة كي
   لا نُهاجر بيانات ألف طلب يوم نربط البوابة.
   ============================================================ */
function applyPayment(b, order) {
  const paidOnline = !!(order && (order.paidOnline === true || order.paymentStatus === 'paid'));
  if (!paidOnline) {
    return Object.assign({}, b, {
      paidOnline: false,
      owedToRestaurant: 0,   // المندوب يدفع نقداً — لا دين عليك
      owedToDriver: 0,
    });
  }
  return Object.assign({}, b, {
    paidOnline: true,
    cashToCollect: 0,                    // لا يُحصّل المندوب شيئاً
    owedToRestaurant: b.payToRestaurant, // تدفعها أنت للمطعم
    owedToDriver: b.driverNet,           // تدفعها أنت للمندوب
  });
}

/** يُلصق التفصيل بالطلب قبل إرساله للتطبيقات. لا يعدّل الأصل. */
function withMoney(o) {
  if (!o || typeof o !== 'object') return o;
  return Object.assign({}, o, { money: applyPayment(breakdown(o), o) });
}

module.exports = {
  RESTAURANT_COMMISSION,
  DRIVER_COMMISSION,
  DEFAULT_DELIVERY_FEE,
  r2,
  itemsTotal,
  deliveryFeeOf,
  breakdown,
  applyPayment,
  withMoney,
};
