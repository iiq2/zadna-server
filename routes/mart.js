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

/* ============================================================
   كتالوج الإدارة (كل المحلّات معاً) — عمرٌ طويل عمداً.

   هذا الاستعلام يقرأ ٨٨٠ مستنداً في المرّة الواحدة. وبعمرٍ من خمس
   دقائق كانت لوحةٌ مفتوحة على المكتب تُنفق ٨٨٠ × ٢٨٨ = ٢٥٣ ألف قراءة
   في اليوم — خمسة أضعاف الحصة المجانية كلّها. ولوحةُ مراقبةٍ لا يلمسها
   أحد لا يجوز أن تُوقف تطبيق الزبون والمندوب والمطعم.

   والصحّة لا تأتي من قِصَر العمر بل من الإبطال: كل كتابة على أي صنف
   تمسح هذا المفتاح صراحةً (invalidateCatalog أدناه). فالتعديل يظهر في
   اللوحة فوراً، والثمن يصير «قراءة عند كل تعديل» لا «قراءة كل خمس
   دقائق أبد الدهر».

   وكان المفتاح — قبل هذا — لا يُبطَل عند الكتابة أصلاً: أي أنّه كان
   غالياً وقديماً معاً. أسوأ الاثنين.
   ============================================================ */
const ADMIN_CATALOG_TTL = 6 * 60 * 60 * 1000;   // ست ساعات

/** كل كتابة على صنف تمسح كتالوج محلّه وكتالوج الإدارة معاً. */
function invalidateCatalog(marketId) {
  invalidate(`mart:${marketId}`, 'mart:all');
}

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
/* ============================================================
   GET /api/mart_products/nearest?lat=&lng=
   أقرب ماركت **مفتوح** للزبون، ومعه كتالوجه.

   القرار التجاري وراء هذا المسار: الزبون لا يختار بين ماركتات، بل
   يُوجَّه إلى أقربها. وسببه أن توحيد أسماء المنتجات بين محلّات مختلفة
   مشروعٌ بحدّ ذاته — «زيت زيتون ١ لتر» عند واحد و«زيت زيتون فلسطيني
   لتر» عند الآخر — وشركات كبرى تقضي فيه سنوات. ماركتٌ واحد في اللحظة
   الواحدة يتجاوز المسألة كلّها: لا مقارنة، ولا تضارب أسعار، ولا قوائم
   متداخلة.

   وميزةٌ ثانية: الأقرب هو الأرخص توصيلاً، لأن الأجرة تُحسب بالمسافة.
   فالاختيار يخدم الزبون ومحفظته معاً.

   ثلاث قواعد:
     · المغلق يُتخطّى إلى التالي فوراً — لا شاشة فارغة نصف اليوم.
     · لا حدّ صارم للمسافة: نبقى مع الزبون البعيد، لكنه يدفع أجرة
       المسافة كاملة (١٠ ثم +٥ لكل كيلومترين). المدى الأقصى حارسٌ
       من الخطأ لا سياسة تسعير.
     · بلا موقع لا نُخمّن: نطلب منه تحديده بدل أن نُريه بضاعة قد لا
       تصله.

   وما يجب أن تقوله لشركائك مكتوباً من أول يوم: الزبون يُوجَّه لأقرب
   ماركت. شريكٌ في حيّ مزدحم سيأخذ أكثر، وآخر أقلّ — ومن يكتشفها
   بنفسه بعد شهر يظنّ أنك تُفضّل غيره.
   ============================================================ */
const NEAREST_TTL = 120000;  // دقيقتان — الفتح والإغلاق يتغيّران خلال اليوم

function martDistKm(aLat, aLng, bLat, bLng) {
  const R = 6371, rad = (d) => d * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  // ١٫٣٥ التفاف الطرق مقابل الخط المستقيم — نفس معامل التسعير في zones.js
  return 2 * R * Math.asin(Math.sqrt(h)) * 1.35;
}

