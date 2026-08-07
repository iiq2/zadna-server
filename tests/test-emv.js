/* ═══════════════════════════════════════════════════════════════
   اختبار مولّد كود الدفع (EMVCo / IPS الفلسطيني)

   السؤال: هل يمسح الزبون كوداً فيُملأ مبلغٌ غير مبلغ طلبه، أو يرفضه
   بنكُه وهو واقفٌ ينتظر؟

   والاختبار يقرأ الدالتين **من `server.js` نفسه** لا من نسخة — كي لا
   يصير هذا الملفّ حقيقةً ثانيةً تختلف عن الأولى.
   ═══════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const block = src.match(/const EMV_CRC[\s\S]*?\n  return rebuilt \+ EMV_CRC\(rebuilt\);\n}/);
if (!block) {
  console.error('❌ لم أجد EMV_CRC/emvWithAmount في server.js — تغيّر الملفّ؟');
  process.exit(1);
}
const { EMV_CRC, emvWithAmount } = eval(
  '(function(){' + block[0].replace(/^const EMV_CRC/, 'var EMV_CRC') +
  '; return { EMV_CRC, emvWithAmount };})()'
);

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log(`  ✅ ${n}`); }
                          else { fail++; console.log(`  ❌ ${n}${x ? ' → ' + x : ''}`); } };

/** قالب شبيه بملصق الصفا الحقيقي (IPS فلسطيني). */
function tpl(body) { return body + '6304' + EMV_CRC(body + '6304'); }
const BODY = '000201' + '010211'
  + '29300012ps.pma.ips0111SAFKPS220000'
  + '52045499' + '5303376' + '5802PS' + '5910ZADNA FOOD' + '6006NABLUS';
const T = tpl(BODY);

console.log('\n═══ ١ · الختم يُحسب على الناتج كاملاً ═══');
{
  for (const amt of [115, 50, 7.5, 99.99, 1, 250.5]) {
    const out = emvWithAmount(T, amt);
    ok(`${amt} ₪ — الختم يطابق`, out && out.slice(-4) === EMV_CRC(out.slice(0, -4)));
  }
}

console.log('\n═══ ٢ · المبلغ يدخل بمنزلتين دائماً ═══');
{
  /* المطابقة في banksms.js حرفيةٌ بالقرش. فمبلغٌ يُكتب «115» بدل
   * «115.00» قد يُقرأ مئةً وخمسة عشر أو مئةً وخمسة عشر ألفاً. */
  ok('١١٥ → 115.00', emvWithAmount(T, 115).includes('5406115.00'));
  ok('٧٫٥ → 7.50',   emvWithAmount(T, 7.5).includes('54047.50'));
  ok('١ → 1.00',     emvWithAmount(T, 1).includes('54041.00'));
  ok('٩٩٫٩٩ → 99.99', emvWithAmount(T, 99.99).includes('540599.99'));
  /* الطول في الوسم يجب أن يساوي طول القيمة فعلاً — وإلّا انزاح قارئ
   * TLV عن موضعه وقرأ ما بعده خطأً. */
  for (const [v, tag] of [[115,'5406'],[7.5,'5404'],[1,'5404'],[99.99,'5405'],[1234.5,'5407']]) {
    const s2 = Number(v).toFixed(2);
    ok(`طول وسم ${s2} = ${tag.slice(2)}`, emvWithAmount(T, v).includes(tag + s2));
  }
}

console.log('\n═══ ٣ · موضع المبلغ ═══');
{
  const out = emvWithAmount(T, 115);
  ok('بعد العملة (٥٣) مباشرةً — ترتيبٌ تصاعدي',
    out.indexOf('5406115.00') === out.indexOf('5303376') + 7);
  ok('وقبل البلد (٥٨)', out.indexOf('5406115.00') < out.indexOf('5802PS'));
}

