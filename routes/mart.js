const express = require('express');
const router = express.Router();
const { MART_CATEGORIES, MART_SUGGESTIONS } = require('../data/martCatalog');
const { cached, invalidate } = require('../utils/cache');
const meter = require('../utils/meter');

/* ============================================================
   زادنا مارت — كتالوج مملوك لكل سوبرماركت.

   ما كان قبل هذا الملف:
     ٤٣٩ صنفاً بأسعارها مكتوبة داخل شيفرة السيرفر، والتعديلات تُحفظ
     في مجموعة عامة واحدة `mart_products/{المنتج}`. ونتيجتها أنّ
     سوبرماركتين لا يستطيعان العمل معاً: من يسعّر حليب الجنيدي
     بثمانية يمحو من سعّره بسبعة. ولا يملك صاحب المحلّ تعديل بضاعته
     أصلاً — كل مسارات الكتابة كانت adminOnly، أي أنّك أنت من يُدخل
     أصناف كل شريك بيدك ويغيّر أسعاره كلما تغيّرت السوق.

   ما صار:
     • المكتبة المشتركة (data/martCatalog.js): ٤٣٩ صنفاً معروفاً في
       السوق الفلسطيني **بلا سعر واحد**. اقتراحات لا فرائض — تُوفّر
       على الشريك الجديد كتابة ألف صنف بيده، ولا تفرض عليه رقماً.
     • كتالوج كل ماركت في مجموعة فرعية خاصة به:
           restaurants/{marketId}/products/{productId}
       فلا يكتب أحد على أحد، وكلٌّ يسعّر بضاعته ويسمّيها كما يشاء.

   ولماذا مجموعة فرعية لا حقل مصفوفة كمنيو المطعم؟
     سقف مستند Firestore ميغابايت واحد. منيو مطعم بعشرين صنفاً يسعه
     بلا مشكلة؛ سوبرماركت حقيقي بآلاف الأصناف يتجاوزه — ويوم يتجاوزه
     يعجز الشريك عن حفظ أي تعديل، ولا يظهر السبب في أي شاشة.

   والماركت شريك في نفس مجموعة restaurants بحقل partnerType='market'،
   فيرث الطلبات والمحفظة والشات والإشعارات والفتح والإغلاق وتوزيع
   المندوب الأقرب — كلها تعمل بلا سطر إضافي.
   ============================================================ */

const getDb = (req) => req.app.get('db');
const needsIdentity = (req, res, next) => {
  const fn = req.app.get('requireIdentity');
  return fn ? fn(req, res, next) : next();
};

const CATALOG_TTL = 300000;   // خمس دقائق — ويُمحى فوراً بعد أي تعديل

/* ===== الصلاحية =====

   صاحب المحلّ سيّد بضاعته. وكون هذا كلّه adminOnly كان وحده كافياً
   لمنع أي سوبرماركت من العمل معك: لا يستطيع تغيير سعر، ولا إخفاء
   صنف نفد، ولا إضافة بضاعة، إلا أن يتصل بك وتفعلها أنت. */
async function ownsMarket(req, marketId) {
  if (req.isAdmin) return true;
  const uid = String((req.user && req.user.userId) || '');
  if (!uid || !marketId) return false;
  const loadUser = req.app.get('loadUser');
  const me = loadUser ? await loadUser(uid) : null;
  if (!me) return false;
  const t = String(me.userType || '');
  if (t === 'manager' || t === 'admin') return true;
  return String(me.ownedRestaurantId || '') === String(marketId);
}

const denied = (res) =>
  res.status(403).json({ success: false, error: 'لا تملك صلاحية تعديل بضاعة هذا المحل' });

/* ===== تنقية المنتج =====

   نكتب حقولاً معلومة فقط، ولا ننشر جسم الطلب كما ورد. من ينشره يسمح
   لأي أحد بحقن حقول لم يتوقّعها. */
const r2 = (n) => Math.round(n * 100) / 100;