router.get('/nearest', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json({ success: false, error: 'الخدمة غير متاحة الآن', markets: 0 });

    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false, needsLocation: true,
        error: 'حدّد موقعك أولاً لنعرف أقرب سوبرماركت إليك'
      });
    }

    const markets = await cached('markets:list', NEAREST_TTL, async () => {
      const snap = await db.collection('restaurants').where('partnerType', '==', 'market').get();
      const out = [];
      snap.forEach(d => {
        const m = d.data() || {};
        out.push({
          id: d.id,
          name: m.name || 'سوبرماركت',
          emoji: m.emoji || '🛒',
          imageUrl: m.imageUrl || '',
          phone: m.phone || '',
          address: m.address || '',
          lat: Number(m.lat) || 0,
          lng: Number(m.lng) || 0,
          isOpen: m.isOpen !== false,
          status: String(m.status || 'approved'),
        });
      });
      meter.addReads(snap.size, 'قائمة الماركتات');
      return out;
    });

    /* ============================================================
       لا حدّ للمسافة — الأقرب يُعرض مهما بَعُد.

       كان هنا قطعٌ عند ٢٥ كم. وهو خطأ في نموذجنا: قرّرنا أن نبقى مع
       الزبون البعيد ويدفع أجرة المسافة كاملة (١٠ ثم +٥ لكل كيلومترين).
       وبماركتٍ واحد أو اثنين في البداية، الحدّ يعني أن الخدمة تختفي عن
       نصف نابلس بلا سبب حقيقي — والزبون يقرأ «لا يخدم منطقتك» فيظنّ
       المنصّة فارغة، وهي ليست كذلك.

       فالقاعدة الآن: إن وُجد ماركتٌ واحد معتمد ومفتوح — يُعرض. والمسافة
       تُرسَل معه ليعرف الزبون أن الأجرة أعلى، لا ليُمنع.

       ونُبقي حارساً واحداً بعيداً جداً (١٠٠ كم) لالتقاط إحداثيةٍ خاطئة
       — ماركت وُضع سهواً في بلدٍ آخر — لا لتقييد الخدمة.
       ============================================================ */
    const approved = markets.filter(m => m.status === 'approved');
    const usable = approved.filter(m => m.lat && m.lng);

    /* ============================================================
       «لا ماركت» ثلاثة أسباب مختلفة — والخلط بينها كلّفنا وقتاً.

       كانت الرسالة واحدة: «لا يخدم منطقتك». وهي صادقة في حالة واحدة
       فقط من ثلاث:
         · لا ماركت مسجَّل أصلاً        → قريباً، والرسالة صحيحة
         · مسجَّل ولم يُعتمد بعد        → القرار عندك أنت لا عند الزبون
         · معتمد وبلا إحداثيات          → **خطأ إداري صامت**: الشريك
           جاهز وبضاعته موجودة، ولا يظهر لأحد لأن أحداً لم يضع دبّوسه
           على الخريطة. ولا شيء كان يقول ذلك لأحد.

       نُفرّقها في السجلّ وفي الردّ، ونُبقي للزبون رسالةً واحدة مهذّبة.
       ============================================================ */
    if (!usable.length) {
      const pending = markets.length - approved.length;
      const noGeo = approved.length - usable.length;
      if (noGeo > 0) {
        console.warn(`🛒 ${noGeo} سوبرماركت معتمد بلا إحداثيات — لن يظهر لأي زبون حتى يُحدَّد موقعه`);
      }
      if (pending > 0) {
        console.warn(`🛒 ${pending} سوبرماركت بانتظار الاعتماد`);
      }
      return res.json({
        success: false, outOfRange: true,
        markets: markets.length, approved: approved.length,
        located: usable.length, pendingApproval: pending, missingLocation: noGeo,
        error: markets.length === 0
          ? 'زادنا مارت قريباً — نعمل على ضمّ سوبرماركتات شريكة'
          : 'السوبرماركت الشريك يُجهَّز الآن — سيفتح قريباً إن شاء الله'
      });
    }

    const SANITY_KM = 100;   // حارس إحداثيةٍ خاطئة، لا حدّ خدمة
    const ranked = usable
      .map(m => ({ ...m, km: Math.round(martDistKm(lat, lng, m.lat, m.lng) * 10) / 10 }))
      .filter(m => m.km <= SANITY_KM)
      .sort((a, b) => a.km - b.km);

    if (!ranked.length) {
      console.warn(`🛒 كل الماركتات أبعد من ${SANITY_KM} كم — راجع إحداثياتها`);
      return res.json({
        success: false, outOfRange: true, markets: markets.length,
        error: 'ما في سوبرماركت شريك يخدم منطقتك بعد — قريباً إن شاء الله'
      });
    }

    // المغلق يُتخطّى فوراً. وإن كانوا كلهم مغلقين نقول ذلك صراحةً
    // ونذكر اسم الأقرب، فيعرف الزبون أن الخدمة موجودة لا مفقودة.
    const open = ranked.find(m => m.isOpen);
    if (!open) {
      return res.json({
        success: false, allClosed: true, nearestName: ranked[0].name,
        error: `${ranked[0].name} مغلق الآن — جرّب بعد قليل`
      });
    }

    const products = await cached(`mart:${open.id}`, CATALOG_TTL, async () => {
      const snap = await db.collection('restaurants').doc(open.id).collection('products').get();
      const out = [];
      snap.forEach(d => out.push({ id: d.id, ...d.data() }));
      meter.addReads(snap.size, 'كتالوج المارت');
      return out;
    });

    res.json({
      success: true,
      market: { id: open.id, name: open.name, emoji: open.emoji, imageUrl: open.imageUrl,
                address: open.address, lat: open.lat, lng: open.lng, km: open.km },
      // الزبون لا يرى ما نفد؛ صاحب المحل يراه في تطبيقه ليُعيده
      products: products.filter(p => p.available !== false),
      alternatives: ranked.length - 1,   // كم ماركت آخر ضمن المدى — لعلمك لا لعرضه
    });
  } catch (e) {
    console.error('❌ أقرب ماركت:', e.message);
    res.status(500).json({ success: false, error: 'تعذّر جلب السوبرماركت — أعد المحاولة' });
  }
});

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
/* حارس مشروط: التوكن يُفكّ حين يُطلب `all=1` وحده.
 *
 * `ownsMarket` تقرأ `req.user`، و`req.user` لا تُملأ إلا داخل
 * `requireIdentity`. وهذا المسار بلا حارس (الزبون يتصفّح بلا توكن)،
 * فكانت `ownsMarket` تُرجع `false` **دائماً** و`all=1` بلا أثر:
 * صاحب المحلّ يُطفئ صنفاً نفد فيختفي عنه عند أوّل تحديث ولا يستطيع
 * إعادته — ويبقى ينقص من بضاعته كل يوم بلا أن يفهم لماذا.
 *
 * والحارس مقيَّد بـ`all=1` عمداً: تصفّح الزبون يبقى مفتوحاً بلا توكن.
 * نفس أسلوب حارس رفع الصور في server.js. */
