/* ═══════════════════════════════════════════════════════════════
   اختبار مطابقة تحويلات البنك وفحص التوازن

   السؤال: هل يستطيع أحدٌ أن يُقنع زادنا بأن مالاً وصلها ولم يصل؟
   ═══════════════════════════════════════════════════════════════ */

const path = require('path');
const Module = require('module');
const SRV = require('path').join(__dirname, '..');

// نُخرس العدّاد ونحقن express وهمياً — لا شبكة ولا قرص في الاختبار
const _resolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req.endsWith('utils/meter') || req === '../utils/meter') return 'FAKE_METER';
  if (req === 'express') return 'FAKE_EXPRESS';
  // banksms صار يستورد push (releaseHeldOrder) — نموّهه فلا نجرّ firebase-admin
  if (req === './push' || req.endsWith('routes/push')) return 'FAKE_PUSH';
  return _resolve.call(this, req, ...rest);
};
require.cache['FAKE_METER'] = { id:'FAKE_METER', filename:'FAKE_METER', loaded:true,
  exports:{ addReads(){}, addWrites(){}, stats:()=>({}) } };
require.cache['FAKE_PUSH'] = { id:'FAKE_PUSH', filename:'FAKE_PUSH', loaded:true,
  exports:{ releaseHeldOrder: async () => false, notifyRestaurant(){}, notifyDrivers(){}, notifyCustomer(){} } };

const ROUTES = {};
require.cache['FAKE_EXPRESS'] = { id:'FAKE_EXPRESS', filename:'FAKE_EXPRESS', loaded:true,
  exports: { Router: () => {
    const reg = (m) => (p, ...h) => { ROUTES[m + ' ' + p] = h[h.length - 1]; ROUTES['MW ' + m + ' ' + p] = h.slice(0, -1); };
    return { get: reg('GET'), post: reg('POST'), patch: reg('PATCH'), put: reg('PUT'), delete: reg('DELETE'), use(){} };
  } } };

const reconcile = require(path.join(SRV, 'utils/reconcile.js'));
require(path.join(SRV, 'routes/banksms.js'));

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log(`  ✅ ${n}`); }
                          else { fail++; console.log(`  ❌ ${n}${x ? ' → ' + x : ''}`); } };
const eq = (n, g, w) => ok(n, g === w, `توقّعنا ${w} فجاء ${g}`);

/* ── Firestore وهميّ ── */
function fakeDb(seed = {}) {
  const cols = {};
  for (const [k, v] of Object.entries(seed)) cols[k] = new Map(Object.entries(v));
  const C = (n) => (cols[n] = cols[n] || new Map());
  const wrap = (name) => ({
    doc(id) {
      return {
        async get(){ const d = C(name).get(id); return { exists: !!d, id, data: () => d && {...d} }; },
        async create(doc){ if (C(name).has(id)) { const e = new Error('ALREADY_EXISTS'); e.code = 6; throw e; }
                           C(name).set(id, {...doc}); return { id }; },
        async set(doc){ C(name).set(id, {...doc}); return { id }; },
        async update(p){ C(name).set(id, Object.assign(C(name).get(id) || {}, p)); },
      };
    },
    async add(doc){ const id = name + '_' + (C(name).size + 1); C(name).set(id, {...doc}); return { id }; },
    where(f, op, v){
      const conds = [{ f, op, v }];
      const q = {
        where(f2, o2, v2){ conds.push({ f: f2, op: o2, v: v2 }); return q; },
        limit(){ return q; },
        async get(){
          const rows = [...C(name).entries()].filter(([, d]) => conds.every(c => {
            const parts = c.f.split('.');
            let x = d; for (const p of parts) x = x && x[p];
            const A = x instanceof Date ? x.getTime() : x;
            const B = c.v instanceof Date ? c.v.getTime() : c.v;
            if (c.op === '==') return A === B;
            if (c.op === '>=') return A >= B;
            if (c.op === '<=') return A <= B;
            return true;
          }));
          return { size: rows.length, empty: !rows.length,
                   forEach: fn => rows.forEach(([id, d]) => fn({ id, data: () => ({...d}) })) };
        },
      };
      return q;
    },
    async get(){ const rows = [...C(name).entries()];
      return { size: rows.length, empty: !rows.length,
               forEach: fn => rows.forEach(([id, d]) => fn({ id, data: () => ({...d}) })) }; },
    async count(){ return { data: () => ({ count: C(name).size }) }; },
  });
  return { collection: wrap, _cols: cols, _get: (c, id) => (cols[c] || new Map()).get(id) };
}

