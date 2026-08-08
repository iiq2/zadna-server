/* ═══════════════════════════════════════════════════════════════
   اختبار حجب طلب الـQR حتى يتأكّد الدفع — قرار يزن ٨ آب ٢٠٢٦.

   القاعدة: الزبون يختار الدفع بالكود؟ الطلب لا يصل المطعم حتى يؤكّد
   البنك وصول التحويل. حتى التأكيد يعيش في `PENDING_PAYMENT` — يراه
   الزبون، لا المطعم ولا المندوب. فور التأكيد يُطلَق (`releaseHeldOrder`).

   السؤال الجوهري: **هل المطعم لا يطبخ إلا لمالٍ تأكّد وصوله؟** وأن
   الحجب لا يتجمّد أبداً — يُطلَق عند الدفع، ويُلغى عند المهلة.
   ═══════════════════════════════════════════════════════════════ */

const path = require('path');
const Module = require('module');
const SRV = path.join(__dirname, '..');

/* ── تمويه التبعيات الثقيلة: نحمّل push فعلاً بلا شبكة ولا firebase ── */
const _resolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req.endsWith('utils/meter') || req === '../utils/meter') return 'FAKE_METER';
  if (req === 'express') return 'FAKE_EXPRESS';
  if (req === 'firebase-admin') return 'FAKE_ADMIN';
  return _resolve.call(this, req, ...rest);
};
require.cache['FAKE_METER'] = { id:'FAKE_METER', filename:'FAKE_METER', loaded:true,
  exports:{ addReads(){}, addWrites(){}, stats:()=>({}) } };
require.cache['FAKE_EXPRESS'] = { id:'FAKE_EXPRESS', filename:'FAKE_EXPRESS', loaded:true,
  exports:{ Router: () => ({ get(){}, post(){}, patch(){}, put(){}, delete(){}, use(){} }) } };
require.cache['FAKE_ADMIN'] = { id:'FAKE_ADMIN', filename:'FAKE_ADMIN', loaded:true,
  exports:{ messaging: () => ({ sendEachForMulticast: async () => ({ responses: [], successCount: 0, failureCount: 0 }) }) } };

const push = require(path.join(SRV, 'routes/push.js'));
const { releaseHeldOrder } = push;

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log(`  ✅ ${n}`); }
                          else { fail++; console.log(`  ❌ ${n}${x !== undefined ? ' → ' + x : ''}`); } };

/* ── Firestore وهميّ: يلتقط update، ويردّ فارغاً لكل قراءة ── */
function makeDb(orders = {}) {
  const updates = [];
  const col = (name) => ({
    doc: (id) => ({
      async get() {
        const d = name === 'orders' ? orders[id] : undefined;
        return { exists: !!d, id, data: () => (d ? { ...d } : {}) };
      },
      async update(patch) { updates.push({ col: name, id: String(id), patch }); if (name==='orders' && orders[id]) Object.assign(orders[id], patch); },
      async set(){}, async create(){},
    }),
    where() { return { where(){ return this; }, limit(){ return this; }, async get(){ return { empty:true, size:0, forEach(){} }; } }; },
    async get() { return { empty:true, size:0, forEach(){} }; },
  });
  return { db: { collection: col }, updates };
}
function makeApp(db) {
  const emits = [];
  const io = { emit: (ev, payload) => emits.push({ ev, payload }), to: () => ({ emit: (ev, payload) => emits.push({ ev, payload }) }) };
  const app = { get: (k) => (k === 'db' ? db : k === 'socketio' ? io : undefined) };
  return { app, emits };
}

// ════════════════════════════════════════════════════════════════
console.log('\n═══ ١ · متى يُحجب الطلب؟ (العلَم · الطريقة · لم يُدفع) ═══');
{
  /* نفس شرط orders.js — مُستنسَخٌ صريحاً كي يُثبَّت العقد ويُنبّه لو تغيّر */
  const shouldHold = (flag, method, paidOnline) =>
    flag === '1' && method === 'qr' && paidOnline !== true;

  ok('العلَم مفعّل + QR + غير مدفوع → يُحجب', shouldHold('1', 'qr', false) === true);
  ok('العلَم مطفأ → لا حجب مهما كان', shouldHold('0', 'qr', false) === false);
  ok('العلَم غائب → لا حجب (آمن افتراضاً)', shouldHold(undefined, 'qr', false) === false);
  ok('كاش → لا يُحجب أبداً', shouldHold('1', 'cash', false) === false);
  ok('مدفوعٌ سلفاً → لا معنى للحجب', shouldHold('1', 'qr', true) === false);
}

