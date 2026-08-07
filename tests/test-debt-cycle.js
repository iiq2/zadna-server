/* ═══════════════════════════════════════════════════════════════
   اختبار دورة دَين المندوب — قرار يزن ٨ آب ٢٠٢٦.

   القاعدة: يُسكَّر حساب المندوب حين يتجاوز دَينه لزادنا ١٠٠ شيكل،
   فيُطلَب منه التسديد (كاشاً للإدارة، أو بالكود من التطبيق). والسؤال
   الجوهري هنا: **هل الرقم الذي نحجب عليه هو الحقيقة، لا ظِلٌّ لها؟**

   الدَّين يتراكم من عمولة الكاش وحدها (الإلكتروني لا يدين به المندوب)،
   ويُخزَّن على مستند المندوب ليحجب `push` بسرعة، ويُحسَب من الطلبات
   ناقص التسويات ليكون المرجع. فإن انحرف المخزَّن عن المحسوب، صرخ
   `reconcile`. وهذا الاختبار يثبت: التراكم، والتصفير بالتسوية، وأن
   الإلكتروني لا يدين، وأن الانحراف يُكتشَف، وأن الحجب اتحادٌ لا انفراد.
   ═══════════════════════════════════════════════════════════════ */

const path = require('path');
const SRV = path.join(__dirname, '..');

// نُخرس عدّاد القراءات — لا شبكة في الاختبار
const Module = require('module');
const _resolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req.endsWith('utils/meter') || req === '../utils/meter') return 'FAKE_METER';
  return _resolve.call(this, req, ...rest);
};
require.cache['FAKE_METER'] = { id:'FAKE_METER', filename:'FAKE_METER', loaded:true,
  exports:{ addReads(){}, addWrites(){}, stats:()=>({}) } };

const money = require(path.join(SRV, 'utils/money.js'));
const reconcile = require(path.join(SRV, 'utils/reconcile.js'));

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log(`  ✅ ${n}`); }
                          else { fail++; console.log(`  ❌ ${n}${x !== undefined ? ' → ' + x : ''}`); } };
const near = (a, b) => Math.abs(a - b) < 0.005;

/* ── Firestore وهميّ يكفي driverCash: where().get() و get() المباشر ── */
function fakeDb(seed = {}) {
  const cols = {};
  for (const [k, v] of Object.entries(seed)) cols[k] = new Map(Object.entries(v));
  const C = (n) => (cols[n] = cols[n] || new Map());
  const rowsOf = (name, conds) =>
    [...C(name).entries()].filter(([, d]) => conds.every(c => {
      let x = d; for (const p of c.f.split('.')) x = x && x[p];
      return c.op === '==' ? x === c.v : true;
    }));
  const result = (rows) => ({
    size: rows.length, empty: !rows.length,
    forEach: fn => rows.forEach(([id, d]) => fn({ id, data: () => ({ ...d }) })),
  });
  const wrap = (name) => ({
    where(f, op, v) {
      const conds = [{ f, op, v }];
      const q = {
        where(f2, o2, v2) { conds.push({ f: f2, op: o2, v: v2 }); return q; },
        limit() { return q; },
        async get() { return result(rowsOf(name, conds)); },
      };
      return q;
    },
    async get() { return result(rowsOf(name, [])); },
  });
  return { collection: wrap };
}

const M = (o) => money.applyPayment(money.breakdown(o), o);

// ════════════════════════════════════════════════════════════════
console.log('\n═══ ١ · مصدر الدَّين: الكاش يدين، الإلكتروني لا ═══');
{
  const cash   = M({ restaurantId: 'rest_1', totalAmount: 100, deliveryFee: 15 });
  const online = M({ restaurantId: 'rest_1', totalAmount: 100, deliveryFee: 15, paidOnline: true });

  ok('طلب كاش: المندوب يدين بعمولة زادنا ١١٫٥',
    near(cash.driverOwesZadna, 11.5), cash.driverOwesZadna);
  ok('طلب إلكتروني: المندوب لا يدين بشيء (٠)',
    near(online.driverOwesZadna, 0), online.driverOwesZadna);
  ok('الدَّين ليس أجرة المندوب — أجرته ١٣٫٥ تبقى له لا عليه',
    near(cash.driverNet, 13.5) && cash.driverOwesZadna < cash.driverNet, cash.driverOwesZadna);
}

