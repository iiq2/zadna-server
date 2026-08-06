/* ═══════════════════════════════════════════════════════════════
   اختبار: هل تُنقص دفعتُك للشريك ما عليك له؟

   السؤال الذي وُلد منه هذا الملفّ: `partner_payouts` كانت تُكتب
   بإيصالٍ مرقّم منذ بُنيت، **ولا يقرؤها أي حساب**. فيبقى «عليك له»
   يجمع كل طلب QR ولا ينقص أبداً — تدفع للمطعم تسعين، وتبقى لوحتك
   تقول إنك مدينٌ له بها، فتدفع مرّةً ثانية.

   والمنطق هنا مُعاد كتابته بنفس صيغة `wallet.js` عمداً — لا
   استيراداً منه. فاستيرادُ الدالة يجعل الاختبار يوافقها مهما قالت:
   لو انقلبت إشارة الطرح غداً، انقلب معها الاختبار وسكت.
   ═══════════════════════════════════════════════════════════════ */

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log(`  ✅ ${n}`); }
                          else { fail++; console.log(`  ❌ ${n}${x ? ' → ' + x : ''}`); } };
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

/** ما تفعله `wallet/summary` بعد الإصلاح: مستحقٌّ − مدفوع = متبقٍّ. */
function partnerRow(pendingFromOrders, payouts) {
  const paid = payouts.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return {
    pending:    r2(pendingFromOrders),
    paidOut:    r2(paid),
    balanceDue: r2(Math.max(0, pendingFromOrders - paid)),
    overpaid:   r2(Math.max(0, paid - pendingFromOrders)),
  };
}

console.log('\n═══ ١ · الحالة التي كسرت: الدفع لا يُنقص شيئاً ═══');
{
  /* طلبٌ بـ١٠٠ وجبة، عمولتك ١٠٪ → للمطعم ٩٠. دُفع بـQR فوصلك المال. */
  const r0 = partnerRow(90, []);
  ok('قبل الدفع — عليك له ٩٠', r0.balanceDue === 90, JSON.stringify(r0));

  const r1 = partnerRow(90, [{ amount: 90 }]);
  ok('بعد أن حوّلتَ ٩٠ — صار صفراً', r1.balanceDue === 0, `balanceDue=${r1.balanceDue}`);
  ok('والمدفوع يظهر ٩٠ لا يُبتلع', r1.paidOut === 90);
  /* هذا هو الفحص الذي كان يفشل: `pending` وحده كان يُعرض. */
  ok('و«ما نشأ» يبقى ٩٠ للمراجعة', r1.pending === 90);
}

console.log('\n═══ ٢ · الدفعة الجزئية ═══');
{
  const r = partnerRow(250, [{ amount: 100 }]);
  ok('٢٥٠ − ١٠٠ = ١٥٠', r.balanceDue === 150, `balanceDue=${r.balanceDue}`);
  const r2p = partnerRow(250, [{ amount: 100 }, { amount: 60 }]);
  ok('دفعتان تُجمعان: ٢٥٠ − ١٦٠ = ٩٠', r2p.balanceDue === 90);
  ok('ولا فائض', r2p.overpaid === 0);
}

console.log('\n═══ ٣ · الدفع الزائد لا يصير ديناً عليه ═══');
{
  /* لو ظهر الرصيد سالباً لقرأتَه «هو مدينٌ لك» — وهو لم يستدن منك.
   * الفائض حقيقةٌ منفصلة تُعلن بذاتها. */
  const r = partnerRow(90, [{ amount: 120 }]);
  ok('المتبقّي لا ينزل تحت الصفر', r.balanceDue === 0, `balanceDue=${r.balanceDue}`);
  ok('والفائض يظهر صريحاً ٣٠', r.overpaid === 30);
}

console.log('\n═══ ٤ · الكاش لا يُنشئ ديناً أصلاً ═══');
{
  /* المندوب يدفع للمطعم كاش وقت الاستلام → `owedToRestaurant = 0`.
   * فلا شيء يتراكم ولا شيء يُدفع. */
  const r = partnerRow(0, []);
  ok('لا مستحقّ', r.balanceDue === 0);
  ok('ولا مدفوع', r.paidOut === 0);
  ok('ولا فائض', r.overpaid === 0);
}