const mkRes = () => { const r = { code: 200, body: null, sent: false };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; r.sent = true; return r; };
  r.set = () => r; return r; };

const mkReq = (db, body, headers = {}) => ({
  body, headers, params: {}, query: {},
  app: { get: (k) => (k === 'db' ? db : (k === 'socketio' ? { emit(){} } : null)) },
});

const ORDER = {
  totalAmount: 100, deliveryFee: 15, status: 'READY_FOR_PICKUP',
  customerName: 'سامي', customerPhone: '0599111222',
  grandTotal: 115, paidOnline: false, paymentStatus: 'claim_pending',
  qrClaim: { reference: '4421', refNorm: '4421', amount: 115, at: new Date() },
};

const handler = ROUTES['POST /bank/sms'];
const auth = ROUTES['MW POST /bank/sms'][0];

const runAuth = (req) => { const res = mkRes(); let passed = false;
  auth(req, res, () => { passed = true; }); return { passed, res }; };

(async () => {

console.log('\n═══ ١ · المفتاح ═══');
{
  delete process.env.SMS_HOOK_KEY;
  let r = runAuth(mkReq(null, {}, { 'x-sms-key': 'anything' }));
  ok('بلا مفتاح مضبوط: يُرفض ولا يمرّ', !r.passed && r.res.code === 503);

  process.env.SMS_HOOK_KEY = 'short';
  r = runAuth(mkReq(null, {}, { 'x-sms-key': 'short' }));
  ok('مفتاح قصير يُرفض ولو طابق', !r.passed && r.res.code === 503);

  process.env.SMS_HOOK_KEY = 'K'.repeat(40);
  r = runAuth(mkReq(null, {}, { 'x-sms-key': 'K'.repeat(39) }));
  ok('مفتاح خاطئ يُرفض', !r.passed && r.res.code === 401);

  r = runAuth(mkReq(null, {}, {}));
  ok('بلا ترويسة يُرفض', !r.passed && r.res.code === 401);

  r = runAuth(mkReq(null, {}, { 'x-sms-key': 'K'.repeat(40) }));
  ok('المفتاح الصحيح يمرّ', r.passed);
}

console.log('\n═══ ٢ · المطابقة الصحيحة ═══');
{
  const db = fakeDb({ orders: { '4471': { ...ORDER } } });
  const res = mkRes();
  await handler(mkReq(db, { amount: 115, reference: '4421', at: Date.now() }), res);

  ok('طوبق', res.body && res.body.matched === true, JSON.stringify(res.body));
  eq('بالطلب الصحيح', res.body.orderId, '4471');

  const o = db._get('orders', '4471');
  eq('صار مدفوعاً', o.paidOnline, true);
  eq('بطريقة qr', o.paymentMethod, 'qr');
  eq('وأُثبت أن المطابقة آلية', o.paymentConfirmedBy, 'bank_sms');
  eq('المندوب لا يحصّل', o.money.cashToCollect, 0);
  eq('ولا يدفع للمحلّ', o.money.payToRestaurant, 0);
  eq('وأنت تدين للمحلّ', o.money.owedToRestaurant, 90);
  eq('وللمندوب', o.money.owedToDriver, 13.5);
  eq('وربحك', o.money.zadnaCommission, 11.5);
  eq('والتحويل عُلّم مطابَقاً', db._get('bank_inbox', '4421').status, 'matched');
  ok('وكُتب قيدٌ في الدفتر', (db._cols.ledger || new Map()).size === 1);
}

console.log('\n═══ ٣ · محاولات لا تنجح ═══');
{
  // مبلغ لا يطابق — أهمّ قفل: مرجعٌ صحيح بمبلغٍ أقلّ
  let db = fakeDb({ orders: { '1': { ...ORDER } } });
  let res = mkRes();
  await handler(mkReq(db, { amount: 50, reference: '4421' }), res);
  ok('مبلغ أقلّ لا يُطابق', res.body.matched === false);
  eq('والطلب بقي غير مدفوع', db._get('orders', '1').paidOnline, false);

  // فرق قرشين
  db = fakeDb({ orders: { '1': { ...ORDER } } }); res = mkRes();
  await handler(mkReq(db, { amount: 114.9, reference: '4421' }), res);
  ok('فرق عشرة أغورة لا يُطابق', res.body.matched === false);

  // مرجع لم يُبلّغ عنه أحد
  db = fakeDb({ orders: { '1': { ...ORDER } } }); res = mkRes();
  await handler(mkReq(db, { amount: 115, reference: '9999' }), res);
  ok('مرجع مخترع لا يُطابق', res.body.matched === false);
  ok('لكنه يُسجَّل في الصندوق', !!db._get('bank_inbox', '9999'));

  // طلب ملغيّ
  db = fakeDb({ orders: { '1': { ...ORDER, status: 'CANCELLED' } } }); res = mkRes();
  await handler(mkReq(db, { amount: 115, reference: '4421' }), res);
  ok('الطلب الملغيّ لا يُطابق', res.body.matched === false);

  // طلب مدفوع سلفاً
  db = fakeDb({ orders: { '1': { ...ORDER, paidOnline: true } } }); res = mkRes();
  await handler(mkReq(db, { amount: 115, reference: '4421' }), res);
  ok('المدفوع سلفاً لا يُطابق ثانيةً', res.body.matched === false);

  // خارج النافذة الزمنية
  db = fakeDb({ orders: { '1': { ...ORDER,
    qrClaim: { reference: '4421', refNorm: '4421', amount: 115, at: new Date(Date.now() - 9 * 3600000) } } } });
  res = mkRes();
  await handler(mkReq(db, { amount: 115, reference: '4421', at: Date.now() }), res);
  ok('بلاغ عمره ٩ ساعات لا يُطابق', res.body.matched === false);
}

console.log('\n═══ ٤ · التحويل لا يُستهلك مرّتين ═══');
{
  const db = fakeDb({ orders: { '4471': { ...ORDER } } });
  let res = mkRes();
  await handler(mkReq(db, { amount: 115, reference: '4421' }), res);
  ok('الأولى طابقت', res.body.matched === true);

  res = mkRes();
  await handler(mkReq(db, { amount: 115, reference: '4421' }), res);
  ok('الثانية تُردّ كمكرَّرة', res.body.already === true);
  eq('ولا تُنشئ قيداً ثانياً', (db._cols.ledger || new Map()).size, 1);
}

console.log('\n═══ ٥ · تطبيع المرجع ═══');
{
  const db = fakeDb({ orders: { '1': { ...ORDER } } });
  const res = mkRes();
  // البنك كتبه بشرطة والزبون كتبه نظيفاً — يجب أن يلتقيا رغم ذلك
  await handler(mkReq(db, { amount: 115, reference: '44-21' }), res);
  ok('المرجع يُطبَّع قبل الحفظ', !!db._get('bank_inbox', '4421'));
  ok('ويُطابَق رغم اختلاف الكتابة', res.body.matched === true, JSON.stringify(res.body));

  // وأرقام عربية
  const db2 = fakeDb({ orders: { '1': { ...ORDER } } });
  const res2 = mkRes();
  await handler(mkReq(db2, { amount: 115, reference: '٤٤٢١' }), res2);
  ok('والأرقام العربية تُطابَق', res2.body.matched === true, JSON.stringify(res2.body));
}

console.log('\n═══ ٦ · التأكيد بعد الاستلام: المندوب هو الدائن ═══');
{
  const db = fakeDb({ orders: { '1': { ...ORDER, status: 'DELIVERED' } } });
  const res = mkRes();
  await handler(mkReq(db, { amount: 115, reference: '4421' }), res);
  const m = db._get('orders', '1').money;
  eq('لا تدفع للمحلّ ثانيةً', m.owedToRestaurant, 0);
  eq('والمندوب دائنٌ بـ١٠٣٫٥', m.owedToDriver, 103.5);
  eq('وأثرُ السبب محفوظ', m.driverPaidRestaurant, 90);
}

console.log('\n═══ ٧ · فحص التوازن ═══');
{
  // كل شيء متّزن
  let db = fakeDb({ users: {}, orders: {}, settlements: {}, ledger: {}, bank_inbox: {} });
  let rep = await reconcile.fullCheck(db);
  eq('لا خلل → ok', rep.severity, 'ok');

  // مندوب عدّاده أكبر من الواقع بـ٥٠
  db = fakeDb({
    users: { d1: { role: 'driver', name: 'أحمد', cashOnHand: 75 } },
    orders: { o1: { status: 'DELIVERED', driverId: 'd1',
                    money: { cashToCollect: 115, payToRestaurant: 90 } } },
    settlements: {}, ledger: {}, bank_inbox: {},
  });
  rep = await reconcile.fullCheck(db);
  eq('خلل كاش → alert', rep.severity, 'alert');
  const p = rep.problems.find(x => x.code === 'driver_cash');
  ok('كُشف المندوب', !!p && p.count === 1);
  eq('والفرق ٥٠', p.items[0].diff, 50);

  // فرق نصف شيكل تقريبٌ لا خلل
  db = fakeDb({
    users: { d1: { role: 'driver', cashOnHand: 25.4 } },
    orders: { o1: { status: 'DELIVERED', driverId: 'd1',
                    money: { cashToCollect: 115, payToRestaurant: 90 } } },
    settlements: {}, ledger: {}, bank_inbox: {},
  });
  rep = await reconcile.fullCheck(db);
  ok('فرق نصف شيكل لا يُنبَّه عليه', !rep.problems.some(x => x.code === 'driver_cash'));

  // بلاغ عالق + تحويل بلا صاحب
  db = fakeDb({
    users: {}, settlements: {}, ledger: {},
    orders: { o1: { paymentStatus: 'claim_pending', paidOnline: false,
                    qrClaim: { reference: 'X1', amount: 60, at: new Date(Date.now() - 5*3600000) } } },
    bank_inbox: { Z9: { status: 'unmatched', amount: 200, at: new Date() } },
  });
  rep = await reconcile.fullCheck(db);
  eq('تنبيهات بلا خطر → notice', rep.severity, 'notice');
  ok('كُشف البلاغ العالق', rep.problems.some(x => x.code === 'stale_claim'));
  ok('وكُشف التحويل اليتيم', rep.problems.some(x => x.code === 'unmatched_transfer'));

  // استرداد متأخّر
  db = fakeDb({
    users: {}, settlements: {}, ledger: {}, bank_inbox: {},
    orders: { o1: { refundStatus: 'pending', refundDue: 60,
                    cancelledAt: new Date(Date.now() - 72*3600000) } },
  });
  rep = await reconcile.fullCheck(db);
  eq('استرداد متأخّر يومين → alert', rep.severity, 'alert');
  ok('باسمه', rep.problems.some(x => x.code === 'late_refund'));
}

console.log(`\n${'═'.repeat(48)}`);
console.log(`  ✅ نجح: ${pass}   ❌ فشل: ${fail}`);
console.log('═'.repeat(48));
process.exit(fail ? 1 : 0);

})().catch(e => { console.error('💥', e); process.exit(1); });
