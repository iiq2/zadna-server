/* ═══════════════════════════════════════════════════════════════
   اختبار دفتر الأستاذ

   السؤال الذي يجيب عنه: لو اختلفتَ مع مندوبٍ بعد شهر على طلبٍ
   واحد — هل يحسم الدفترُ الخلاف؟

   ولذلك لا نختبر أن الدوال «لا ترمي أخطاء». نختبر:
     · أن كل حدثٍ ترك أثراً
     · أن المجموع يوازن (ما دخل − ما خرج = ما بقي)
     · أن القيد **لا يُعدَّل ولا يُحذف** — ولو حاولنا
   ═══════════════════════════════════════════════════════════════ */

const path = require('path');
const SRV = require('path').join(__dirname, '..');

// عدّاد الحصة يكتب على القرص — نُخرسه في الاختبار
const Module = require('module');
const _resolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req.endsWith('utils/meter') || req === '../utils/meter') return 'FAKE_METER';
  return _resolve.call(this, req, ...rest);
};
require.cache['FAKE_METER'] = {
  id: 'FAKE_METER', filename: 'FAKE_METER', loaded: true,
  exports: { addReads() {}, addWrites() {}, stats: () => ({}) },
};

const ledger = require(path.join(SRV, 'utils/ledger.js'));

/* ── Firestore وهميّ ─────────────────────────────────────────────
   يحفظ في الذاكرة ويحاكي add/get/update. ويسجّل كل update حتى
   نستطيع أن نسأل لاحقاً: هل مُسّ مبلغُ قيدٍ يوماً؟ */