router.get('/', (req, res, next) =>
  String(req.query.all || '') === '1' ? needsIdentity(req, res, next) : next(),
async (req, res) => {
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
      const list = await cached('mart:all', ADMIN_CATALOG_TTL, async () => {
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

    invalidateCatalog(marketId);
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

    invalidateCatalog(marketId);
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

    invalidateCatalog(marketId);
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

    invalidateCatalog(marketId);
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

    invalidateCatalog(marketId);
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
/* ============================================================
   فكّ معرّف السلة المركّب.

   تطبيق الزبون يبني معرّف صنف السلة هكذا (MartScreen.kt:769):
       id = "${product.id}__${unit.label}"     →  p_1785…__كيلو

   وله سببٌ وجيه: «بندورة — كيلو» و«بندورة — حبّة» يجب أن يكونا سطرين
   مستقلّين في السلة، ولو تشاركا المعرّف لداس أحدهما الآخر. لكنّ
   المعرّف المركّب يُرسَل إلى السيرفر كما هو، والسيرفر يبحث عن مستند
   اسمه `p_1785…__كيلو` في كتالوج المحلّ — ولا وجود له. فيردّ 400
   «أصناف غير موجودة في المحل»، ويرى الزبون «تعذّر إرسال الطلب».

   أي أنّ **زادنا مارت كان لا يقبل طلباً واحداً**. خمس محاولات في سجلّ
   الأخطاء، كلّها 400، ولا صنف يمرّ.

   ونفكّه هنا لا في التطبيق عمداً: الإصلاح في السيرفر يسري على كل جهاز
   مثبَّت الآن بلا بناء ولا تحديث ينتظره الناس. ونقبل الصورتين معاً —
   المركّبة والمنفصلة — فلا ينكسر شيء حين يُصلَح التطبيق يوماً.

   والوحدة المستخرَجة لا تُستعمل إلا إن لم يُرسل التطبيق `unit` صراحةً:
   ما يقوله الحقل المخصّص أوثق ممّا نستنبطه من نصّ.
   ============================================================ */
const SEP = '__';
function splitCartId(raw) {
  const s = String(raw || '');
  const at = s.indexOf(SEP);
  if (at < 0) return { id: s, unit: '' };
  return { id: s.slice(0, at), unit: s.slice(at + SEP.length).trim() };
}

/* الطلب المكتوب بخطّ الزبون — بطاقة «اكتب طلبك 🛒».
 *
 * التطبيق يبنيه بمعرّف مصطنع `custom_grocery_<وقت>` وسعرٍ صفر، لأن
 * الزبون كتب «نص كيلو زيتون وخبزتين» ولا سعر لهذا في أي كتالوج.
 *
 * وكان التسعير يبحث عن هذا المعرّف في مستندات المحلّ فلا يجده →
 * «أصناف غير موجودة» → 400. أي أن أبرز بطاقة في تبويب المارت
 * **لم تُنتج طلباً ناجحاً واحداً منذ كتابتها**.
 *
 * القاعدة: الصنف الحرّ يُقبل ويساهم صفراً في المجموع. ليس تسامحاً
 * محاسبياً بل توصيفاً صادقاً: ثمنه غير معلوم لحظة الطلب، والمندوب
 * يدفعه على الرفّ ويحصّله نقداً مع التسليم — خارج مجموعنا المحسوب،
 * كما لو اشترى الزبون بنفسه. وعمولة زادنا على هذا الجزء صفر بالبناء،
 * وهذا قرار تجاري ظاهر هنا لا عطل مدفون. */
const isCustomItem = (id) => String(id || '').startsWith('custom_grocery');

async function priceMartItems(db, marketId, items) {
  if (!Array.isArray(items) || !items.length) return null;
  const ids = [...new Set(
    items.map(i => splitCartId(i && i.id).id).filter(id => id && !isCustomItem(id))
  )].slice(0, 120);
  // سلة كلها أصناف حرّة: مشروعة — مجموع بضاعتها صفر وأجرة التوصيل تُحسب بعدنا
  if (!ids.length && !items.some(i => isCustomItem(splitCartId(i && i.id).id))) {
    return { error: 'أصناف بلا معرّفات' };
  }

  const col = db.collection('restaurants').doc(String(marketId)).collection('products');
  const snaps = await Promise.all(ids.map(id => col.doc(id).get()));
  const byId = new Map();
  snaps.forEach(s => { if (s.exists) byId.set(s.id, s.data()); });

  let total = 0;
  const unknown = [], gone = [], badUnit = [];
  for (const it of items) {
    const parsed = splitCartId(it && it.id);
    const id = parsed.id;
    if (isCustomItem(id)) continue;   // مكتوب بخطّ الزبون: يمرّ، ثمنه على الرفّ لا هنا
    const p = byId.get(id);
    if (!p) { unknown.push(id); continue; }
    if (p.available === false) { gone.push(p.nameAr || id); continue; }

    const wanted = String((it && (it.unit || it.unitLabel)) || parsed.unit || '').trim();
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