/* وحدات البيع — قلب فكرة السوبرماركت.
 *
 * الصنف الواحد يُباع بأكثر من صورة ولكلٍّ سعرها: بندورة كيلو بخمسة،
 * ونص كيلو بثلاثة، وحبة بشيكل. صاحب المحلّ يقرّر أيّها يفتح وبكم،
 * فيعرف الزبون ثمنه قبل أن يطلب — ولا وزن يُعاد حسابه بعد الطلب،
 * ولا مبلغ يتغيّر بعد أن يوافق عليه. */
function cleanUnits(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const u of raw.slice(0, 12)) {
    const label = String((u && u.label) || '').trim().slice(0, 40);
    const price = Number(u && u.price);
    // وحدة بلا سعر صالح لا تُحفظ: لا يجوز أن يرى الزبون خياراً بلا ثمن
    if (!label || seen.has(label)) continue;
    if (!Number.isFinite(price) || price <= 0 || price > 100000) continue;
    seen.add(label);
    const unit = { label, price: r2(price) };
    /* سعر العرض اختياري، ولا يُقبل إن ساوى الأصلي أو زاد عليه —
     * وإلا صار «عرضاً» يرفع الثمن، وهي حيلة يعرفها الناس ويكرهونها،
     * ومن يقع عليها مرّة لا يثق بالتطبيق بعدها. */
    const offer = Number(u && u.offerPrice);
    if (Number.isFinite(offer) && offer > 0 && offer < price) unit.offerPrice = r2(offer);
    out.push(unit);
  }
  return out;
}

function cleanProduct(body) {
  const b = body || {};
  const nameAr = String(b.nameAr || '').trim().slice(0, 120);
  if (!nameAr) return { error: 'اسم الصنف مطلوب' };
  const units = cleanUnits(b.units);
  if (!units.length) return { error: `«${nameAr}»: أضف وحدة بيع واحدة على الأقل بسعرها` };
  return {
    product: {
      nameAr,
      brand:      String(b.brand || '').trim().slice(0, 60),
      categoryId: String(b.categoryId || 'pantry').trim().slice(0, 40),
      emoji:      String(b.emoji || '').trim().slice(0, 8),
      imageUrl:   String(b.imageUrl || '').trim().slice(0, 500),
      units,
      available:  b.available !== false,
      updatedAt:  new Date(),
    }
  };
}

/* ===== القراءة ===== */

// GET /api/mart_products/categories — أقسام المحل
router.get('/categories', (req, res) => res.json(MART_CATEGORIES));

/* GET /api/mart_products/suggestions?q=&categoryId=
   المكتبة المشتركة. يفتحها صاحب المحلّ فيؤشّر ما يحمله ويضع سعره،
   بدل أن يكتب أربعمئة صنف بيده في أول يوم. */
router.get('/suggestions', needsIdentity, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const cat = String(req.query.categoryId || '').trim();
  let list = MART_SUGGESTIONS;
  if (cat) list = list.filter(p => p.categoryId === cat);
  if (q) list = list.filter(p =>
    p.nameAr.toLowerCase().includes(q) || String(p.brand || '').toLowerCase().includes(q));
  res.json(list.slice(0, 300));
});

/* GET /api/mart_products?marketId=xxx[&all=1] — كتالوج محلّ بعينه

   لا نُرجع كل شيء بلا معرّف: كان مارت واحد فكان مقبولاً، وبعشرة
   محلات يصير الردّ آلاف الأصناف مختلطة لا يعرف الزبون من أيّها. */
