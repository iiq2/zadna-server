/* ============================================================
   اختبار المال — والسؤال الجوهري واحد:

     **هل كل شيكل دفعه الزبون يصل صاحبه؟**

   لا أختبر «هل الأرقام كما توقّعت» بل «هل المعادلة مغلقة»: ما دخل
   يساوي ما خرج، في الكاش وفي البطاقة وفي خليطهما. فحسابٌ تُجمع
   أطرافُه فتساوي المجموع لا يمكن أن يضيع فيه أحد.
   ============================================================ */
const path = require('path').join(__dirname, '..');
const money = require(path + '/utils/money');
const { breakdown, applyPayment, r2 } = money;

let pass = 0, fail = 0;
const check = (n, c, d) => {
  console.log((c ? '  ✅ ' : '  ⛔ ') + n + (c ? '' : '\n       ← ' + d));
  c ? pass++ : fail++;
};
const near = (a, b) => Math.abs(a - b) < 0.005;

const M = (o) => applyPayment(breakdown(o), o);

// ================================================================
console.log('\n═══ ١ · مطعم بالكاش: ١٠٠ وجبة + ١٥ توصيل · عمولة ١٠٪ ═══');
{
  const m = M({ restaurantId: 'rest_1', totalAmount: 100, deliveryFee: 15 });
  check('الزبون يدفع ١١٥', near(m.grandTotal, 115), m.grandTotal);
  check('عمولة المطعم ١٠', near(m.restaurantCommission, 10), m.restaurantCommission);
  check('عمولة التوصيل ١٫٥', near(m.driverCommission, 1.5), m.driverCommission);
  check('ربح زادنا ١١٫٥', near(m.zadnaCommission, 11.5), m.zadnaCommission);
  check('المندوب يدفع للمطعم ٩٠', near(m.payToRestaurant, 90), m.payToRestaurant);
  check('المندوب يحصّل ١١٥', near(m.cashToCollect, 115), m.cashToCollect);
  check('يبقى للمندوب ١٣٫٥', near(m.driverNet, 13.5), m.driverNet);
  check('المندوب يدين لزادنا ١١٫٥', near(m.driverOwesZadna, 11.5), m.driverOwesZadna);
  check('زادنا لا تدين لأحد', m.owedToRestaurant === 0 && m.owedToDriver === 0,
    JSON.stringify({ r: m.owedToRestaurant, d: m.owedToDriver }));

  // المعادلة: ما حصّله = ما دفعه للمطعم + أجرته + عمولة زادنا
  check('🔒 المعادلة مغلقة',
    near(m.cashToCollect, m.payToRestaurant + m.driverNet + m.zadnaCommission),
    `${m.cashToCollect} ≠ ${m.payToRestaurant}+${m.driverNet}+${m.zadnaCommission}`);
}

console.log('\n═══ ٢ · سوبرماركت بالكاش: عمولته ٦٪ لا ١٠٪ ═══');
{
  const m = M({ restaurantId: 'mkt_777', isMarketOrder: true, totalAmount: 100, deliveryFee: 15 });
  check('نسبة الماركت ٦٪', near(m.restaurantRate, 0.06), m.restaurantRate);
  check('عمولة الماركت ٦ لا ١٠', near(m.restaurantCommission, 6), m.restaurantCommission);
  check('الماركت يقبض ٩٤', near(m.payToRestaurant, 94), m.payToRestaurant);
  check('ربح زادنا ٧٫٥', near(m.zadnaCommission, 7.5), m.zadnaCommission);
  check('الزبون يدفع ١١٥ كما هو', near(m.grandTotal, 115), m.grandTotal);
  check('وُسم طلب ماركت', m.isMarketOrder === true, m.isMarketOrder);
  check('🔒 المعادلة مغلقة',
    near(m.cashToCollect, m.payToRestaurant + m.driverNet + m.zadnaCommission),
    `${m.cashToCollect}`);
}

console.log('\n═══ ٣ · التمييز بالمعرّف وحده (بلا isMarketOrder) ═══');
{
  const a = M({ restaurantId: 'mkt_999', totalAmount: 100, deliveryFee: 10 });
  const b = M({ restaurantId: 'rest_5', totalAmount: 100, deliveryFee: 10 });
  check('mkt_ ← ٦٪', near(a.restaurantCommission, 6), a.restaurantCommission);
  check('غيره ← ١٠٪', near(b.restaurantCommission, 10), b.restaurantCommission);
}