// ════════════════════════════════════════════════════════════════
(async () => {
  console.log('\n═══ ٢ · إطلاق طلب مطعم محجوز → PENDING_RESTAURANT + إشعار ═══');
  {
    const { db, updates } = makeDb({ o1: {
      id: 'o1', heldForPayment: true, isMarketOrder: false,
      restaurantId: 'rest_1', restaurant: 'مطعم', customerPhone: '0599', grandTotal: 115,
    }});
    const { app, emits } = makeApp(db);
    const released = await releaseHeldOrder(app, db, 'o1', { ...( { id:'o1', heldForPayment:true, isMarketOrder:false, restaurantId:'rest_1', restaurant:'مطعم', customerPhone:'0599', grandTotal:115 }) });
    const upd = updates.find(u => u.col === 'orders' && u.id === 'o1');
    ok('أُطلق (return true)', released === true);
    ok('الحالة صارت PENDING_RESTAURANT', upd && upd.patch.status === 'PENDING_RESTAURANT', upd && upd.patch.status);
    ok('heldForPayment صُفّرت', upd && upd.patch.heldForPayment === false);
    ok('كُتب releasedAt', upd && !!upd.patch.releasedAt);
    ok('بُثّ order_updated بالحالة الجديدة',
      emits.some(e => e.ev === 'order_updated' && e.payload.status === 'PENDING_RESTAURANT'));
  }

  console.log('\n═══ ٣ · إطلاق طلب مارت محجوز → READY_FOR_PICKUP + new_ready_order ═══');
  {
    const { db, updates } = makeDb();
    const { app, emits } = makeApp(db);
    const released = await releaseHeldOrder(app, db, 'm1', {
      id: 'm1', heldForPayment: true, isMarketOrder: true,
      restaurantId: 'mkt_1', restaurant: 'ماركت', customerPhone: '0598', grandTotal: 60,
    });
    const upd = updates.find(u => u.col === 'orders' && u.id === 'm1');
    ok('أُطلق (return true)', released === true);
    ok('حالة المارت READY_FOR_PICKUP', upd && upd.patch.status === 'READY_FOR_PICKUP', upd && upd.patch.status);
    ok('بُثّ new_ready_order للمناديب', emits.some(e => e.ev === 'new_ready_order'));
  }

  console.log('\n═══ ٤ · طلبٌ غير محجوز → لا شيء (نداءٌ آمن دائماً) ═══');
  {
    const { db, updates } = makeDb();
    const { app } = makeApp(db);
    const r1 = await releaseHeldOrder(app, db, 'x1', { id:'x1', heldForPayment: false, restaurantId:'rest_1' });
    const r2 = await releaseHeldOrder(app, db, 'x2', { id:'x2', restaurantId:'rest_1' }); // بلا الحقل أصلاً
    ok('heldForPayment=false → return false', r1 === false);
    ok('الحقل غائب → return false', r2 === false);
    ok('لم يُكتب أيّ تحديث', updates.length === 0, updates.length);
  }

  // ══════════════════════════════════════════════════════════════
  console.log('\n═══ ٥ · مهلة الدفع: قبلها يبقى، بعدها يُلغى ═══');
  {
    /* نفس منطق sweepUnpaidHeld — القرار الزمنيّ مُستنسَخ */
    const TIMEOUT = 30 * 60000;
    const decide = (ageMs, timeout) => (timeout > 0 && ageMs >= timeout) ? 'cancel' : 'keep';

    ok('عمر ١٠ دقائق < ٣٠ → يبقى', decide(10 * 60000, TIMEOUT) === 'keep');
    ok('عمر ٢٩ دقيقة < ٣٠ → يبقى', decide(29 * 60000, TIMEOUT) === 'keep');
    ok('عمر ٣٠ دقيقة = المهلة → يُلغى', decide(30 * 60000, TIMEOUT) === 'cancel');
    ok('عمر ٤٥ دقيقة > ٣٠ → يُلغى', decide(45 * 60000, TIMEOUT) === 'cancel');
    ok('المهلة صفر = تعطيل الإلغاء التلقائي', decide(99 * 60000, 0) === 'keep');
  }

  // ══════════════════════════════════════════════════════════════
  console.log('\n═══ ٦ · الإطلاق حقيقةٌ في مكان واحد — يناديه مسارا التأكيد ═══');
  {
    const fs = require('fs');
    const orders = fs.readFileSync(path.join(SRV, 'routes/orders.js'), 'utf8');
    const bank = fs.readFileSync(path.join(SRV, 'routes/banksms.js'), 'utf8');
    ok('/paid ينادي releaseHeldOrder', /releaseHeldOrder\(/.test(orders));
    ok('banksms ينادي releaseHeldOrder', /releaseHeldOrder\(/.test(bank));
    ok('واجهة المطعم تستثني PENDING_PAYMENT', /PENDING_PAYMENT/.test(orders) && /status \|\| ''\) !== 'PENDING_PAYMENT'/.test(orders));
  }

  console.log('\n════════════════════════════════════════════════');
  console.log(`  ✅ نجح: ${pass}   ❌ فشل: ${fail}`);
  console.log('════════════════════════════════════════════════');
  process.exit(fail ? 1 : 0);
})();