router.get('/', async (req, res) => {
  try {
    const db = getDb(req);
    const marketId = String(req.query.marketId || '').trim();
    if (!db) return res.json([]);

    /* ============================================================
       الإدارة وحدها ترى الكتالوجات كلها.

       الزبون بلا معرّف محلّ كان يحصل على ٤٠٠ — وهذا صحيح: بعشرة محلات
       يصير الردّ آلاف الأصناف مختلطة لا يعرف من أيّها.

       لكن لوحة المدير تنادي بلا معرّف عمداً، لأن مهمّتها مراقبة الجميع.
       فكانت تحصل على ٤٠٠ ويخرج تبويب الهايبرماركت فارغاً — لا لأن
       الكتالوج فارغ، بل لأن السؤال رُفض. نردّ لها الجميع مع اسم المحلّ
       لكل صنف كي تعرف لمن هو.
       ============================================================ */
    if (!marketId) {
      if (!req.isAdmin) {
        return res.status(400).json({ success: false, error: 'حدّد المحل (marketId)' });
      }
      const list = await cached('mart:all', CATALOG_TTL, async () => {
        const snap = await db.collectionGroup('products').limit(2000).get();
        const out = [];
        snap.forEach(d => {
          // مسار المستند: restaurants/{marketId}/products/{productId}
          const owner = d.ref.parent.parent;
          out.push({ id: d.id, marketId: owner ? owner.id : '', ...d.data() });
        });
        meter.addReads(snap.size, 'كتالوجات المارت — الإدارة');
        return out;
      });
      return res.json(list);
    }

    const list = await cached(`mart:${marketId}`, CATALOG_TTL, async () => {
      const snap = await db.collection('restaurants').doc(marketId).collection('products').get();
      const out = [];
      snap.forEach(d => out.push({ id: d.id, ...d.data() }));
      meter.addReads(snap.size, 'كتالوج المارت');
      return out;
    });

    // الزبون لا يرى ما نفد. وصاحب المحلّ يراه ليُعيده حين يتوفّر.
    const forOwner = String(req.query.all || '') === '1' && await ownsMarket(req, marketId);
    res.json(forOwner ? list : list.filter(p => p.available !== false));
  } catch (e) {
    console.error('❌ كتالوج المارت:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ===== الكتابة — لصاحب المحلّ ===== */

// POST /api/mart_products  { marketId, id?, nameAr, categoryId, units:[{label,price,offerPrice?}] }
router.post('/', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    const b = req.body || {};
    const marketId = String(b.marketId || '').trim();
    if (!db || !marketId) return res.status(400).json({ success: false, error: 'حدّد المحل' });
    if (!(await ownsMarket(req, marketId))) return denied(res);

    const { product, error } = cleanProduct(b);
    if (error) return res.status(400).json({ success: false, error });

    // معرّف الاقتراح إن جاء منه، وإلا معرّف جديد لا يتصادم
    const id = String(b.id || '').trim()
      || `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await db.collection('restaurants').doc(marketId)
      .collection('products').doc(id).set(product, { merge: true });

    invalidate(`mart:${marketId}`);
    res.status(201).json({ success: true, id, product: { id, ...product } });
  } catch (e) {
    console.error('❌ حفظ صنف:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/* POST /api/mart_products/bulk — عدة أصناف دفعة واحدة
   الشريك الجديد يؤشّر عشرين صنفاً من المكتبة؛ لا نُرسل عشرين طلباً. */
router.post('/bulk', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    const b = req.body || {};
    const marketId = String(b.marketId || '').trim();
    const items = Array.isArray(b.items) ? b.items.slice(0, 200) : [];
    if (!db || !marketId) return res.status(400).json({ success: false, error: 'حدّد المحل' });
    if (!(await ownsMarket(req, marketId))) return denied(res);
    if (!items.length) return res.status(400).json({ success: false, error: 'لا أصناف' });

    const col = db.collection('restaurants').doc(marketId).collection('products');
    let batch = db.batch(), n = 0, saved = 0;
    const rejected = [];
    for (const it of items) {
      const { product, error } = cleanProduct(it);
      // لا نُسقط الدفعة كلّها لأجل صنف ناقص — نحفظ الصالح ونُبلغ عن الباقي
      if (error) { rejected.push({ nameAr: (it && it.nameAr) || '', error }); continue; }
      const id = String((it && it.id) || '').trim()
        || `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      batch.set(col.doc(id), product, { merge: true });
      saved++;
      // Firestore يسمح بـ٥٠٠ عملية في الدفعة — نلتزم بحدّ آمن دونها
      if (++n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
    }
    if (n) await batch.commit();

    invalidate(`mart:${marketId}`);
    res.json({ success: true, saved, rejected });
  } catch (e) {
    console.error('❌ حفظ دفعة:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// PATCH /api/mart_products/:id?marketId=xxx — تعديل سعر أو توفّر أو اسم
router.patch('/:id', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    const b = req.body || {};
    const marketId = String(req.query.marketId || b.marketId || '').trim();
    if (!db || !marketId) return res.status(400).json({ success: false, error: 'حدّد المحل' });
    if (!(await ownsMarket(req, marketId))) return denied(res);

    const patch = { updatedAt: new Date() };
    if (b.nameAr     !== undefined) patch.nameAr = String(b.nameAr).trim().slice(0, 120);
    if (b.brand      !== undefined) patch.brand = String(b.brand).trim().slice(0, 60);
    if (b.categoryId !== undefined) patch.categoryId = String(b.categoryId).trim().slice(0, 40);
    if (b.imageUrl   !== undefined) patch.imageUrl = String(b.imageUrl).trim().slice(0, 500);
    if (b.available  !== undefined) patch.available = b.available !== false;
    if (b.units      !== undefined) {
      const units = cleanUnits(b.units);
      if (!units.length) {
        return res.status(400).json({ success: false, error: 'لا يمكن ترك الصنف بلا وحدة بيع مسعّرة' });
      }
      patch.units = units;
    }

    const ref = db.collection('restaurants').doc(marketId)
      .collection('products').doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'الصنف غير موجود' });
    await ref.update(patch);

    invalidate(`mart:${marketId}`);
    res.json({ success: true });
  } catch (e) {
    console.error('❌ تعديل صنف:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/* DELETE /api/mart_products/:id?marketId=xxx

   الحذف هنا محدود ومقصود: صنف من كتالوج محلّ، لا طلب ولا حساب.
   ولمَن نفد صنفه مؤقتاً، available=false أفضل — فالحذف يُفقده السعر
   والوحدات ويُعيده يكتبها من جديد حين تعود البضاعة. */
router.delete('/:id', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    const marketId = String(req.query.marketId || '').trim();
    if (!db || !marketId) return res.status(400).json({ success: false, error: 'حدّد المحل' });
    if (!(await ownsMarket(req, marketId))) return denied(res);

    await db.collection('restaurants').doc(marketId)
      .collection('products').doc(String(req.params.id)).delete();

    invalidate(`mart:${marketId}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* POST /api/mart_products/migrate  { marketId, overwrite? }

   جسر لمرة واحدة من النظام القديم إلى الجديد.

   أصنافك اليوم في مجموعة عامة `mart_products` بحقل price مفرد وحقل
   sizes للأحجام. والنظام الجديد يقرأ من `restaurants/{المحل}/products`
   بوحدات بيع مسعّرة. فلولا هذا الجسر لظهر زادنا مارت للزبون بلا صنف
   واحد لحظة النشر — ولَظُنّ الناس أن التحديث كسر المتجر، وهو إنما لم
   يجد بضاعته حيث صار يبحث عنها.

   ولا نلمس القديم: ننسخ ولا ننقل. فإن ساء شيء، الأصل سليم مكانه. */
router.post('/migrate', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    const b = req.body || {};
    const marketId = String(b.marketId || 'mart_001').trim();
    if (!db) return res.status(500).json({ success: false, error: 'لا قاعدة بيانات' });
    if (!(await ownsMarket(req, marketId))) return denied(res);

    const legacy = await db.collection('mart_products').get();
    if (legacy.empty) return res.json({ success: true, moved: 0, note: 'لا أصناف قديمة' });

    const col = db.collection('restaurants').doc(marketId).collection('products');
    const existing = new Set();
    if (b.overwrite !== true) {
      const cur = await col.get();
      cur.forEach(d => existing.add(d.id));
    }

    const batch = db.batch();
    let moved = 0, skipped = 0;
    const failed = [];
    legacy.forEach(doc => {
      if (moved >= 400) return;              // سقف دفعة Firestore ٥٠٠
      if (existing.has(doc.id)) { skipped++; return; }
      const o = doc.data() || {};

      /* الوحدات من sizes إن وُجدت، وإلا من السعر المفرد ووحدته.
       * والصنف بلا سعر صالح لا يُنقل: أن يغيب صنف خيرٌ من أن يظهر
       * للزبون بصفر فيطلبه ويكتشف المندوب الحقيقة عند الباب. */
      let units = [];
      if (Array.isArray(o.sizes) && o.sizes.length) {
        units = o.sizes.map(s => ({ label: s && s.unitAr, price: s && s.price }));
      } else if (Number(o.price) > 0) {
        units = [{ label: o.unitAr || 'قطعة', price: o.price }];
      }
      units = cleanUnits(units);
      if (!units.length) { failed.push(o.nameAr || doc.id); return; }

      batch.set(col.doc(doc.id), {
        nameAr:     String(o.nameAr || '').trim().slice(0, 120) || doc.id,
        brand:      String(o.brand || '').trim().slice(0, 60),
        categoryId: String(o.categoryId || 'pantry'),
        emoji:      String(o.emoji || ''),
        imageUrl:   String(o.imageUrl || ''),
        units,
        available:  o.available !== false,
        updatedAt:  new Date(),
      });
      moved++;
    });
    if (moved) await batch.commit();

    invalidate(`mart:${marketId}`);
    console.log(`🔀 نُقل ${moved} صنفاً إلى ${marketId} · تُخطّي ${skipped} · تعذّر ${failed.length}`);
    res.json({ success: true, moved, skipped, failed });
  } catch (e) {
    console.error('❌ نقل الكتالوج:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ===== تسعير طلب المارت =====

   يستعملها مسار الطلبات. السيرفر يحسب المبلغ من كتالوج المحلّ نفسه
   ولا يثق برقم أرسله التطبيق — نفس القاعدة التي طبّقناها على المطاعم.

   والوحدة جزء من الهوية لا زينة: «كيلو بندورة» و«حبة بندورة» صنف
   واحد بسعرين. من يطلب الكيلو ويُحاسَب سعر الحبة يسرقنا، والعكس
   يسرقه هو. لذلك نطابق الوحدة المطلوبة بوحدة مسجّلة عند المحلّ،
   ونرفض ما لا يطابق بدل أن نخمّن. */
async function priceMartItems(db, marketId, items) {
  if (!Array.isArray(items) || !items.length) return null;
  const ids = [...new Set(items.map(i => String((i && i.id) || '')).filter(Boolean))].slice(0, 120);
  if (!ids.length) return { error: 'أصناف بلا معرّفات' };

  const col = db.collection('restaurants').doc(String(marketId)).collection('products');
  const snaps = await Promise.all(ids.map(id => col.doc(id).get()));
  const byId = new Map();
  snaps.forEach(s => { if (s.exists) byId.set(s.id, s.data()); });

  let total = 0;
  const unknown = [], gone = [], badUnit = [];
  for (const it of items) {
    const id = String((it && it.id) || '');
    const p = byId.get(id);
    if (!p) { unknown.push(id); continue; }
    if (p.available === false) { gone.push(p.nameAr || id); continue; }

    const wanted = String((it && (it.unit || it.unitLabel)) || '').trim();
    const units = Array.isArray(p.units) ? p.units : [];
    // بلا وحدة مطلوبة نأخذ الأولى — وهي التي يعرضها التطبيق افتراضياً
    const u = wanted ? units.find(x => x && x.label === wanted) : units[0];
    if (!u) { badUnit.push(`${p.nameAr || id} (${wanted || '—'})`); continue; }

    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    const price = Number(u.offerPrice) > 0 ? Number(u.offerPrice) : Number(u.price);
    total += price * qty;
  }

  if (unknown.length) return { error: 'أصناف غير موجودة في المحل: ' + unknown.join('، ') };
  if (gone.length)    return { error: 'نفدت من المحل: ' + gone.join('، ') };
  if (badUnit.length) return { error: 'وحدة بيع غير متاحة: ' + badUnit.join('، ') };
  return { total: r2(total) };
}

module.exports = router;
module.exports.priceMartItems = priceMartItems;
module.exports.MART_CATEGORIES = MART_CATEGORIES;