console.log('\n═══ ٤ · مدفوع إلكترونياً: ينعكس الاتجاه ═══');
{
  const m = M({ restaurantId: 'rest_1', totalAmount: 100, deliveryFee: 15,
                paidOnline: true, paymentMethod: 'card' });
  check('الزبون دفع ١١٥ (لا يتغيّر)', near(m.grandTotal, 115), m.grandTotal);
  check('ربح زادنا ١١٫٥ (لا يتغيّر)', near(m.zadnaCommission, 11.5), m.zadnaCommission);
  check('المندوب لا يحصّل شيئاً', m.cashToCollect === 0, m.cashToCollect);
  check('⭐ المندوب لا يدين لزادنا', m.driverOwesZadna === 0, m.driverOwesZadna);
  check('زادنا تدين للمطعم ٩٠', near(m.owedToRestaurant, 90), m.owedToRestaurant);
  check('زادنا تدين للمندوب ١٣٫٥', near(m.owedToDriver, 13.5), m.owedToDriver);
  check('دخل المندوب ١٣٫٥ كما هو', near(m.driverNet, 13.5), m.driverNet);

  // المعادلة: ما وصل زادنا = ما تدين به + ربحها
  check('🔒 المعادلة مغلقة',
    near(m.grandTotal, m.owedToRestaurant + m.owedToDriver + m.zadnaCommission),
    `${m.grandTotal} ≠ ${m.owedToRestaurant}+${m.owedToDriver}+${m.zadnaCommission}`);
}

console.log('\n═══ ٥ · الربح واحد مهما اختلف طريق الدفع ═══');
{
  for (const [why, o] of [
    ['مطعم', { restaurantId: 'r1', totalAmount: 250, deliveryFee: 20 }],
    ['ماركت', { restaurantId: 'mkt_1', totalAmount: 250, deliveryFee: 20 }],
  ]) {
    const cash = M({ ...o });
    const card = M({ ...o, paidOnline: true });
    check(`${why}: ربح زادنا متطابق`, near(cash.zadnaCommission, card.zadnaCommission),
      `كاش=${cash.zadnaCommission} بطاقة=${card.zadnaCommission}`);
    /* حصّة الشريك واحدة — لكن الحقل الذي يحملها يختلف بالطريق:
     *   كاش      → `payToRestaurant` (المندوب يسلّمها)
     *   مدفوع لك → `owedToRestaurant` (أنت تسدّدها)
     * و`payToRestaurant` تساوي صفراً في المدفوع لك عمداً، وإلّا دفع
     * المندوب المبلغ ثانيةً من جيبه. فنقارن ما يقبضه الشريك لا اسم
     * الحقل. */
    const partnerGets = (m) => (m.paidOnline ? m.owedToRestaurant : m.payToRestaurant);
    check(`${why}: حصّة الشريك متطابقة`, near(partnerGets(cash), partnerGets(card)),
      `${partnerGets(cash)} vs ${partnerGets(card)}`);
    check(`${why}: المندوب لا يدفع في المدفوع لك`, near(card.payToRestaurant, 0),
      `payToRestaurant=${card.payToRestaurant}`);
    check(`${why}: دخل المندوب متطابق`, near(cash.driverNet, card.driverNet),
      `${cash.driverNet} vs ${card.driverNet}`);
  }
}

console.log('\n═══ ٦ · ⭐ تغيير النسبة لا يمسّ طلباً قديماً ═══');
{
  // طلبٌ سُلّم أمس بـ٦٪، و`money` محفوظ داخله
  const old = { restaurantId: 'mkt_1', totalAmount: 200, deliveryFee: 10 };
  old.money = M(old);
  check('حُفظت النسبة ٦٪ في الطلب', near(old.money.restaurantRate, 0.06), old.money.restaurantRate);
  check('عمولته ١٢', near(old.money.restaurantCommission, 12), old.money.restaurantCommission);

  // الآن نرفع النسبة إلى ٩٪ ونعيد قراءته
  const before = process.env.MARKET_COMMISSION;
  process.env.MARKET_COMMISSION = '0.09';
  delete require.cache[require.resolve(path + '/utils/money')];
  const money2 = require(path + '/utils/money');

  const reread = money2.applyPayment(money2.breakdown(old), old);
  check('الطلب القديم ما زال ٦٪', near(reread.restaurantRate, 0.06), reread.restaurantRate);
  check('عمولته ما زالت ١٢ لا ١٨', near(reread.restaurantCommission, 12), reread.restaurantCommission);

  // وطلبٌ جديد يأخذ النسبة الجديدة
  const fresh = money2.applyPayment(
    money2.breakdown({ restaurantId: 'mkt_1', totalAmount: 200, deliveryFee: 10 }),
    { restaurantId: 'mkt_1' });
  check('الطلب الجديد يأخذ ٩٪', near(fresh.restaurantCommission, 18), fresh.restaurantCommission);

  if (before === undefined) delete process.env.MARKET_COMMISSION;
  else process.env.MARKET_COMMISSION = before;
  delete require.cache[require.resolve(path + '/utils/money')];
}

