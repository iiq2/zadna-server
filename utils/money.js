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

/* ============================================================
   عمولة السوبرماركت أقلّ — ٦٪ لا ١٠٪.

   وليست تخفيضاً مجاملةً: هامش السوبرماركت على البضاعة أرقّ من هامش
   المطعم على الوجبة. المطعم يشتري بعشرة ويبيع بأربعين؛ والماركت
   يشتري بتسعة ويبيع بعشرة. فعشرة بالمئة من ثمن البضاعة قد تبتلع
   ربحه كلّه، وشريكٌ يخسر لا يبقى شريكاً.

   وتُقرأ من البيئة كأختها: `MARKET_COMMISSION=0.06` على Render.
   ============================================================ */
const MARKET_COMMISSION = parseFloat(process.env.MARKET_COMMISSION || '0.06');

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

/** هل هذا طلب سوبرماركت؟ ثلاثة أدلّة، أوّلها المحفوظ في الطلب نفسه. */
function isMarketOrder(o) {
  if (!o) return false;
  if (o.isMarketOrder === true) return true;
  return String(o.restaurantId || '').startsWith('mkt_') || o.restaurantId === 'mart_001';
}

/* ============================================================
   النسبة تُجمَّد يوم الطلب — وهذا أهمّ سطرٍ في هذا الملفّ.

   السؤال: لو رفعتَ العمولة من ٦٪ إلى ٨٪ بعد ألف طلب، فماذا يحدث
   لكشوف الحسابات القديمة؟

   لو قرأنا النسبة من البيئة **وقت العرض**، لتغيّر كشفُ حسابِ مندوبٍ
   سدّد الأسبوع الماضي — بأثرٍ رجعي، بلا أن يلمس أحدٌ شيئاً. فيفتح
   محفظته فيجد رقماً غير الذي دفع عليه، ولا سبيل لإقناعه أنك لم
   تتلاعب. وأسوأ منه: مجموع ما قبضتَه فعلاً لا يطابق ما يقوله النظام،
   فلا تعرف أنت نفسك كم لك وكم عليك.

   فالقاعدة: **النسبة المحفوظة في الطلب هي الحقيقة**، والثابت الحالي
   لا يُستعمل إلا لطلبٍ لم تُحفظ فيه نسبة (وهي طلبات ما قبل وحدة
   المال، وقد صارت قليلة ثم تنتهي).

   ونقبل `commissionRate` على الطلب أيضاً — كي تستطيع يوماً أن تتّفق
   مع شريكٍ بعينه على نسبةٍ خاصّة، فتُكتب على طلباته وحدها.
   ============================================================ */
function rateOf(o, saved, fallback) {
  /* الغياب ليس صفراً.
   *
   * `Number(null)` و`Number('')` كلاهما صفر في جافاسكربت. فحقلٌ فارغ
   * في نموذجٍ إداري كان سيُقرأ «عمولة صفر» ويُجمَّد على الطلب أبداً —
   * شريكٌ لا تأخذ منه شيئاً بلا أن يقرّر ذلك أحد.
   *
   * والصفر **المكتوب صراحةً** يبقى مقبولاً: شريكٌ بعمولة صفر لشهرين
   * قرارٌ تجاري حقيقي، ولو أسقطناه للثابت لجُبي منه رغم اتفاقك. */
  if (saved === null || saved === undefined || saved === '') return fallback;
  const v = Number(saved);
  if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
  return fallback;
}

/**
 * تفصيل مال طلبٍ واحد. هذه الحقول تُخزَّن داخل الطلب وتُرسل كما هي
 * إلى التطبيقات الثلاثة واللوحة — لا يعيد أحدٌ حسابها.
 */
function breakdown(o) {
  const items = r2(itemsTotal(o));
  const fee   = r2(deliveryFeeOf(o));

  /* النسبة: المحفوظة في الطلب أولاً، ثم اتفاقٌ خاصّ على الطلب، ثم
   * الثابت الحالي بحسب نوع الشريك. */
  const saved = (o && o.money) || {};
  const partnerRate = rateOf(o, saved.restaurantRate,
    rateOf(o, o && o.commissionRate,
      isMarketOrder(o) ? MARKET_COMMISSION : RESTAURANT_COMMISSION));
  const drvRate = rateOf(o, saved.driverRate,
    rateOf(o, o && o.driverCommissionRate, DRIVER_COMMISSION));

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

  const restaurantCommission = r2(restBase * partnerRate);
  const driverCommission     = r2(fee * drvRate);
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

    /* النِّسَب مرفقة كي تعرض الواجهة «١٠٪» من هنا لا من نصّ محفور —
     * وكي **تُجمَّد** مع الطلب فلا يُعاد حسابه بنسبةٍ لم تكن قائمة يومه. */
    restaurantRate: partnerRate,
    driverRate:     drvRate,
    isMarketOrder:  isMarketOrder(o),
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
      paymentMethod: String((order && order.paymentMethod) || 'cash'),

      // المندوب يدفع للمطعم نقداً ويحصّل من الزبون — لا دين عليك لأحد
      owedToRestaurant: 0,
      owedToDriver: 0,

      /* ما يدين به المندوب لزادنا من هذا الطلب: العمولتان.
       * هو قبض من الزبون ودفع للمطعم، وبقي في جيبه نصيبُك ونصيبُه. */
      driverOwesZadna: b.zadnaCommission,
      zadnaOwesDriver: 0,
    });
  }

  /* ============================================================
     مدفوعٌ إلكترونياً — المال وصلك أنت، فانعكس كل شيء.

     ثلاث حقائق تتبدّل معاً، ولا يجوز أن تتبدّل واحدة دون أختيها:

     ١ · **المندوب لا يحصّل شيئاً** (`cashToCollect = 0`). ولو بقيت
         موجبةً لذهب يطلب مالاً من زبونٍ دفع — وهذه أسوأ لحظة يمكن
         أن تقع لمنصّة توصيل على باب بيت.

     ٢ · **المندوب لا يدين لك بشيء** (`driverOwesZadna = 0`). عمولتك
         اقتطعتَها من المبلغ الذي وصلك، فلا تُطالبه بها ثانيةً. وكان
         `owedFor` في المحفظة يُطالبه بها — ٢٥ ₪ في الاتجاه الخطأ على
         كل طلب مئة شيكل.

     ٣ · **أنت تدين لهما**: للمطعم بحصّته وللمندوب بأجرته. ويظهران
         صراحةً كي تعرف كم عليك في آخر اليوم بلا حساب يدوي.

     والمحصّلة واحدة في الحالتين: ربحك `zadnaCommission`. الفرق في
     الطريق لا في المبلغ.
     ============================================================ */
  return Object.assign({}, b, {
    paidOnline: true,
    paymentMethod: String((order && order.paymentMethod) || 'card'),

    cashToCollect: 0,
    owedToRestaurant: b.payToRestaurant,
    owedToDriver: b.driverNet,

    driverOwesZadna: 0,
    zadnaOwesDriver: b.driverNet,
  });
}

/** يُلصق التفصيل بالطلب قبل إرساله للتطبيقات. لا يعدّل الأصل. */
function withMoney(o) {
  if (!o || typeof o !== 'object') return o;
  return Object.assign({}, o, { money: applyPayment(breakdown(o), o) });
}

module.exports = {
  RESTAURANT_COMMISSION,
  MARKET_COMMISSION,
  DRIVER_COMMISSION,
  DEFAULT_DELIVERY_FEE,
  r2,
  itemsTotal,
  deliveryFeeOf,
  isMarketOrder,
  breakdown,
  applyPayment,
  withMoney,
};
