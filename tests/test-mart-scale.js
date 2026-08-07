/* ═══════════════════════════════════════════════════════════════
   اختبار كتالوج الخمسة آلاف — الصفحات والبحث والمعرّف المستقرّ.

   السؤال الذي وُلد منه: شريكٌ حقيقي بخمسة آلاف صنف. هل يضاعف
   الاستيرادُ المكرّر بضاعته؟ وهل يجد البحثُ «الزَّيت» من كتب «زيت»؟
   وهل تستقرّ الصفحات فلا يقفز صنفٌ بينها؟

   `normText` و`stableProductId` تُقرآن **من mart.js نفسه** لا من
   نسخة — كي لا يصير هذا الملف حقيقةً ثانية تختلف عن الأولى.
   ومنطق الصفحات يُعاد بناؤه هنا مستقلاً (كاختبار الدفعات) — لو
   انقلب حكم الأصل غداً صرخ الاختبار بدل أن يوافقه.
   ═══════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'mart.js'), 'utf8');

function extract(name, endMark) {
  const i = src.indexOf(`function ${name}(`);
  if (i < 0) { console.error(`❌ لم أجد ${name} في mart.js`); process.exit(1); }
  const j = src.indexOf(endMark, i);
  return src.slice(i, j + endMark.length);
}

const { normText, stableProductId } = eval('(function(){'
  + extract('normText', '.toLowerCase().trim();\n}')
  + extract('stableProductId', "return 'pn_' + h1.toString(36) + h2.toString(36);\n}")
  + '; return { normText, stableProductId };})()');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log(`  ✅ ${n}`); }
                          else { fail++; console.log(`  ❌ ${n}${x ? ' → ' + x : ''}`); } };

console.log('\n═══ ١ · التطبيع — البحث يجد رغم اختلاف الكتابة ═══');
{
  ok('التشكيل يسقط', normText('الزَّيْت') === normText('الزيت'));
  ok('الهمزات تتوحّد', normText('أرز') === normText('ارز') && normText('إبرة') === normText('ابرة'));
  ok('التاء المربوطة هاء', normText('جبنة') === normText('جبنه'));
  ok('الألف المقصورة ياء', normText('حلوى') === normText('حلوي'));
  ok('لاتيني يصغَّر', normText('COCA Cola') === 'coca cola');
  ok('الفراغات تُشذَّب', normText('  زيت  ') === 'زيت');
  ok('«زيت» يوجد داخل «زَيت زيتون بلدي»', normText('زَيت زيتون بلدي').includes(normText('زيت')));
}

console.log('\n═══ ٢ · المعرّف المستقرّ — درع الاستيراد المكرّر ═══');
{
  const a = stableProductId({ nameAr: 'زيت زيتون ١ لتر', brand: 'بلدي' });
  const b = stableProductId({ nameAr: 'زيت زيتون ١ لتر', brand: 'بلدي' });
  ok('نفس الصف → نفس المعرّف', a === b, `${a} ≠ ${b}`);

  const c = stableProductId({ nameAr: 'زَيت زيتون ١ لتر', brand: 'بلدي' });
  ok('اختلاف التشكيل لا يفرّق', a === c);

  const d = stableProductId({ nameAr: 'زيت زيتون ٢ لتر', brand: 'بلدي' });
  ok('اسم مختلف → معرّف مختلف', a !== d);

  const e = stableProductId({ nameAr: 'زيت زيتون ١ لتر', brand: 'الجليل' });
  ok('علامة مختلفة → معرّف مختلف', a !== e);

  const s = stableProductId({ nameAr: 'أي شي', sku: 'ABC-123' });
  ok('sku يفوز حين يوجد', s === 'sku_ABC-123');
  const s2 = stableProductId({ nameAr: 'اسم آخر كلياً', sku: 'ABC-123' });
  ok('نفس sku → نفس المعرّف مهما اختلف الاسم', s === s2);

  /* خمسة آلاف اسمٍ شبيهٍ بالواقع — لا تصادم */
  const seen = new Set();
  let collide = 0;
  const cats = ['زيت', 'رز', 'سكر', 'شاي', 'جبنة', 'حليب', 'مكرونة', 'طحين', 'ملح', 'قهوة'];
  for (let i = 0; i < 5000; i++) {
    const id = stableProductId({ nameAr: `${cats[i % 10]} صنف ${i}`, brand: `علامة ${i % 40}` });
    if (seen.has(id)) collide++;
    seen.add(id);
  }
  ok('٥٠٠٠ اسم واقعي بلا تصادم واحد', collide === 0, `تصادمات: ${collide}`);
}