console.log('\n═══ ٧ · اتفاقٌ خاصّ مع شريكٍ بعينه ═══');
{
  const m = M({ restaurantId: 'rest_vip', totalAmount: 100, deliveryFee: 10, commissionRate: 0.05 });
  check('نسبة خاصّة ٥٪ تُحترم', near(m.restaurantCommission, 5), m.restaurantCommission);
  check('نسبة غير معقولة (١٫٥) تُتجاهَل',
    near(M({ restaurantId: 'r', totalAmount: 100, deliveryFee: 10, commissionRate: 1.5 }).restaurantCommission, 10),
    'قُبلت نسبةٌ فوق ١٠٠٪');
}

console.log('\n═══ ٨ · حالات حدّية ═══');
{
  const free = M({ restaurantId: 'r', totalAmount: 100, deliveryFee: 0 });
  check('توصيل مجاني: أجرة صفر لا ١٠', near(free.deliveryFee, 0), free.deliveryFee);
  check('توصيل مجاني: عمولة توصيل صفر', near(free.driverCommission, 0), free.driverCommission);
  check('توصيل مجاني: المعادلة مغلقة',
    near(free.cashToCollect, free.payToRestaurant + free.driverNet + free.zadnaCommission), '');

  const zero = M({ restaurantId: 'r', totalAmount: 0, deliveryFee: 15 });
  check('سلّة بصفر (أصناف حرّة): المعادلة مغلقة',
    near(zero.cashToCollect, zero.payToRestaurant + zero.driverNet + zero.zadnaCommission), '');

  const paidStatus = M({ restaurantId: 'r', totalAmount: 50, deliveryFee: 10, paymentStatus: 'paid' });
  check('paymentStatus=paid تُقرأ كدفعٍ إلكتروني', paidStatus.paidOnline === true, paidStatus.paidOnline);
}

console.log('\n═══ ٩ · محفظة المندوب: خليط كاش وإلكتروني ═══');
{
  // نُحاكي ما تفعله wallet.js بالضبط
  const orders = [
    M({ restaurantId: 'r', totalAmount: 100, deliveryFee: 15 }),                     // كاش
    M({ restaurantId: 'r', totalAmount: 100, deliveryFee: 15 }),                     // كاش
    M({ restaurantId: 'r', totalAmount: 100, deliveryFee: 15, paidOnline: true }),   // بطاقة
  ];
  const owes = orders.reduce((s, m) => s + (m.paidOnline ? 0 : m.zadnaCommission), 0);
  const zadnaOwes = orders.reduce((s, m) => s + (m.paidOnline ? m.driverNet : 0), 0);
  const income = orders.reduce((s, m) => s + m.driverNet, 0);

  check('عليه ٢٣ (طلبا كاش فقط)', near(owes, 23), owes);
  check('له ١٣٫٥ (الطلب الإلكتروني)', near(zadnaOwes, 13.5), zadnaOwes);
  check('صافي: عليه ٩٫٥', near(owes - zadnaOwes, 9.5), owes - zadnaOwes);
  check('دخله ٤٠٫٥ من الثلاثة', near(income, 40.5), income);

  // ولو كانت الطلبات الثلاثة إلكترونية
  const allCard = orders.map(m => Object.assign({}, m, { paidOnline: true, driverOwesZadna: 0 }));
  const owes2 = allCard.reduce((s, m) => s + (m.paidOnline ? 0 : m.zadnaCommission), 0);
  check('كلها إلكتروني: لا شيء عليه', owes2 === 0, owes2);
}

console.log('\n' + (fail === 0 ? '🟢' : '🔴') + `  ${pass} نجحت · ${fail} فشلت\n`);
process.exit(fail ? 1 : 0);
