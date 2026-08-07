/* ═══════════════════════════════════════════════════════════════
   اختبار مسار الدفع بـQR — المال يصل زادنا لا المندوب

   السؤالان اللذان يجيب عنهما:
     ١ · هل يستطيع زبونٌ أن يأكل بلا أن يدفع، بادّعاءٍ كاذب؟
     ٢ · لو أكّدتَ التحويل بعد أن دفع المندوب للمحلّ — من يقبض؟
   ═══════════════════════════════════════════════════════════════ */

const path = require('path');
const SRV = require('path').join(__dirname, '..');
const { breakdown, applyPayment } = require(path.join(SRV, 'utils/money.js'));

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log(`  ✅ ${n}`); }
                          else { fail++; console.log(`  ❌ ${n}${x ? ' → ' + x : ''}`); } };
const eq = (n, g, w) => ok(n, Math.abs(Number(g) - Number(w)) < 0.011, `توقّعنا ${w} فجاء ${g}`);

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// طلب المثال: ١٠٠ وجبة + ١٥ توصيل · مطعم ١٠٪ · توصيل ١٠٪
const ORDER = { totalAmount: 100, deliveryFee: 15, restaurantId: 'rest_1' };

console.log('\n═══ ١ · قبل التأكيد: يتصرّف كالكاش تماماً ═══');
{
  /* الزبون اختار QR وأبلغ برقمه — لكن لم يُؤكَّد بعد.
     `paidOnline` ما زالت false، فالمندوب يحصّل ويدفع كالمعتاد.
     هذا ما يمنع الأكل بلا دفع: الادّعاء لا يقلب شيئاً. */
  const o = { ...ORDER, paymentMethod: 'qr', paymentStatus: 'claim_pending' };
  const m = applyPayment(breakdown(o), o);

  ok('لم يُعلَّم مدفوعاً', m.paidOnline === false);
  eq('المندوب يحصّل كامل المبلغ', m.cashToCollect, 115);
  eq('ويدفع للمحلّ', m.payToRestaurant, 90);
  eq('ويدين لك بالعمولتين', m.driverOwesZadna, 11.5);
  eq('ولا شيء عليك لأحد', m.owedToRestaurant + m.owedToDriver, 0);
}

console.log('\n═══ ٢ · بعد التأكيد قبل الاستلام: أنت تدين للمحلّ ═══');
{
  const o = { ...ORDER, paymentMethod: 'qr', paidOnline: true, paymentStatus: 'paid' };
  const m = applyPayment(breakdown(o), o);

  ok('صار مدفوعاً', m.paidOnline === true);
  eq('المندوب لا يحصّل شيئاً', m.cashToCollect, 0);
  eq('ولا يدفع للمحلّ شيئاً', m.payToRestaurant, 0);
  eq('ولا يدين لك بشيء', m.driverOwesZadna, 0);
  eq('أنت تدين للمحلّ', m.owedToRestaurant, 90);
  eq('وتدين للمندوب بأجرته', m.owedToDriver, 13.5);
  eq('ومجموع ما عليك ١٠٣٫٥', m.owedToRestaurant + m.owedToDriver, 103.5);
  eq('وربحك كما هو', m.zadnaCommission, 11.5);
  eq('المعادلة مغلقة: ١١٥ = ١٠٣٫٥ + ١١٫٥',
     m.owedToRestaurant + m.owedToDriver + m.zadnaCommission, m.grandTotal);
}