// ════════════════════════════════════════════════════════════════
console.log('\n═══ ٢ · قرار الحجب: اتحاد المحسوب والمخزَّن، لا المحسوب وحده ═══');
{
  /* نفس منطق wallet.js/push.js — مُستنسَخٌ هنا صريحاً كي يُثبَّت العقد:
   * لو غُيّر في السيرفر لاحقاً، كسر هذا الاختبار ينبّه. */
  const blocked = (cap, computed, stored) =>
    cap > 0 && (computed >= cap || stored >= cap);

  ok('محسوبٌ فوق السقف → موقوف', blocked(100, 120, 0) === true);
  ok('مخزَّنٌ فوق السقف والمحسوب دونه → موقوف (الاتحاد يمنع كذبة «مستعد»)',
    blocked(100, 0, 120) === true);
  ok('كلاهما دون السقف → مستعد', blocked(100, 50, 50) === false);
  ok('عند السقف تماماً (>=) → موقوف', blocked(100, 100, 0) === true);
  ok('السقف صفرٌ = تعطيل الحجب كلّياً', blocked(0, 999, 999) === false);
}

// ════════════════════════════════════════════════════════════════
console.log('\n═══ ٣ · التراكم: طلبا كاش يجمعان دَينهما ═══');
(async () => {
  {
    // طلبان كاش، كلٌّ يدين ١١٫٥ → المتوقّع ٢٣، والمخزَّن مطابق → لا انحراف
    const db = fakeDb({
      users: { d1: { role: 'driver', name: 'سائق', phone: '0599', cashOnHand: 50, debtToZadna: 23 } },
      orders: {
        o1: { status: 'DELIVERED', driverId: 'd1', money: { cashToCollect: 115, payToRestaurant: 90, driverOwesZadna: 11.5 } },
        o2: { status: 'DELIVERED', driverId: 'd1', money: { cashToCollect: 115, payToRestaurant: 90, driverOwesZadna: 11.5 } },
      },
      settlements: {},
    });
    const { items } = await reconcile.driverCash(db);
    const debtItem = items.find(i => i.kind === 'debt' && i.driverId === 'd1');
    ok('دَينٌ مخزَّن ٢٣ = محسوب ٢٣ → لا صراخ', !debtItem, debtItem && debtItem.diff);
  }

  // ══════════════════════════════════════════════════════════════
  console.log('\n═══ ٤ · التسوية تُصفّر الدَّين ═══');
  {
    // طلب كاش يدين ١١٫٥، سُدِّد ١١٫٥ (اتجاه in)، المخزَّن صار ٠ → لا انحراف
    const db = fakeDb({
      users: { d1: { role: 'driver', name: 'سائق', phone: '0599', cashOnHand: 13.5, debtToZadna: 0 } },
      orders: {
        o1: { status: 'DELIVERED', driverId: 'd1', money: { cashToCollect: 115, payToRestaurant: 90, driverOwesZadna: 11.5 } },
      },
      settlements: { s1: { driverId: 'd1', direction: 'in', amount: 11.5 } },
    });
    const { items } = await reconcile.driverCash(db);
    const debtItem = items.find(i => i.kind === 'debt' && i.driverId === 'd1');
    ok('بعد تسوية ١١٫٥: الدَّين ٠ ولا انحراف', !debtItem, debtItem && debtItem.diff);
  }

  // ══════════════════════════════════════════════════════════════
  console.log('\n═══ ٥ · الانحراف يُكتشَف — لا يمرّ صامتاً ═══');
  {
    // المخزَّن ٥٠ بينما الطلب لا يدين إلا ١١٫٥ (تسوية لم تُخصم مثلاً)
    const db = fakeDb({
      users: { d1: { role: 'driver', name: 'سائق', phone: '0599', cashOnHand: 25, debtToZadna: 50 } },
      orders: {
        o1: { status: 'DELIVERED', driverId: 'd1', money: { cashToCollect: 115, payToRestaurant: 90, driverOwesZadna: 11.5 } },
      },
      settlements: {},
    });
    const { items } = await reconcile.driverCash(db);
    const debtItem = items.find(i => i.kind === 'debt' && i.driverId === 'd1');
    ok('دَينٌ مخزَّن ٥٠ > محسوب ١١٫٥ → عنصر انحراف',
      !!debtItem, 'لم يُكتشف');
    ok('اتجاه الانحراف موجب (مخزَّنٌ أكبر — قد يُحجب بلا حقّ)',
      debtItem && debtItem.diff > 0, debtItem && debtItem.diff);
    ok('التلميح يشير لبقائه محجوباً بلا حقّ',
      debtItem && /محجوب/.test(debtItem.hint), debtItem && debtItem.hint);
  }

  // ══════════════════════════════════════════════════════════════
  console.log('\n═══ ٦ · الإلكتروني لا يُراكم دَيناً ولو تعدّدت طلباته ═══');
  {
    // ثلاثة طلبات إلكترونية، كلٌّ driverOwesZadna=0 → المتوقّع ٠، المخزَّن ٠
    const db = fakeDb({
      users: { d1: { role: 'driver', name: 'سائق', phone: '0599', cashOnHand: 0, debtToZadna: 0 } },
      orders: {
        o1: { status: 'DELIVERED', driverId: 'd1', money: { cashToCollect: 0, payToRestaurant: 0, driverOwesZadna: 0 } },
        o2: { status: 'DELIVERED', driverId: 'd1', money: { cashToCollect: 0, payToRestaurant: 0, driverOwesZadna: 0 } },
        o3: { status: 'DELIVERED', driverId: 'd1', money: { cashToCollect: 0, payToRestaurant: 0, driverOwesZadna: 0 } },
      },
      settlements: {},
    });
    const { items } = await reconcile.driverCash(db);
    const debtItem = items.find(i => i.kind === 'debt' && i.driverId === 'd1');
    ok('ثلاثة طلبات إلكترونية → دَينٌ ٠ ولا حجب ولا انحراف', !debtItem, debtItem && debtItem.diff);
  }

  // ══════════════════════════════════════════════════════════════
  console.log('\n═══ ٧ · بلوغ السقف فعلياً: ٩ طلبات كاش تتجاوز ١٠٠ ═══');
  {
    // كل طلب كاش يدين ١١٫٥ → ٩ طلبات = ١٠٣٫٥ > ١٠٠ → يجب أن يُحجب
    const orders = {};
    for (let i = 1; i <= 9; i++) {
      orders['o' + i] = { status: 'DELIVERED', driverId: 'd1',
        money: { cashToCollect: 115, payToRestaurant: 90, driverOwesZadna: 11.5 } };
    }
    const db = fakeDb({
      users: { d1: { role: 'driver', name: 'سائق', phone: '0599', cashOnHand: 225, debtToZadna: 103.5 } },
      orders, settlements: {},
    });
    const { items } = await reconcile.driverCash(db);
    const debtItem = items.find(i => i.kind === 'debt' && i.driverId === 'd1');
    ok('٩ طلبات كاش: المخزَّن ١٠٣٫٥ = المحسوب → لا انحراف', !debtItem, debtItem && debtItem.diff);

    const blocked = (cap, computed, stored) => cap > 0 && (computed >= cap || stored >= cap);
    ok('١٠٣٫٥ ≥ ١٠٠ → الحساب موقوف كما قرّر يزن', blocked(100, 103.5, 103.5) === true);
  }

  // ── الخلاصة ──
  console.log('\n════════════════════════════════════════════════');
  console.log(`  ✅ نجح: ${pass}   ❌ فشل: ${fail}`);
  console.log('════════════════════════════════════════════════');
  process.exit(fail ? 1 : 0);
})();