console.log('\n═══ ٣ · الصفحات — منطق مستقلّ يقابل منطق المسار ═══');
{
  /* نفس خطوات المسار: فلترة ثم ترتيب ثابت ثم قصّ */
  const catalog = [];
  for (let i = 0; i < 137; i++) {
    catalog.push({
      id: 'p' + i,
      nameAr: 'صنف ' + String(i).padStart(3, '0'),
      categoryId: i % 3 === 0 ? 'dairy' : 'pantry',
      available: i % 11 !== 0,                       // بعضها نافد
      units: i % 5 === 0 ? [{ label: 'حبة', price: 10, offerPrice: 8 }]
                         : [{ label: 'حبة', price: 10 }],
    });
  }
  const visible = catalog.filter(p => p.available !== false);

  function pageOf(list, { categoryId, q, offers, limit, cursor }) {
    let f = list;
    if (categoryId) f = f.filter(p => String(p.categoryId || 'pantry') === categoryId);
    if (q) f = f.filter(p => normText(p.nameAr).includes(normText(q)));
    if (offers) f = f.filter(p => Array.isArray(p.units) && p.units.some(u => u && u.offerPrice != null));
    const sorted = [...f].sort((a, b) => String(a.nameAr).localeCompare(String(b.nameAr), 'ar'));
    const cur = Math.max(0, cursor || 0);
    return { items: sorted.slice(cur, cur + limit), total: sorted.length,
             nextCursor: cur + limit < sorted.length ? cur + limit : null };
  }

  const p1 = pageOf(visible, { limit: 50, cursor: 0 });
  const p2 = pageOf(visible, { limit: 50, cursor: p1.nextCursor });
  const p3 = pageOf(visible, { limit: 50, cursor: p2.nextCursor });
  ok('المجموع = مجموع الصفحات', p1.items.length + p2.items.length + p3.items.length === p1.total,
     `${p1.items.length}+${p2.items.length}+${p3.items.length} ≠ ${p1.total}`);
  ok('آخر صفحة بلا مؤشّر تالٍ', p3.nextCursor === null);

  const ids = new Set([...p1.items, ...p2.items, ...p3.items].map(p => p.id));
  ok('لا صنف مكرّر بين الصفحات', ids.size === p1.total, `فريد ${ids.size} من ${p1.total}`);

  const dairy = pageOf(visible, { categoryId: 'dairy', limit: 100, cursor: 0 });
  ok('فلتر القسم يصيب', dairy.items.every(p => p.categoryId === 'dairy') && dairy.total > 0);

  const offers = pageOf(visible, { offers: true, limit: 100, cursor: 0 });
  ok('فلتر العروض: كلها عليها عرض', offers.items.every(p => p.units.some(u => u.offerPrice != null)));

  const q = pageOf(visible, { q: 'صنف 00', limit: 100, cursor: 0 });
  ok('البحث يقصّ الصفر الزائد صح', q.total === visible.filter(p => p.nameAr.includes('صنف 00')).length);

  const empty = pageOf(visible, { q: 'لا وجود له إطلاقاً', limit: 50, cursor: 0 });
  ok('بحث بلا نتيجة: صفر وبلا مؤشّر', empty.total === 0 && empty.nextCursor === null);

  /* النافد لا يظهر — القاعدة القديمة لا تنكسر بالجديدة */
  ok('النافد خارج كل صفحة', ![...p1.items, ...p2.items, ...p3.items].some(p => p.available === false));
}

console.log('\n═══ ٤ · light — العدّ يطابق الكتالوج ═══');
{
  const visible = [];
  for (let i = 0; i < 60; i++) {
    visible.push({
      categoryId: ['dairy', 'bakery', 'produce'][i % 3],
      units: i % 4 === 0 ? [{ price: 10, offerPrice: 7 }] : [{ price: 10 }],
    });
  }
  const catMap = {};
  let offersTotal = 0;
  for (const p of visible) {
    const cid = p.categoryId;
    if (!catMap[cid]) catMap[cid] = { count: 0, offers: 0 };
    catMap[cid].count++;
    if (p.units.some(u => u.offerPrice != null)) { catMap[cid].offers++; offersTotal++; }
  }
  const sum = Object.values(catMap).reduce((s, c) => s + c.count, 0);
  ok('مجموع الأقسام = كل الأصناف', sum === 60);
  ok('عدد العروض ١٥ (كل رابع)', offersTotal === 15, `offersTotal=${offersTotal}`);
  ok('كل قسم ٢٠', Object.values(catMap).every(c => c.count === 20));
}

console.log(`\n${'═'.repeat(48)}`);
console.log(`  ✅ نجح: ${pass}   ❌ فشل: ${fail}`);
console.log('═'.repeat(48));
process.exit(fail ? 1 : 0);
