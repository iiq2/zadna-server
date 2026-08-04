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

  const restaurantCommission = r2(items * RESTAURANT_COMMISSION);
  const driverCommission     = r2(fee   * DRIVER_COMMISSION);

  return {
    itemsTotal:   items,                                  // ثمن الوجبات
    deliveryFee:  fee,                                    // أجرة التوصيل
    grandTotal:   r2(items + fee),                        // ما يدفعه الزبون
    cashToCollect: r2(items + fee),                       // ما يحصّله المندوب

    restaurantCommission,                                 // عمولة زادنا من المطعم
    driverCommission,                                     // عمولة زادنا من التوصيل
    zadnaCommission: r2(restaurantCommission + driverCommission),

    payToRestaurant: r2(items - restaurantCommission),    // ما يدفعه المندوب للمطعم
    restaurantNet:   r2(items - restaurantCommission),    // ما يقبضه المطعم (الاسم نفسه من زاويته)
    driverNet:       r2(fee - driverCommission),          // ما يبقى للمندوب

    // النِّسَب مرفقة كي تعرض الواجهة «١٠٪» من هنا لا من نصّ محفور
    restaurantRate: RESTAURANT_COMMISSION,
    driverRate:     DRIVER_COMMISSION,
  };
}

/** يُلصق التفصيل بالطلب قبل إرساله للتطبيقات. لا يعدّل الأصل. */
function withMoney(o) {
  if (!o || typeof o !== 'object') return o;
  return Object.assign({}, o, { money: breakdown(o) });
}

module.exports = {
  RESTAURANT_COMMISSION,
  DRIVER_COMMISSION,
  DEFAULT_DELIVERY_FEE,
  r2,
  itemsTotal,
  deliveryFeeOf,
  breakdown,
  withMoney,
};