console.log('\n═══ ٣ · الفخّ: تأكيدٌ بعد أن دفع المندوب للمحلّ ═══');
{
  /* نحاكي ما يفعله routes/orders.js حرفياً بعد applyPayment
     حين تكون حالة الطلب بعد الاستلام. */
  const AFTER_PICKUP = ['PICKED_UP', 'ON_THE_WAY', 'DELIVERED'];

  const simulate = (status) => {
    const cur = { ...ORDER, status, paymentMethod: 'qr', paidOnline: false };
    const patched = { ...cur, paidOnline: true, paymentStatus: 'paid', paymentMethod: 'qr' };
    const m = applyPayment(breakdown(patched), patched);

    const driverAlreadyPaid = AFTER_PICKUP.includes(status) && !(cur.paidOnline === true);
    if (driverAlreadyPaid && m.owedToRestaurant > 0) {
      const reimburse = m.owedToRestaurant;
      m.owedToDriver = r2(m.owedToDriver + reimburse);
      m.zadnaOwesDriver = r2(m.zadnaOwesDriver + reimburse);
      m.owedToRestaurant = 0;
      m.driverPaidRestaurant = reimburse;
    }
    return m;
  };

  const after = simulate('DELIVERED');
  eq('المحلّ قبض سلفاً — لا تدفع له ثانيةً', after.owedToRestaurant, 0);
  eq('والمندوب دائنٌ بما دفع + أجرته', after.owedToDriver, 103.5);
  eq('وكشفه يقول نفس الرقم', after.zadnaOwesDriver, 103.5);
  eq('وأثرُ السبب محفوظ', after.driverPaidRestaurant, 90);
  eq('ومجموع ما عليك لم يتغيّر',
     after.owedToRestaurant + after.owedToDriver, 103.5);
  eq('وربحك لم يتغيّر', after.zadnaCommission, 11.5);

  const before = simulate('READY_FOR_PICKUP');
  eq('وقبل الاستلام: المحلّ هو الدائن', before.owedToRestaurant, 90);
  eq('والمندوب أجرته وحدها', before.owedToDriver, 13.5);
  ok('ولا أثر تعويض', before.driverPaidRestaurant === undefined);
}

console.log('\n═══ ٤ · ما يبقى في جيب المندوب ═══');
{
  /* orders.js يحسب: kept = cashToCollect − payToRestaurant
     وهو ما يُضاف إلى cashOnHand ويحرسه السقف. */
  const cash = applyPayment(breakdown(ORDER), ORDER);
  eq('بالكاش يبقى بجيبه ٢٥', Math.max(0, cash.cashToCollect - cash.payToRestaurant), 25);

  const qr = { ...ORDER, paidOnline: true, paymentMethod: 'qr' };
  const mq = applyPayment(breakdown(qr), qr);
  eq('وبالـQR لا شيء', Math.max(0, mq.cashToCollect - mq.payToRestaurant), 0);
  ok('فلا يقترب من السقف أبداً', (mq.cashToCollect - mq.payToRestaurant) <= 0);
}

console.log('\n═══ ٥ · طلب ماركت بـQR — عمولة ٦٪ ═══');
{
  const o = { totalAmount: 100, deliveryFee: 15, restaurantId: 'mkt_abc',
              paidOnline: true, paymentMethod: 'qr' };
  const m = applyPayment(breakdown(o), o);
  eq('عمولة الماركت ٦', m.restaurantCommission, 6);
  eq('فللماركت ٩٤', m.owedToRestaurant, 94);
  eq('وللمندوب ١٣٫٥', m.owedToDriver, 13.5);
  eq('وربحك ٧٫٥', m.zadnaCommission, 7.5);
  eq('المعادلة مغلقة',
     m.owedToRestaurant + m.owedToDriver + m.zadnaCommission, m.grandTotal);
}

console.log('\n═══ ٦ · النسبة مجمَّدة — تغييرها لا يمسّ طلباً مؤكَّداً ═══');
{
  /* طلبٌ حُسب بنسبة ٢٠٪ محفوظة فيه، ثم أُكّد دفعه اليوم.
     لو قرأ النسبةَ الحالية (١٠٪) لتبدّل نصيب المحلّ بعد الاتفاق. */
  const o = {
    ...ORDER, paidOnline: true, paymentMethod: 'qr',
    money: { restaurantRate: 0.20, driverRate: 0.10 },
  };
  const m = applyPayment(breakdown(o), o);
  eq('العمولة بنسبة الطلب لا نسبة اليوم', m.restaurantCommission, 20);
  eq('فللمحلّ ٨٠', m.owedToRestaurant, 80);
  eq('وربحك ٢١٫٥', m.zadnaCommission, 21.5);
}

console.log(`\n${'═'.repeat(48)}`);
console.log(`  ✅ نجح: ${pass}   ❌ فشل: ${fail}`);
console.log('═'.repeat(48));
process.exit(fail ? 1 : 0);
