/* اختبار حراسات الحذف بقاعدة بيانات وهمية وexpress وهمي.
 *
 * لا نختبر أن الحذف يعمل — نختبر أن **الرفض** يعمل. فالفشل في هذا
 * الاتجاه هو وحده الذي يُفقد بيانات.
 *
 * ولا نُثبّت express: نحقن بديلاً في `require.cache` يلتقط المسارات
 * المسجَّلة، فنستدعيها مباشرة. الاختبار يفحص كودك لا شبكتك.
 */
const Module = require('module');
const SRC = require('path').join(__dirname, '..');

// ---------- express وهمي ----------
const routes = { get: {}, post: {} };
const fakeRouter = {
  get: (p, ...h) => { routes.get[p] = h[h.length - 1]; },
  post: (p, ...h) => { routes.post[p] = h[h.length - 1]; },
  use: () => {},
  delete: (p, ...h) => { routes.del = routes.del || {}; routes.del[p] = h[h.length - 1]; },
  put: () => {}, patch: () => {},
};
const fakeExpress = () => ({ use: () => {}, set: () => {}, get: () => {} });
fakeExpress.Router = () => fakeRouter;
fakeExpress.json = () => (req, res, next) => next();

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) {
  if (req === 'express') return 'FAKE_EXPRESS';
  return origResolve.call(this, req, ...a);
};
require.cache['FAKE_EXPRESS'] = { id: 'FAKE_EXPRESS', exports: fakeExpress, loaded: true };

require(SRC + '/routes/partners.js');   // يسجّل مساراته في fakeRouter

// ---------- Firestore وهمي ----------
function makeDb(seed) {
  const store = JSON.parse(JSON.stringify(seed));
  const collection = (name) => {
    if (!store[name]) store[name] = {};
    const data = store[name];
    const copy = (x) => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
    // Firestore يُرجع كائناً جديداً في كل نداء لـ data() — لا مرجعاً حيّاً.
    // المحاكي الذي يُرجع المرجع يُظهر تغييراتٍ لاحقة داخل لقطةٍ قديمة.
    const asDocs = () => Object.entries(data).map(([id, d]) => ({ id, exists: true, data: () => copy(d) }));
    const mk = (pred) => ({
      get: async () => {
        const list = asDocs().filter(pred);
        return { size: list.length, empty: !list.length, docs: list, forEach: f => list.forEach(f) };
      },
      where: (f, op, v) => mk(d => pred(d) && cmp(d.data()[f], op, v)),
      limit: () => mk(pred),
    });
    return {
      get: mk(() => true).get,
      where: (f, op, v) => mk(d => cmp(d.data()[f], op, v)),
      doc: (id) => ({
        get: async () => ({ id, exists: Object.prototype.hasOwnProperty.call(data, id), data: () => copy(data[id]) }),
        set: async (v) => { data[id] = v; },
        update: async (v) => {
          if (!data[id]) throw new Error('لا وثيقة');
          Object.assign(data[id], v);
        },
        delete: async () => { delete data[id]; },
      }),
    };
  };
  return { collection, _store: store };
}
const cmp = (val, op, v) => op === '==' ? val === v : op === 'in' ? v.includes(val) : false;

// ---------- استدعاء مسار ----------
async function call(method, routePath, db, params, body) {
  const handler = routes[method][routePath];
  if (!handler) throw new Error('مسار غير مسجّل: ' + routePath);
  const app = { get: (k) => k === 'db' ? db : null };
  const req = { app, params: params || {}, body: body || {}, query: {} };
  let out = { status: 200, body: null };
  const res = {
    status(c) { out.status = c; return this; },
    json(j) { out.body = j; return this; },
  };
  await handler(req, res);
  return out;
}

// ---------- الفحوص ----------
let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  console.log((cond ? '  ✅ ' : '  ⛔ ') + name + (cond ? '' : '\n       ← ' + detail));
  cond ? pass++ : fail++;
};
const DEL = '/registered_partners/:id/delete';
const CHK = '/registered_partners/:id/deletable';

