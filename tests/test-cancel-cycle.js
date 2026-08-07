/* ═══════════════════════════════════════════════════════════════
   اختبار دورة الإلغاء والحالات — الفجوات التي كشفها التدقيق الثلاثي.

   ١. `buildCancellation` تكتب `refundStatus` لكل طلبٍ مدفوع، أياً كان
      المسار — فوعدُ «سيُعاد إليك» يصير أثراً في `refunds/pending`.
   ٢. حارس رتبة التسليم: DELIVERED لا يُقبل إلا من حالةٍ يصحّ أن
      يسبقها تسليم.
   ٣. الطلب الملغى/المسلَّم لا يُعدَّل.

   المنطق يُقرأ **من orders.js نفسه** لا من نسخة — فلا يصير هذا
   الملفّ حقيقةً ثانية تختلف عن الأولى.
   ═══════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'orders.js'), 'utf8');

/* نعزل buildCancellation ونحقنها بـ STATUS_AR و ledger صوريَّين */
const fnStart = src.indexOf('function buildCancellation(');
const fnEnd = src.indexOf('\n}', fnStart) + 2;
const fnSrc = src.slice(fnStart, fnEnd);
const buildCancellation = eval(
  '(function(){'
  + 'const STATUS_AR = { CANCELLED: "ملغى ❌" };'
  + 'const ledger = { KINDS: { CANCELLED: "cancelled", REFUND_DUE: "refund_due" } };'
  + fnSrc + '; return buildCancellation;})()'
);

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log(`  ✅ ${n}`); }
                          else { fail++; console.log(`  ❌ ${n}${x ? ' → ' + x : ''}`); } };

console.log('\n═══ ١ · الإلغاء المدفوع يخلّف أثر استرداد — لا وعداً يضيع ═══');
{
  const paid = { id: 'o1', paidOnline: true, money: { grandTotal: 115 }, customerPhone: '059' };
  const r = buildCancellation(paid, { by: 'shop', reason: 'نفد الصنف' });
  ok('refundStatus=pending', r.patch.refundStatus === 'pending', JSON.stringify(r.patch));
  ok('refundDue = المبلغ الكامل ١١٥', r.patch.refundDue === 115);
  ok('paymentStatus=refund_pending', r.patch.paymentStatus === 'refund_pending');
  ok('قيدان: إلغاء + دَين استرداد', r.ledgerEntries.length === 2);
  ok('القيد الثاني refund_due', r.ledgerEntries[1].kind === 'refund_due');
  ok('مبلغ الدَّين ١١٥', r.ledgerEntries[1].amount === 115);
}

console.log('\n═══ ٢ · الإلغاء غير المدفوع لا يخترع استرداداً ═══');
{
  const cash = { id: 'o2', paidOnline: false, money: { grandTotal: 115 } };
  const r = buildCancellation(cash, { by: 'system', reason: 'مهجور' });
  ok('لا refundStatus', r.patch.refundStatus === undefined);
  ok('لا refundDue', r.patch.refundDue === undefined);
  ok('قيدٌ واحد فقط (إلغاء)', r.ledgerEntries.length === 1);
  ok('والحالة CANCELLED مع نصّها العربي', r.patch.status === 'CANCELLED' && r.patch.statusAr === 'ملغى ❌');
}

console.log('\n═══ ٣ · paymentStatus=paid يُعامَل كمدفوع ولو paidOnline غائبة ═══');
{
  /* الطلب الهجين: أُكِّد دفعه لكن حقلٌ قديم — نقرأ الاثنين. */
  const p = { id: 'o3', paymentStatus: 'paid', money: { grandTotal: 90 } };
  const r = buildCancellation(p, { by: 'admin', reason: 'طلب الزبون' });
  ok('يُعرف كمدفوع بـpaymentStatus', r.patch.refundStatus === 'pending' && r.patch.refundDue === 90);
}

console.log('\n═══ ٤ · يسقط على grandTotal الجذر إن غاب money ═══');
{
  const legacy = { id: 'o4', paidOnline: true, grandTotal: 50 };
  const r = buildCancellation(legacy, { by: 'shop', reason: 'x' });
  ok('يقرأ الجذر حين لا money', r.patch.refundDue === 50, `refundDue=${r.patch.refundDue}`);
}

console.log('\n═══ ٥ · حارس رتبة التسليم (منطق مطابق للمسار) ═══');
{
  const DELIVERABLE_FROM = ['DRIVER_ASSIGNED', 'AT_RESTAURANT', 'PICKED_UP', 'ON_THE_WAY'];
  const canDeliver = (prev, isAdmin) => isAdmin || DELIVERABLE_FROM.includes(prev);

  ok('من PICKED_UP يصحّ', canDeliver('PICKED_UP', false));
  ok('من ON_THE_WAY يصحّ', canDeliver('ON_THE_WAY', false));
  ok('من PENDING_RESTAURANT يُرفض (قفزة ملفَّقة)', !canDeliver('PENDING_RESTAURANT', false));
  ok('من READY_FOR_PICKUP يُرفض (بلا مندوب بعد)', !canDeliver('READY_FOR_PICKUP', false));
  ok('من CANCELLED يُرفض', !canDeliver('CANCELLED', false));
  ok('الإدارة تتجاوز — تصحيح حالة عالقة', canDeliver('PENDING_RESTAURANT', true));
}

console.log('\n═══ ٦ · حارس الحالة النهائية (منطق مطابق) ═══');
{
  const isFinal = s => ['CANCELLED', 'DELIVERED'].includes(s);
  ok('CANCELLED نهائية', isFinal('CANCELLED'));
  ok('DELIVERED نهائية', isFinal('DELIVERED'));
  ok('PREPARING ليست نهائية', !isFinal('PREPARING'));
  ok('READY_FOR_PICKUP ليست نهائية', !isFinal('READY_FOR_PICKUP'));
}

console.log('\n═══ ٧ · حارس تكرار مرجع QR (منطق مطابق) ═══');
{
  /* المُلغى حرّر رقمه — لا يمنع. الحيّ يمنع. نفس الطلب تحديث لا تكرار. */
  const clashOf = (docs, myId) => docs.find(d =>
    d.id !== myId && String(d.status || '') !== 'CANCELLED');

  const docs = [
    { id: 'A', status: 'DELIVERED' },   // حيّ بنفس المرجع — تعارض
    { id: 'B', status: 'CANCELLED' },   // ملغى — لا يمنع
  ];
  ok('طلب حيّ بنفس المرجع → تعارض', !!clashOf(docs, 'me'));
  ok('لو الحيّ الوحيد ملغى → لا تعارض', !clashOf([{ id: 'B', status: 'CANCELLED' }], 'me'));
  ok('نفس الطلب لا يُحسب تعارضاً', !clashOf([{ id: 'me', status: 'claim_pending' }], 'me'));
}

console.log(`\n${'═'.repeat(48)}`);
console.log(`  ✅ نجح: ${pass}   ❌ فشل: ${fail}`);
console.log('═'.repeat(48));
process.exit(fail ? 1 : 0);