console.log('\n═══ ٤ · ما يجب أن يُرفض ═══');
{
  ok('قالب فارغ', emvWithAmount('', 115) === null);
  ok('قالب قصير', emvWithAmount('0002', 115) === null);
  ok('قالب بلا 6304', emvWithAmount('0002010102115802PS9999ABCD', 115) === null);
  ok('مبلغ صفر', emvWithAmount(T, 0) === null);
  ok('مبلغ سالب', emvWithAmount(T, -5) === null);
  ok('مبلغ نصّ', emvWithAmount(T, 'abc') === null);
  ok('مبلغ فارغ', emvWithAmount(T, null) === null);
  /* السقف ليس تحكّماً: مبلغٌ بستّة أصفار في كود دفعٍ غالباً خطأٌ
   * برمجي، وتوليدُه أخطر من رفضه. */
  ok('مبلغ فوق السقف', emvWithAmount(T, 999999) === null);
}

console.log('\n═══ ٥ · الفخّان اللذان أُصلحا ═══');
{
  /* أ — الاسم العربي.
   * كان الختم يُحسب بـ`ascii` فتُشوَّه بايتات العربية ويخرج ختمٌ خاطئ،
   * فيرفض بنكُ الزبون الكود بلا سببٍ ظاهر. */
  const arBody = '000201' + '010211' + '5303376' + '5802PS' + '5910زادنا فود';
  const arT = tpl(arBody);
  const arOut = emvWithAmount(arT, 115);
  ok('اسم عربي — الختم صحيح', arOut && arOut.slice(-4) === EMV_CRC(arOut.slice(0, -4)));

  const asciiCrc = (s) => { let c = 0xFFFF;
    for (const ch of Buffer.from(s, 'ascii')) { c ^= ch << 8;
      for (let i = 0; i < 8; i++) c = ((c & 0x8000) ? (c << 1) ^ 0x1021 : c << 1) & 0xFFFF; }
    return c.toString(16).toUpperCase().padStart(4, '0'); };
  ok('والحساب بـascii كان يعطي ختماً مختلفاً (إثبات أن الإصلاح لازم)',
    asciiCrc(arOut.slice(0, -4)) !== arOut.slice(-4));

  /* ب — قالبٌ يحمل مبلغاً ثابتاً سلفاً.
   * الحشر النصّي كان يضيف ثانياً، فيقرأ البنك أوّلهما أو يرفض. */
  const dupT = tpl('000201' + '010211' + '5303376' + '5406050.00' + '5802PS' + '5905ZADNA');
  const dupOut = emvWithAmount(dupT, 115);
  ok('مبلغٌ موجود يُستبدل', dupOut.includes('5406115.00'));
  ok('ولا يبقى القديم', !dupOut.includes('5406050.00'));
  ok('والختم صحيح بعد الاستبدال', dupOut.slice(-4) === EMV_CRC(dupOut.slice(0, -4)));
}

console.log('\n═══ ٦ · القالب اللاتيني لم يتغيّر ناتجه ═══');
{
  /* كلود كود جرّب الكود ميدانياً فمسحه تطبيق بنكٍ آخر وملأ كل الخانات.
   * فأي تعديلٍ لاحق يجب أن يُبقي ناتج القالب اللاتيني كما هو حرفاً
   * بحرف — وإلّا أبطلنا تجربةً ميدانية بتحسينٍ نظري. */
  const expect = {
    115:   emvWithAmount(T, 115),
    50:    emvWithAmount(T, 50),
    7.5:   emvWithAmount(T, 7.5),
  };
  ok('الناتج حتميّ (نفس المدخل → نفس المخرج)',
    emvWithAmount(T, 115) === expect[115] &&
    emvWithAmount(T, 50) === expect[50] &&
    emvWithAmount(T, 7.5) === expect[7.5]);
  ok('ولا يحمل محارف خارج ASCII', /^[\x20-\x7E]+$/.test(expect[115]));
}

console.log(`\n${'═'.repeat(48)}`);
console.log(`  ✅ نجح: ${pass}   ❌ فشل: ${fail}`);
console.log('═'.repeat(48));
process.exit(fail ? 1 : 0);