(async () => {
  console.log('\n═══ ١ · حسابٌ وحيدٌ غير مكرَّر ═══');
  {
    const db = makeDb({ users: { A: { phone: '0599111111', name: 'وحيد' } } });
    const r = await call('post', DEL, db, { id: 'A' }, { confirm: '1111' });
    check('يُرفض', r.status === 409, r.status + ' ' + JSON.stringify(r.body));
    check('الوثيقة باقية', !!db._store.users.A, 'حُذفت!');
  }

  console.log('\n═══ ٢ · حسابان بقيمة هاتف "-" لا يُعدّان تكراراً ═══');
  {
    const db = makeDb({ users: { A: { phone: '-', name: 'أ' }, B: { phone: '-', name: 'ب' } } });
    const r = await call('post', DEL, db, { id: 'A' }, { confirm: '' });
    check('يُرفض (رقم غير صالح)', r.status >= 400, r.status + ' ' + JSON.stringify(r.body));
    check('الوثيقة باقية', !!db._store.users.A, 'حُذفت!');
  }

  console.log('\n═══ ٣ · مكرَّر لكن عليه طلبٌ حيّ — بكل صيغة تخزين ═══');
  const LIVE = { status: 'PICKED_UP' };
  const forms = [
    ['driverId مباشر',        { driverId: 'A', ...LIVE }],
    ['driver.id',             { driver: { id: 'A' }, ...LIVE }],
    ['driver.phone وحده',     { driver: { phone: '0599222222', name: 'س' }, ...LIVE }],
    ['بلا حقل status أصلاً',  { driverId: 'A' }],
    ['حالة لم نعرفها بعد',    { driverId: 'A', status: 'WAITING_AT_GATE' }],
    ['customerId',            { customerId: 'A', ...LIVE }],
    ['customerPhone وحده',    { customerPhone: '+970599222222', ...LIVE }],
  ];
  for (const [why, order] of forms) {
    const db = makeDb({
      users: { A: { phone: '0599222222', name: 'أ' }, B: { phone: '+970599222222', name: 'ب' } },
      orders: { o1: order },
    });
    const r = await call('post', DEL, db, { id: 'A' }, { confirm: '2222' });
    check(why, r.status === 409 && !!db._store.users.A,
      r.status + ' | باقٍ=' + !!db._store.users.A + ' | ' + ((r.body || {}).error || ''));
  }

  console.log('\n═══ ٤ · مكرَّر ونظيف لكن عليه دَين ═══');
  {
    const db = makeDb({
      users: { A: { phone: '0599333333', name: 'أ' }, B: { phone: '0599333333', name: 'ب' } },
      orders: { o1: { status: 'DELIVERED', driverId: 'A', total: 100, deliveryFee: 15 } },
    });
    const r = await call('post', DEL, db, { id: 'A' }, { confirm: '3333' });
    /* الدَّين = العمولتان (١٠٪ من المئة + ١٠٪ من الخمسة عشر) = ١١٫٥
     * لا «الثمن ناقص الأجرة» = ٨٥. الأخيرة ما يدفعه للمطعم نقداً، لا
     * ما يورده لك — وكان هذا خطأً في الكود صار خطأً في الاختبار بعد
     * إصلاحه. */
    check('يُرفض (١١٫٥ ₪ غير مسوّاة)', r.status === 409 && !!db._store.users.A,
      r.status + ' | ' + ((r.body || {}).error || ''));
    check('الرسالة تذكر ١١٫٥ لا ٨٥', /11\.5/.test(((r.body || {}).error || '')), (r.body || {}).error);
  }

  console.log('\n═══ ٥ · تأكيدٌ خاطئ ═══');
  {
    const db = makeDb({ users: { A: { phone: '0599444444', name: 'أ' }, B: { phone: '0599444444', name: 'ب' } } });
    const r1 = await call('post', DEL, db, { id: 'A' }, { confirm: '0000' });
    check('رقم خاطئ يُرفض', r1.status === 400 && !!db._store.users.A, r1.status);
    const r2 = await call('post', DEL, db, { id: 'A' }, {});
    check('بلا تأكيد يُرفض', r2.status === 400 && !!db._store.users.A, r2.status);
    const r3 = await call('post', DEL, db, { id: 'A' }, { confirm: 'A' });
    check('آخر المعرّف لا يُقبل بدل الرقم', r3.status === 400 && !!db._store.users.A, r3.status);
  }

  console.log('\n═══ ٦ · الحالة المسموحة: مكرَّر · بلا طلب حيّ · بلا دَين ═══');
  {
    const db = makeDb({
      users: {
        A: { phone: '0599555555', name: 'أ', fcmDevices: [{ app: 'captain' }], worksAsDriver: true },
        B: { phone: '0599555555', name: 'ب' },
      },
      orders: { o1: { status: 'DELIVERED', driverId: 'A', total: 100, deliveryFee: 100 } },
      /* عمولة الطلب: ١٠ من الوجبة + ١٠ من التوصيل = ٢٠. فلكي يكون
       * الحساب نظيفاً يجب أن يكون قد سدّدها — وهذا هو الواقع الذي
       * يُحذف فيه حسابٌ فعلاً: بعد التسوية لا قبلها. */
      settlements: { s1: { driverId: 'A', amount: 20, direction: 'in' } },
    });
    const r = await call('post', DEL, db, { id: 'A' }, { confirm: '5555' });
    check('يُقبل', r.status === 200 && r.body.success, r.status + ' ' + JSON.stringify(r.body));
    check('الوثيقة حُذفت', !db._store.users.A, 'باقية');
    check('الشبيه B سليم', !!db._store.users.B, 'ضاع!');
    const arch = (db._store.deleted_users || {}).A;
    check('أُرشف في deleted_users', !!arch, 'لا أرشيف');
    check('الأرشيف يحمل الأجهزة (قُرئ قبل الإطفاء)',
      !!arch && Array.isArray(arch.fcmDevices) && arch.fcmDevices.length === 1,
      'fcmDevices=' + JSON.stringify(arch && arch.fcmDevices));
    check('الأرشيف يحمل worksAsDriver=true',
      !!arch && arch.worksAsDriver === true, 'worksAsDriver=' + (arch && arch.worksAsDriver));
  }

  console.log('\n═══ ٧ · /deletable يوافق التنفيذ ويُحذّر ═══');
  {
    const db = makeDb({
      users: {
        A: { phone: '0599666666', name: 'أ', ownedRestaurantId: 'mkt_1', cashOnHand: 264.4 },
        B: { phone: '0599666666', name: 'ب' },
      },
      restaurants: { mkt_1: { isOpen: true } },
    });
    const r = await call('get', CHK, db, { id: 'A' });
    const w = ((r.body || {}).warnings || []).join(' | ');
    check('canDelete = true', r.body.canDelete === true, JSON.stringify(r.body.blockers));
    check('يُحذّر من المحلّ', /mkt_1/.test(w), w);
    check('يُحذّر من الكاش ٢٦٤', /264/.test(w), w);
    check('التلميح من الرقم لا المعرّف', r.body.confirmHint === '6666', r.body.confirmHint);
  }

  console.log('\n═══ ٨ · صاحب محلّ: المحلّ يُغلق مع الحذف لا يبقى يتيماً ═══');
  {
    const db = makeDb({
      users: {
        A: { phone: '0599777777', name: 'أ', ownedRestaurantId: 'mkt_9' },
        B: { phone: '0599777777', name: 'ب' },
      },
      restaurants: { mkt_9: { isOpen: true, isActive: true, status: 'approved' } },
    });
    const r = await call('post', DEL, db, { id: 'A' }, { confirm: '7777' });
    const shop = db._store.restaurants.mkt_9;
    check('الحذف تمّ', r.status === 200, r.status + ' ' + JSON.stringify(r.body));
    check('المحلّ أُغلق', shop && shop.isOpen === false, JSON.stringify(shop));
    check('المحلّ عُطّل', shop && shop.isActive === false, JSON.stringify(shop));
    check('المحلّ لم يُمحَ (السجلّ باقٍ)', !!shop, 'مُحي!');
    check('الردّ يُخبر بإغلاق المحلّ', r.body.closedShop === 'mkt_9', r.body.closedShop);
  }

  console.log('\n' + (fail === 0 ? '🟢' : '🔴') + `  ${pass} نجحت · ${fail} فشلت\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('💥', e); process.exit(1); });