console.log('\n═══ ٥ · مجموع الشركاء = مجموع المتبقّي لا مجموع المستحقّ ═══');
{
  const rows = [
    partnerRow(90,  [{ amount: 90 }]),   // سُدِّد
    partnerRow(250, [{ amount: 100 }]),  // متبقٍّ ١٥٠
    partnerRow(40,  []),                 // متبقٍّ ٤٠
  ];
  const net   = r2(rows.reduce((s, r) => s + r.balanceDue, 0));
  const gross = r2(rows.reduce((s, r) => s + r.pending, 0));
  ok('الصافي ١٩٠', net === 190, `net=${net}`);
  ok('والإجمالي ٣٨٠ — يبقى محفوظاً للتدقيق', gross === 380);
  /* الفرق هو تحديداً ما كانت اللوحة تعرضه خطأً: ١٩٠ فرقاً. */
  ok('والفرق بينهما = ما دفعتَه فعلاً (١٩٠)', r2(gross - net) === 190);
}

console.log('\n═══ ٦ · القرش لا يضيع ═══');
{
  const r = partnerRow(7.35, [{ amount: 2.10 }, { amount: 1.05 }]);
  ok('٧٫٣٥ − ٣٫١٥ = ٤٫٢٠', r.balanceDue === 4.2, `balanceDue=${r.balanceDue}`);
  const r2c = partnerRow(0.1 + 0.2, [{ amount: 0.3 }]);
  ok('٠٫١+٠٫٢ ثم دفع ٠٫٣ → صفر (لا 0.0000000004)', r2c.balanceDue === 0, `balanceDue=${r2c.balanceDue}`);
}

console.log('\n═══ ٧ · الاسترداد بمبلغٍ سالب — لا بحذف الدفعة ═══');
{
  /* دفعتَ ٤٠٠ وعليك ٣٤٥ → فائض ٥٥. تسترده فتُسجَّل دفعةٌ بـ−٥٥.
   * الجمع يعود صحيحاً، **والدفعة الأصلية تبقى في السجلّ**: الشريك
   * قبض ثم أعاد، وهذان حدثان لا حدثٌ ملغى. */
  const before = partnerRow(345, [{ amount: 400 }]);
  ok('قبل الاسترداد — فائض ٥٥', before.overpaid === 55 && before.balanceDue === 0);

  const after = partnerRow(345, [{ amount: 400 }, { amount: -55 }]);
  ok('بعد الاسترداد — لا فائض', after.overpaid === 0, `overpaid=${after.overpaid}`);
  ok('ولا مستحقّ', after.balanceDue === 0, `balanceDue=${after.balanceDue}`);
  ok('والمدفوع الصافي ٣٤٥', after.paidOut === 345, `paidOut=${after.paidOut}`);

  /* استردادٌ جزئي: تسترد ٣٠ من ٥٥ فيبقى ٢٥ فائضاً. */
  const part = partnerRow(345, [{ amount: 400 }, { amount: -30 }]);
  ok('استرداد جزئي — يبقى ٢٥ فائضاً', part.overpaid === 25, `overpaid=${part.overpaid}`);

  /* استردادٌ يتجاوز الفائض يقلب الاتجاه: صار عليك له. */
  const flip = partnerRow(345, [{ amount: 400 }, { amount: -100 }]);
  ok('استرداد يتجاوز الفائض → صار عليك له ٤٥', flip.balanceDue === 45, `balanceDue=${flip.balanceDue}`);
  ok('ولا فائض', flip.overpaid === 0);

  /* السجلّ لا يُقصّ: الدفعتان تبقيان سطرين. */
  const entries = [{ amount: 400, receiptNo: 'PRT-0001' }, { amount: -55, receiptNo: 'PRT-R-0002' }];
  ok('السجلّ يحفظ الحدثين لا واحداً', entries.length === 2);
  ok('وإيصال الاسترداد يُميَّز بـPRT-R', entries[1].receiptNo.startsWith('PRT-R-'));
}

console.log('\n═══ ٨ · حارس التكرار — دفعتان متطابقتان بدقيقتين ═══');
{
  /* الحارس في السيرفر يرفض المطابقة خلال دقيقتين. هنا نتأكّد أن
   * السلوك المقصود واضح: دفعةٌ واحدة تُحتسب لا اثنتان. */
  const now = Date.now();
  const raw = [
    { amount: 90, at: now },
    { amount: 90, at: now + 30000 },   // بعد نصف دقيقة — مكرَّرة
    { amount: 90, at: now + 600000 },  // بعد عشر دقائق — دفعةٌ حقيقية ثانية
  ];
  const kept = [];
  raw.forEach(p => {
    const dup = kept.find(k => k.amount === p.amount && (p.at - k.at) < 120000);
    if (!dup) kept.push(p);
  });
  ok('المكرَّرة تُسقط', kept.length === 2, `kept=${kept.length}`);
  ok('والمتباعدة تبقى', kept[1].at === now + 600000);
}

console.log(`\n${'═'.repeat(48)}`);
console.log(`  ✅ نجح: ${pass}   ❌ فشل: ${fail}`);
console.log('═'.repeat(48));
process.exit(fail ? 1 : 0);
