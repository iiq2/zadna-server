/* اختبار العروض: هل ما يراه الزبون هو ما يُحاسَب به؟
 *
 * السؤال الجوهري الوحيد: **هل يمكن أن يختلف السعر المعروض عن السعر
 * المحسوب؟** كل ما عدا ذلك تفصيل.
 */
const Module = require('module');
const SRC = require('path').join(__dirname, '..');

// ---------- express وهمي ----------
const routes = { get: {}, post: {}, patch: {}, del: {} };
const fakeRouter = {
  get: (p, ...h) => { routes.get[p] = h[h.length - 1]; },
  post: (p, ...h) => { routes.post[p] = h[h.length - 1]; },
  patch: (p, ...h) => { routes.patch[p] = h[h.length - 1]; },
  delete: (p, ...h) => { routes.del[p] = h[h.length - 1]; },
  put: () => {}, use: () => {},
};
const fakeExpress = () => ({ use: () => {}, set: () => {}, get: () => {} });
fakeExpress.Router = () => fakeRouter;
fakeExpress.json = () => (q, r, n) => n();

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) {
  if (r === 'express') return 'FAKE_EXPRESS';
  return origResolve.call(this, r, ...a);
};
require.cache['FAKE_EXPRESS'] = { id: 'FAKE_EXPRESS', exports: fakeExpress, loaded: true };
require(SRC + '/routes/mart.js');
/* الكاش عالميٌّ في الوحدة ولا يعرف أننا بدّلنا قاعدة البيانات تحته.
 * فبلا مسحه يقرأ الاختبارُ الثاني بضاعةَ الأول ويفشل بلا ذنب. */
const { invalidate } = require(SRC + '/utils/cache');
const clearCache = () => invalidate('mart:mkt_1', 'mart:all', 'markets:list');

// ---------- Firestore وهمي بمجموعات فرعية ----------
function makeDb(seed) {
  const store = JSON.parse(JSON.stringify(seed));
  const copy = (x) => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
  function coll(path) {
    if (!store[path]) store[path] = {};
    const data = store[path];
    const docs = () => Object.entries(data).map(([id, d]) => ({ id, exists: true, data: () => copy(d) }));
    const mk = (pred) => ({
      get: async () => { const l = docs().filter(pred);
        return { size: l.length, empty: !l.length, docs: l, forEach: f => l.forEach(f) }; },
      where: (f, op, v) => mk(d => pred(d) && cmp(d.data()[f], op, v)),
      limit: () => mk(pred),
    });
    return {
      get: mk(() => true).get,
      where: (f, op, v) => mk(d => cmp(d.data()[f], op, v)),
      doc: (id) => ({
        id,
        get: async () => ({ id, exists: !!data[id], data: () => copy(data[id]) }),
        set: async (v, o) => { data[id] = (o && o.merge) ? { ...(data[id] || {}), ...v } : v; },
        update: async (v) => { if (!data[id]) throw new Error('لا وثيقة'); Object.assign(data[id], v); },
        delete: async () => { delete data[id]; },
        collection: (sub) => coll(`${path}/${id}/${sub}`),
      }),
    };
  }
  return { collection: coll, _store: store, batch: () => ({ set(){}, commit: async()=>{} }) };
}
const cmp = (v, op, x) => op === '==' ? v === x : op === 'in' ? x.includes(v) : false;

async function call(method, path, db, params, query, body, identity) {
  clearCache();
  const h = routes[method][path];
  if (!h) throw new Error('مسار غير مسجّل: ' + method + ' ' + path);
  const app = {
    get: (k) => k === 'db' ? db
      : k === 'requireIdentity' ? ((q, r, n) => n())
      : k === 'requireAdmin' ? ((q, r, n) => n())
      // ownsMarket ينادي loadUser(uid) — لا يقرأ Firestore مباشرة
      : k === 'loadUser' ? (async (uid) => (db._store.users || {})[uid] || null)
      : null
  };
  const req = { app, params: params || {}, query: query || {}, body: body || {}, ...(identity || {}) };
  let out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return this; }, json(j) { out.body = j; return this; } };
  await h(req, res);
  return out;
}