function fakeDb() {
  const store = new Map();   // id → doc
  const updates = [];        // سجلّ كل محاولة تعديل
  let n = 0;
  const col = (name) => ({
    async add(doc) {
      const id = `${name}_${++n}`;
      store.set(id, JSON.parse(JSON.stringify({ ...doc, at: doc.at })));
      store.get(id).at = doc.at;
      return { id };
    },
    doc(id) {
      return {
        async get() {
          const d = store.get(id);
          return { exists: !!d, id, data: () => (d ? { ...d } : undefined) };
        },
        async update(patch) {
          updates.push({ id, patch });
          if (store.has(id)) Object.assign(store.get(id), patch);
        },
      };
    },
    where(field, op, val) {
      const conds = [{ field, op, val }];
      const q = {
        where(f, o, v) { conds.push({ field: f, op: o, val: v }); return q; },
        async get() {
          const rows = [...store.entries()].filter(([, d]) =>
            conds.every(c => {
              const x = d[c.field];
              const a = x instanceof Date ? x.getTime() : x;
              const b = c.val instanceof Date ? c.val.getTime() : c.val;
              if (c.op === '==') return a === b;
              if (c.op === '>=') return a >= b;
              if (c.op === '<=') return a <= b;
              return true;
            }));
          return {
            size: rows.length, empty: !rows.length,
            forEach: (fn) => rows.forEach(([id, d]) => fn({ id, data: () => ({ ...d }) })),
          };
        },
      };
      return q;
    },
    async get() {
      const rows = [...store.entries()];
      return {
        size: rows.length, empty: !rows.length,
        forEach: (fn) => rows.forEach(([id, d]) => fn({ id, data: () => ({ ...d }) })),
      };
    },
  });
  return { collection: col, _store: store, _updates: updates };
}

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' → ' + extra : ''}`); }
};
const eq = (name, got, want) => ok(name, got === want, `توقّعنا ${want} فجاء ${got}`);

(async () => {

/* ══ ١ · القيد يُكتب كاملاً ══ */
console.log('\n═══ ١ · بنية القيد ═══');
{
  const db = fakeDb();
  const e = await ledger.record(db, {
    kind: ledger.KINDS.ORDER_CREATED, orderId: '4471', amount: 115,
    direction: 'neutral', actorId: 'c1', actorRole: 'customer', actorName: 'سامي',
    note: '١٠٠ وجبة + ١٥ توصيل',
  });
  ok('القيد كُتب ورجع بمعرّف', !!(e && e.id));
  eq('المبلغ', e.amount, 115);
  eq('الاتجاه', e.direction, 'neutral');
  ok('الوصف العربي حاضر', !!e.kindAr && e.kindAr !== e.kind, e.kindAr);
  ok('الفاعل مسجَّل', e.actorId === 'c1' && e.actorRole === 'customer');
  ok('الوقت مضبوط', e.at instanceof Date);
}

/* ══ ٢ · نوعٌ مجهول يُرفض ══
   قيدٌ بنوعٍ لم يُعرَّف يُفسد كل تجميعةٍ لاحقة بصمت. */
console.log('\n═══ ٢ · حراسة النوع ═══');
{
  const db = fakeDb();
  const e = await ledger.record(db, { kind: 'شيء_مخترع', amount: 50, direction: 'in' });
  eq('النوع المجهول لا يُكتب', e, null);
  eq('ولم يترك أثراً في المجموعة', db._store.size, 0);
}

/* ══ ٣ · فشل الكتابة لا يُسقط العملية ══
   المندوب سلّم فعلاً — لا يجوز أن يفشل التسليم لأن الدفتر تعثّر. */
console.log('\n═══ ٣ · الدفتر شاهدٌ لا حارس ═══');
{
  const broken = { collection: () => ({ add: async () => { throw new Error('حصة Firestore نفدت'); } }) };
  let threw = false;
  let r;
  try {
    r = await ledger.record(broken, {
      kind: ledger.KINDS.DELIVERED, orderId: '9', amount: 10, direction: 'neutral',
    });
  } catch { threw = true; }
  ok('لم يرمِ خطأً للنداء الأعلى', !threw);
  eq('وأرجع null ليُعرف أن قيداً ضاع', r, null);
}

/* ══ ٤ · قصّة طلبٍ كاملة مرتّبة ══ */
console.log('\n═══ ٤ · قصّة الطلب ═══');
{
  const db = fakeDb();
  const K = ledger.KINDS;
  await ledger.recordMany(db, [
    { kind: K.ORDER_CREATED, orderId: '4471', amount: 115, direction: 'neutral', actorRole: 'customer' },
    { kind: K.COLLECTED_QR, orderId: '4471', amount: 115, direction: 'neutral', actorRole: 'driver', reference: '4421' },
    { kind: K.PAID_RESTAURANT, orderId: '4471', amount: 90, direction: 'neutral', actorRole: 'driver' },
    { kind: K.DELIVERED, orderId: '4471', amount: 115, direction: 'neutral', actorRole: 'driver' },
    { kind: K.ORDER_CREATED, orderId: '9999', amount: 40, direction: 'neutral', actorRole: 'customer' },
  ]);
  const story = await ledger.storyOf(db, '4471');
  eq('أربعة قيود لهذا الطلب', story.length, 4);
  ok('لم تتسرّب قيود طلبٍ آخر', story.every(e => e.orderId === '4471'));
  eq('الأوّل هو الإنشاء', story[0].kind, K.ORDER_CREATED);
  eq('الأخير هو التسليم', story[3].kind, K.DELIVERED);
  ok('مرجع التحويل محفوظ', story[1].reference === '4421');
}

/* ══ ٥ · الميزان: طلب كاش كامل ══
   ١٠٠ وجبة + ١٥ توصيل · عمولة مطعم ١٠٪ · عمولة مندوب ١٠٪
   الزبون ١١٥ ← المطعم ٩٠ · المندوب ١٣٫٥ · زادنا ١١٫٥ */
console.log('\n═══ ٥ · الميزان — الكاش ═══');
{
  const db = fakeDb();
  const K = ledger.KINDS;
  await ledger.recordMany(db, [
    { kind: K.ORDER_CREATED,   orderId: '1', amount: 115,  direction: 'neutral' },
    { kind: K.COLLECTED_CASH,  orderId: '1', amount: 115,  direction: 'neutral' },
    { kind: K.PAID_RESTAURANT, orderId: '1', amount: 90,   direction: 'neutral' },
    { kind: K.DELIVERED,       orderId: '1', amount: 115,  direction: 'neutral' },
    { kind: K.SETTLE_IN,       orderId: null, amount: 11.5, direction: 'in', reference: 'SET-0012' },
  ]);
  const mv = await ledger.movement(db, new Date(Date.now() - 60000), new Date(Date.now() + 60000));
  eq('حُصّل كاشاً', mv.collectedCash, 115);
  eq('لم يُحصَّل شيء إلكترونياً', mv.receivedOnline, 0);
  eq('دخل خزنتك من التسوية', mv.settledIn, 11.5);
  eq('ولم يخرج شيء', mv.paidToDrivers, 0);
  ok('الصافي = عمولتك وحدها', Math.abs(mv.net - 11.5) < 0.01, `net=${mv.net}`);
}

/* ══ ٦ · الميزان: طلب مدفوع إلكترونياً ══
   كل الـ١١٥ تصل زادنا، وتخرج ١٠٣٫٥ للشركاء. الباقي ١١٫٥ — نفس الربح. */
console.log('\n═══ ٦ · الميزان — الإلكتروني ═══');
{
  const db = fakeDb();
  const K = ledger.KINDS;
  await ledger.recordMany(db, [
    { kind: K.ORDER_CREATED,   orderId: '2', amount: 115,   direction: 'neutral' },
    { kind: K.PAID_ONLINE,     orderId: '2', amount: 115,   direction: 'in', reference: 'TXN-77' },
    { kind: K.DELIVERED,       orderId: '2', amount: 115,   direction: 'neutral' },
    { kind: K.SETTLE_OUT,      orderId: null, amount: 13.5, direction: 'out', reference: 'PAY-0003' },
    { kind: K.PARTNER_PAYOUT,  orderId: null, amount: 90,   direction: 'out', reference: 'PAY-0004' },
  ]);
  const mv = await ledger.movement(db, new Date(Date.now() - 60000), new Date(Date.now() + 60000));
  eq('وصلك إلكترونياً', mv.receivedOnline, 115);
  eq('دفعتَ للمندوب', mv.paidToDrivers, 13.5);
  eq('دفعتَ للمحلّ', mv.paidToPartners, 90);
  ok('الصافي ١١٫٥ — نفس ربح الكاش', Math.abs(mv.net - 11.5) < 0.01, `net=${mv.net}`);
}

/* ══ ٧ · التصحيح بقيدٍ مضادّ لا بتعديل ══
   وهذا جوهر الدفتر كلّه. */
console.log('\n═══ ٧ · القيد لا يُعدَّل ═══');
{
  const db = fakeDb();
  const orig = await ledger.record(db, {
    kind: ledger.KINDS.SETTLE_IN, amount: 50, direction: 'in',
    actorRole: 'admin', reference: 'SET-0099',
  });
  const rev = await ledger.reverse(db, orig.id, {
    actorId: 'a1', actorRole: 'admin', actorName: 'يزن', reason: 'سُجّلت مرّتين',
  });

  ok('كُتب قيدٌ مضادّ', !!(rev && rev.id));
  eq('بنفس المبلغ', rev.amount, 50);
  eq('وباتجاهٍ معاكس', rev.direction, 'out');
  ok('يشير إلى الأصل', rev.meta && rev.meta.reversesEntryId === orig.id);
  ok('والسبب مكتوب فيه', /سُجّلت مرّتين/.test(rev.note || ''), rev.note);

  const after = db._store.get(orig.id);
  eq('مبلغ الأصل لم يُمسّ', after.amount, 50);
  eq('واتجاهه لم يُمسّ', after.direction, 'in');
  eq('ومرجعه لم يُمسّ', after.reference, 'SET-0099');
  ok('وعُلّم بأنه عُكس فقط', after.reversedBy === rev.id);

  // التعديل الوحيد المسموح: إشارة العكس — لا المبلغ
  const touched = db._updates.flatMap(u => Object.keys(u.patch));
  ok('لم يُكتب فوق أي حقلٍ مالي',
    !touched.some(k => ['amount', 'direction', 'kind', 'actorId', 'orderId'].includes(k)),
    touched.join(','));

  // والعكس مرّتين ممنوع — وإلّا صار الرقم ناقصاً
  const again = await ledger.reverse(db, orig.id, { actorRole: 'admin', reason: 'مرّة ثانية' });
  eq('لا يُعكس القيد مرّتين', again, null);

  // والميزان بعد التصحيح صفر
  const mv = await ledger.movement(db, new Date(Date.now() - 60000), new Date(Date.now() + 60000));
  ok('الميزان عاد صفراً بعد التصحيح', Math.abs(mv.net) < 0.01, `net=${mv.net}`);
}

/* ══ ٨ · الإلغاء بعد الدفع = دَينٌ عليك ══ */
console.log('\n═══ ٨ · الإلغاء والاسترداد ═══');
{
  const db = fakeDb();
  const K = ledger.KINDS;
  await ledger.recordMany(db, [
    { kind: K.ORDER_CREATED, orderId: '5', amount: 60, direction: 'neutral' },
    { kind: K.PAID_ONLINE,   orderId: '5', amount: 60, direction: 'in', reference: 'TXN-9' },
    { kind: K.CANCELLED,     orderId: '5', amount: 60, direction: 'neutral', note: 'المطعم مغلق' },
    { kind: K.REFUND_DUE,    orderId: '5', amount: 60, direction: 'neutral' },
  ]);
  let mv = await ledger.movement(db, new Date(Date.now() - 60000), new Date(Date.now() + 60000));
  eq('الاسترداد مستحقّ ومرصود', mv.refundsDue, 60);
  eq('ولم يخرج المال بعد', mv.refundsPaid, 0);
  ok('فالمال ما زال عندك', Math.abs(mv.net - 60) < 0.01, `net=${mv.net}`);

  await ledger.record(db, { kind: K.REFUND_PAID, orderId: '5', amount: 60, direction: 'out' });
  mv = await ledger.movement(db, new Date(Date.now() - 60000), new Date(Date.now() + 60000));
  eq('بعد التنفيذ خرج', mv.refundsPaid, 60);
  ok('والميزان أُغلق', Math.abs(mv.net) < 0.01, `net=${mv.net}`);
}

/* ══ ٩ · كاش ثم QR على نفس الطلب — سؤال المستخدم حرفياً ══
   «دفع مال كاش وبعدها دفع qr فهل كل شييأ يسجل» */
console.log('\n═══ ٩ · طريقتان على طلبٍ واحد ═══');
{
  const db = fakeDb();
  const K = ledger.KINDS;
  // حصّل ٤٠ كاشاً، ثم اكتُشف الخطأ فعُكس، ثم حُصّل ١١٥ بـQR
  const cash = await ledger.record(db, {
    kind: K.COLLECTED_CASH, orderId: '7', amount: 40, direction: 'neutral',
    actorRole: 'driver', actorName: 'أحمد',
  });
  await ledger.reverse(db, cash.id, { actorRole: 'admin', reason: 'الزبون بدّل لتحويل' });
  await ledger.record(db, {
    kind: K.COLLECTED_QR, orderId: '7', amount: 115, direction: 'neutral',
    actorRole: 'driver', actorName: 'أحمد', reference: '4421',
  });

  const story = await ledger.storyOf(db, '7');
  eq('ثلاثة أسطر: قبض · تصحيح · قبض', story.length, 3);
  eq('القبض الأول ما زال مرئياً', story[0].kind, K.COLLECTED_CASH);
  eq('يليه التصحيح', story[1].kind, K.REVERSAL);
  eq('ثم التحويل', story[2].kind, K.COLLECTED_QR);
  ok('ولا سطر اختفى', story.every(e => e.amount > 0));
}

/* ══ ١٠ · التقريب — قرشٌ لا يضيع ولا يُخترع ══ */
console.log('\n═══ ١٠ · التقريب ═══');
{
  const db = fakeDb();
  const e = await ledger.record(db, {
    kind: ledger.KINDS.SETTLE_IN, amount: 11.499999999, direction: 'in',
  });
  eq('يُقرَّب لقرشين', e.amount, 11.5);
  const e2 = await ledger.record(db, {
    kind: ledger.KINDS.SETTLE_IN, amount: '13.456', direction: 'in',
  });
  eq('والنصّ يُقرأ رقماً', e2.amount, 13.46);
}

console.log(`\n${'═'.repeat(48)}`);
console.log(`  ✅ نجح: ${pass}   ❌ فشل: ${fail}`);
console.log('═'.repeat(48));
process.exit(fail ? 1 : 0);

})().catch(e => { console.error('💥', e); process.exit(1); });