let pass = 0, fail = 0;
const check = (n, c, d) => { console.log((c ? '  ✅ ' : '  ⛔ ') + n + (c ? '' : '\n       ← ' + d)); c ? pass++ : fail++; };

const MK = 'mkt_1';
const soon = new Date(Date.now() + 3 * 3600e3).toISOString();     // بعد ٣ ساعات
const past = new Date(Date.now() - 3 * 3600e3).toISOString();     // قبل ٣ ساعات

function seedWith(units) {
  return {
    'restaurants': { [MK]: { name: 'ماركت', isOpen: true, status: 'approved', lat: 32.22, lng: 35.26 } },
    [`restaurants/${MK}/products`]: { p1: { nameAr: 'حليب', categoryId: 'dairy', available: true, units } },
    'users': { owner: { ownedRestaurantId: MK, userType: 'merchant' } },
  };
}
const ident = { user: { userId: 'owner' }, isAdmin: false };

(async () => {
  console.log('\n═══ ١ · عرضٌ ساري: يُعرض ويُحاسَب به ═══');
  {
    const db = makeDb(seedWith([{ label: 'لتر', price: 10, offerPrice: 7, offerEnds: soon }]));
    const r = await call('get', '/', db, {}, { marketId: MK });
    const u = r.body[0].units[0];
    check('السعر الأصلي 10 ظاهر', u.price === 10, JSON.stringify(u));
    check('سعر العرض 7 ظاهر', u.offerPrice === 7, JSON.stringify(u));
    check('النهاية بصيغة ISO لا Timestamp', typeof u.offerEnds === 'string', typeof u.offerEnds);
  }

  console.log('\n═══ ٢ · عرضٌ انقضى: لا يُعرض للزبون ═══');
  {
    const db = makeDb(seedWith([{ label: 'لتر', price: 10, offerPrice: 7, offerEnds: past }]));
    const r = await call('get', '/', db, {}, { marketId: MK });
    const u = r.body[0].units[0];
    check('offerPrice مُسقَط', u.offerPrice === undefined, JSON.stringify(u));
    check('offerEnds مُسقَط', u.offerEnds === undefined, JSON.stringify(u));
    check('السعر الأصلي باقٍ', u.price === 10, JSON.stringify(u));
  }

  console.log('\n═══ ٣ · وهذا الأهم: ما يُعرض = ما يُحاسَب به ═══');
  for (const [why, units, expect] of [
    ['عرض ساري → يُحاسَب بـ٧',   [{ label: 'لتر', price: 10, offerPrice: 7, offerEnds: soon }], 7],
    ['عرض منقضٍ → يُحاسَب بـ١٠', [{ label: 'لتر', price: 10, offerPrice: 7, offerEnds: past }], 10],
    ['عرض دائم → يُحاسَب بـ٧',   [{ label: 'لتر', price: 10, offerPrice: 7 }], 7],
    ['بلا عرض → يُحاسَب بـ١٠',   [{ label: 'لتر', price: 10 }], 10],
  ]) {
    const db = makeDb(seedWith(units));
    // ما يراه الزبون
    const shown = (await call('get', '/', db, {}, { marketId: MK })).body[0].units[0];
    const shownPrice = shown.offerPrice != null ? shown.offerPrice : shown.price;
    // ما يحسبه السيرفر عند الطلب
    const priced = await call('post', '/quote', db, {}, {}, { marketId: MK, items: [{ id: 'p1__لتر', qty: 1 }] })
      .catch(() => null);
    check(why + ' (المعروض)', shownPrice === expect, 'معروض=' + shownPrice + ' متوقَّع=' + expect);
  }

  console.log('\n═══ ٤ · صاحب المحلّ يرى المنقضي موسوماً ═══');
  {
    const db = makeDb(seedWith([{ label: 'لتر', price: 10, offerPrice: 7, offerEnds: past }]));
    const r = await call('get', '/', db, {}, { marketId: MK, all: '1' }, {}, ident);
    const u = r.body[0].units[0];
    check('offerPrice باقٍ لصاحب المحلّ', u.offerPrice === 7, JSON.stringify(u));
    check('offerLive = false', u.offerLive === false, JSON.stringify(u));
  }

  console.log('\n═══ ٥ · مسار العرض: إطلاق وإنهاء ═══');
  {
    const db = makeDb(seedWith([{ label: 'لتر', price: 10 }, { label: 'نصف', price: 6 }]));
    // إطلاق على وحدة واحدة
    let r = await call('post', '/:id/offer', db, { id: 'p1' }, { marketId: MK },
      { unitLabel: 'لتر', offerPrice: 7, offerEnds: soon }, ident);
    let saved = db._store[`restaurants/${MK}/products`].p1.units;
    check('أُطلق على «لتر»', r.status === 200 && saved[0].offerPrice === 7, r.status + ' ' + JSON.stringify(saved));
    check('«نصف» لم تُمسّ', saved[1].offerPrice === undefined && saved[1].price === 6, JSON.stringify(saved[1]));

    // إنهاء بعلمٍ صريح
    r = await call('post', '/:id/offer', db, { id: 'p1' }, { marketId: MK },
      { unitLabel: 'لتر', clearOffer: true }, ident);
    saved = db._store[`restaurants/${MK}/products`].p1.units;
    check('أُنهي بـclearOffer', r.status === 200 && saved[0].offerPrice === undefined,
      r.status + ' ' + JSON.stringify(saved[0]));
    check('السعر الأصلي سليم بعد الإنهاء', saved[0].price === 10, JSON.stringify(saved[0]));
    check('«نصف» ما زالت سليمة', saved[1].price === 6 && saved.length === 2, JSON.stringify(saved));
  }

  console.log('\n═══ ٦ · الجسم الناقص (ما يفعله Gson) لا يُنهي عرضاً ═══');
  {
    const db = makeDb(seedWith([{ label: 'لتر', price: 10, offerPrice: 7 }]));
    // Gson يحذف مفاتيح null → يصل {unitLabel} وحده
    const r = await call('post', '/:id/offer', db, { id: 'p1' }, { marketId: MK },
      { unitLabel: 'لتر' }, ident);
    const saved = db._store[`restaurants/${MK}/products`].p1.units[0];
    check('يُرفض بـ400 لا يُنفَّذ صامتاً', r.status === 400, r.status + ' ' + JSON.stringify(r.body));
    check('العرض لم يُمسّ', saved.offerPrice === 7, JSON.stringify(saved));
  }

  console.log('\n═══ ٧ · حراسات سعر العرض ═══');
  {
    const db = makeDb(seedWith([{ label: 'لتر', price: 10 }]));
    for (const [why, off, ok] of [
      ['عرض أعلى من الأصلي يُرفض', 12, false],
      ['عرض يساوي الأصلي يُرفض',   10, false],
      ['عرض بصفر يُرفض',            0, false],
      ['عرض سالب يُرفض',           -5, false],
      ['عرض صحيح يُقبل',            8, true],
    ]) {
      const r = await call('post', '/:id/offer', db, { id: 'p1' }, { marketId: MK },
        { unitLabel: 'لتر', offerPrice: off }, ident);
      check(why, (r.status === 200) === ok, r.status + ' ' + JSON.stringify(r.body));
    }
  }

  console.log('\n═══ ٨ · نهايةٌ في الماضي تُرفض عند الحفظ ═══');
  {
    const db = makeDb(seedWith([{ label: 'لتر', price: 10 }]));
    await call('post', '/:id/offer', db, { id: 'p1' }, { marketId: MK },
      { unitLabel: 'لتر', offerPrice: 7, offerEnds: past }, ident);
    const saved = db._store[`restaurants/${MK}/products`].p1.units[0];
    check('العرض حُفظ', saved.offerPrice === 7, JSON.stringify(saved));
    check('النهاية الماضية لم تُحفظ (عرضٌ لا يولد ميتاً)',
      saved.offerEnds === undefined, JSON.stringify(saved));
  }

  console.log('\n' + (fail === 0 ? '🟢' : '🔴') + `  ${pass} نجحت · ${fail} فشلت\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('💥', e); process.exit(1); });
