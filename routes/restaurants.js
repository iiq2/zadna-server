const express = require('express');
const router = express.Router();

/**
 * تعديل المطاعم للإدارة وحدها.
 *
 * كانت المسارات الستة (إنشاء، تعديل، منيو، اعتماد، تجميد، الموقع) مفتوحة
 * بلا أي تحقق: أي أحد يعرف عنوان السيرفر كان يستطيع تجميد مطعم، أو اعتماد
 * مطعم وهمي، أو تغيير أسعار المنيو. ومع اعتماد أجرة التوصيل على موقع
 * المطعم، صار تحريك الموقع وسيلة لتغيير السعر أيضاً.
 *
 * القراءة (GET) تبقى مفتوحة — الزبون يحتاجها ليرى المطاعم.
 */
const adminOnly = (req, res, next) => {
  const fn = req.app.get('requireAdmin');
  return fn ? fn(req, res, next) : next();
};

/** يتطلّب Token صالحاً (لا مفتاح إدارة) — يملأ req.user */
const needsIdentity = (req, res, next) => {
  const fn = req.app.get('requireIdentity');
  return fn ? fn(req, res, next) : next();
};

/**
 * هل هذا المستخدم يملك هذا المطعم؟
 *
 * الرابط مسجَّل باتجاهين مختلفين حسب طريقة الإنشاء:
 *   • مطعم أنشأه شريك بالتسجيل  → `restaurant.ownerId` يشير إلى المستخدم
 *   • مطعم مضاف من البداية      → `user.ownedRestaurantId` يشير إلى المطعم
 *
 * والـ14 مطعماً الأصلية أُنشئت بلا `ownerId` إطلاقاً، فالفحص باتجاه واحد
 * كان يرفض أصحابها جميعاً بـ403 — يضغط صاحب المطعم «إغلاق» فيُمنع بلا سبب
 * مفهوم. نفحص الاتجاهين، ونُصلح البيانات عند أول تطابق ناجح.
 */
async function ownsRestaurant(db, req, restaurantId, restaurantData) {
  if (req.isAdmin) return true;
  const meId = req.user && (req.user.userId || req.user.id);
  if (!meId) return false;

  // الاتجاه الأول: المطعم يعرف مالكه
  if (restaurantData && restaurantData.ownerId &&
      String(restaurantData.ownerId) === String(meId)) return true;

  // الاتجاه الثاني: المستخدم يعرف مطعمه
  try {
    const u = await db.collection('users').doc(String(meId)).get();
    if (!u.exists) return false;
    const owned = u.data().ownedRestaurantId;
    if (owned && String(owned) === String(restaurantId)) {
      // نُثبّت الرابط على المطعم أيضاً، فلا يتكرر البحث ولا يبقى الحقل ناقصاً
      if (!restaurantData || !restaurantData.ownerId) {
        try {
          await db.collection('restaurants').doc(String(restaurantId))
                  .update({ ownerId: String(meId) });
          invalidate('restaurants:raw');
          console.log('🔗 رُبط المطعم', restaurantId, 'بمالكه', meId);
        } catch (e) { /* الصلاحية ثابتة سواء نجح الإصلاح أم لا */ }
      }
      return true;
    }
  } catch (e) { /* تعذّر السؤال — نرفض بأمان */ }
  return false;
}

const demoRestaurants = [
  {
        id: 'rest_001',
        name: 'Veranda Cafe & Cultural Space',
        description: 'مساحة ثقافية وقهوة مميزة - رفيديا',
        cuisineType: ['مقهى', 'ثقافة'],
        deliveryTime: 15,
        deliveryFee: 5,
        rating: 4.8,
        categories: ['قهوة', 'سندوتشات'],
        menu: [
          { id: 'item_101', name: 'سبانيش لاتيه بارد', price: 14, description: 'إسبريسو مع حليب مكثف محلى', available: true },
          { id: 'item_102', name: 'كرواسون نوتيلا', price: 12, description: 'مقرمش ومحشو بالشوكولاتة', available: true }
              ]
  },
  {
        id: 'rest_002',
        name: 'Lemon W Nana',
        description: 'عصائر ووجبات خفيفة - الدوار',
        cuisineType: ['عصائر', 'سريع'],
        deliveryTime: 20,
        deliveryFee: 3,
        rating: 4.6,
        categories: ['عصائر', 'سناك'],
        menu: [
          { id: 'item_201', name: 'ليمون ونعناع مثلج', price: 10, description: 'منعش وطبيعي 100%', available: true }
              ]
  },
  {
        id: 'rest_003',
        name: 'Pardo Cafe',
        description: 'أجواء هادئة وألذ المشروبات - شارع فيصل',
        cuisineType: ['مقهى'],
        deliveryTime: 25,
        deliveryFee: 4,
        rating: 4.7,
        categories: ['مشروبات ساخنة', 'حلويات'],
        menu: [
          { id: 'item_301', name: 'كابتشينو إيطالي', price: 12, description: 'رغوة كثيفة وطعم غني', available: true }
              ]
  },
  {
        id: 'rest_004',
        name: 'Mateam Alf Laylat W Lay',
        description: 'مطعم ألف ليلة وليلة - مأكولات شرقية',
        cuisineType: ['شرقي', 'مشاوي'],
        deliveryTime: 40,
        deliveryFee: 7,
        rating: 4.5,
        categories: ['مشاوي', 'أطباق شرقية'],
        menu: [
          { id: 'item_401', name: 'نص كيلو كباب شرقي', price: 65, description: 'مع مقبلات البيت', available: true }
              ]
  },
  {
        id: 'rest_005',
        name: '1948 Restaurant',
        description: 'عبق التاريخ وألذ الأطباق - البلدة القديمة',
        cuisineType: ['شرقي', 'فلسطيني'],
        deliveryTime: 30,
        deliveryFee: 5,
        rating: 4.9,
        categories: ['غداء', 'مقبلات'],
        menu: [
          { id: 'item_501', name: 'مقلوبة فلسطينية بالدجاج', price: 35, description: 'طبق نابلسي أصيل', available: true }
              ]
  },
  {
        id: 'rest_006',
        name: 'مقهى فريد زمانه',
        description: 'قهوة عربية وأصالة نابلسية',
        cuisineType: ['مقهى', 'شعبي'],
        deliveryTime: 15,
        deliveryFee: 2,
        rating: 4.4,
        categories: ['قهوة', 'أراجيل'],
        menu: [
          { id: 'item_601', name: 'قهوة سادة مهيلة', price: 5, description: 'محمصة بعناية', available: true }
              ]
  },
  {
        id: 'rest_007',
        name: 'Cedarz Gelato & Coffee House',
        description: 'جيلاتو إيطالي فاخر - رفيديا',
        cuisineType: ['حلويات', 'جيلاتو'],
        deliveryTime: 10,
        deliveryFee: 4,
        rating: 4.8,
        categories: ['جيلاتو', 'قهوة'],
        menu: [
          { id: 'item_701', name: 'جيلاتو فستق حلبي', price: 15, description: 'طعم إيطالي أصيل', available: true }
              ]
  },
  {
        id: 'rest_008',
        name: 'اورجادا برجر - نابلس',
        description: 'برجر مشوي على اللهب - الأكاديمية',
        cuisineType: ['برجر', 'سريع'],
        deliveryTime: 30,
        deliveryFee: 5,
        rating: 4.7,
        categories: ['برجر لحم', 'برجر دجاج'],
        menu: [
          { id: 'item_801', name: 'تشيز برجر كلاسيك', price: 28, description: 'لحم بقري طازج مع جبنة شيدر', available: true }
              ]
  },
  {
        id: 'rest_009',
        name: '90s Burger',
        description: 'طعم البرجر الكلاسيكي - شارع تونس',
        cuisineType: ['برجر'],
        deliveryTime: 25,
        deliveryFee: 5,
        rating: 4.6,
        categories: ['برجر'],
        menu: [
          { id: 'item_901', name: 'ناينتيز برجر دبل', price: 35, description: 'لحم دبل مع صوص خاص', available: true }
              ]
  },
  {
        id: 'rest_010',
        name: 'Nosha Cafe',
        description: 'أفخم الحلويات والمشروبات - المخفية',
        cuisineType: ['مقهى', 'حلويات'],
        deliveryTime: 20,
        deliveryFee: 3,
        rating: 4.5,
        categories: ['حلويات غربية', 'مشروبات'],
        menu: [
          { id: 'item_1001', name: 'كيكة العسل', price: 18, description: 'طبقات هشة ولذيذة', available: true }
              ]
  },
  {
        id: 'rest_011',
        name: 'Burger Space',
        description: 'رحلة إلى عالم البرجر - رفيديا',
        cuisineType: ['برجر', 'سريع'],
        deliveryTime: 35,
        deliveryFee: 6,
        rating: 4.7,
        categories: ['برجر'],
        menu: [
          { id: 'item_1101', name: 'أسترونوت برجر', price: 32, description: 'خلطة الفضاء المميزة', available: true }
              ]
  },
  {
        id: 'rest_012',
        name: 'Al Mawardi Restaurant',
        description: 'مطعم الماوردي - أفخم المشاوي',
        cuisineType: ['مشاوي', 'غداء'],
        deliveryTime: 45,
        deliveryFee: 8,
        rating: 4.8,
        categories: ['مشاوي مشكلة', 'صواني'],
        menu: [
          { id: 'item_1201', name: 'سدر مشاوي عائلي', price: 150, description: 'كباب، شقف، طاووق وريش', available: true }
              ]
  },
  {
        id: 'rest_013',
        name: 'Abusair Pastries',
        description: 'حلويات أبو سير الشهيرة - الدوار',
        cuisineType: ['حلويات'],
        deliveryTime: 15,
        deliveryFee: 3,
        rating: 4.9,
        categories: ['كنافة', 'حلويات'],
        menu: [
          { id: 'item_1301', name: 'كنافة ناعمة أبو سير', price: 22, description: 'الذهب النابلسي', available: true }
              ]
  },
  {
        id: 'rest_014',
        name: 'Hashtag Snax',
        description: 'أسرع وألذ سناك - الجبل الشمالي',
        cuisineType: ['سريع', 'سناك'],
        deliveryTime: 20,
        deliveryFee: 4,
        rating: 4.3,
        categories: ['سندوتشات', 'بطاطا'],
        menu: [
          { id: 'item_1401', name: 'زنجر سوبريم', price: 18, description: 'دجاج مقرمش مع هاشتاج صوص', available: true }
              ]
  }
  ];

// Get Firestore from app
const getDb = (req) => req.app.get('db');
const { cached, invalidate } = require('../utils/cache');
// 10 دقائق: المطاعم نادرة التغيير، وأي تعديل منيو أو اعتماد يُبطل الكاش.
const REST_TTL = 600000;

router.get('/', async (req, res) => {
    try {
          const db = getDb(req);
          // بلا قاعدة بيانات (فشل الاتصال أو انتهاء الحصة) كان النداء ينهار
          // بخطأ 500، فيرى الزبون شاشة فارغة ورسالة عطل. المطاعم الأساسية
          // موجودة في الكود، فالأولى أن نعرضها بدل أن نُسقط الواجهة كلها.
          const restaurants = !db ? [] : await cached('restaurants:raw', REST_TTL, async () => {
            const snapshot = await db.collection('restaurants').get();
            const list = [];
            snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            return list;
          });

      /* ============================================================
         `?all=1` للإدارة وحدها.

         كان يكفي أن يضيف أيّ زائر `?all=1` على الرابط ليرى المطاعم غير
         المعتمدة والمجمَّدة ومنيوهاتها وأسعارها — أي كل شريك تفاوضتَ معه
         ولم يُطلق بعد، وكل شريك أوقفتَه ولمَ أوقفتَه.

         الطلب المعتمد يمرّ بترويسة x-admin-key؛ الزائر يرى المعتمد فقط.
         ============================================================ */
      const asksAll = req.query.all === '1' || req.query.all === 'true';
      const showAll = asksAll && !!req.isAdmin;
      if (asksAll && !req.isAdmin) {
        console.warn('⚠️ طلب ?all=1 بلا مفتاح إدارة — عُرضت المطاعم المعتمدة فقط');
      }
      const visible = showAll
        ? restaurants
        : restaurants.filter(r => (!r.status || r.status === 'approved') && r.isOpen !== false);
      // الاستبعاد يُبنى على **كل** المطاعم المسجَّلة لا على الظاهر منها فقط.
      //
      // كان يُبنى من `visible`: فمطعم يُغلقه صاحبه يُحذف من القائمة، ويصبح
      // معرّفه غير موجود في المجموعة، فتُضاف **نسخته المحفورة في الكود**
      // مكانه — بمنيو قديم من سطر واحد، و`isOpen` غير مضبوط أي «مفتوح».
      //
      // النتيجة: زرّ الإغلاق لا يعمل إطلاقاً. يقفل صاحب المطعم محلّه فيراه
      // الزبون مفتوحاً بمنيو لا يعرفه، ويطلب منه، والمطبخ مغلق.
      // والأمر نفسه ينطبق على المطعم المجمَّد أو غير المعتمد: يُخفى ثم يعود
      // بنسخة الديمو — أي أن التجميد بلا أثر أيضاً.
      /* مطاعم الكود تُعرض **فقط** حين لا قاعدة بيانات إطلاقاً.
       *
       * كانت تُدمج دائماً، فصارت أشباحاً لا يملكها أحد ولا يستطيع أحد
       * حذفها: المدير يمسحها من Firestore فتعود، ويجمّدها فتعود — لأنها
       * ليست بياناتٍ أصلاً بل أسطرٌ في هذا الملف.
       *
       * وأخطر من بقائها أنها تقبل الطلبات: زبون يطلب من «Hashtag Snax»
       * فلا يصل الطلب أحداً — لا مالك له ولا مطبخ.
       *
       * وحتى عند انقطاع قاعدة البيانات، عرضُها مشكوك فيه: طلبٌ يذهب إلى
       * العدم أسوأ من رسالة «الخدمة مضغوطة». أبقيناها لهذه الحالة وحدها
       * لأن الواجهة الفارغة تُربك، لكن `isOpen: false` تمنع الطلب منها. */
      const merged = db
        ? visible
        : demoRestaurants.map(d => ({ ...d, isOpen: false }));

      // ترتيب جميل للزبون: المفتوح أولاً، ثم الأعلى تقييماً، ثم الأسرع توصيلاً
      const nowOpen = (r) => r.isOpen !== false;
      merged.sort((a, b) => {
        if (nowOpen(a) !== nowOpen(b)) return nowOpen(a) ? -1 : 1;
        const fa = a.isFeatured ? 1 : 0, fb = b.isFeatured ? 1 : 0;
        if (fa !== fb) return fb - fa;
        const ra = Number(a.rating) || 0, rb = Number(b.rating) || 0;
        if (rb !== ra) return rb - ra;
        return (Number(a.deliveryTime) || 99) - (Number(b.deliveryTime) || 99);
      });

      // أكمل الحقول الناقصة حتى لا تظهر بطاقات مشوّهة
      const clean = merged.map(r => ({
        ...r,
        name: r.name || 'مطعم',
        description: r.description || 'مطعم شريك على منصة زادنا',
        emoji: r.emoji || '🍽️',
        // تقييمٌ مفقود = 0 لا 5.
        // كان كل مطعم جديد يُولد بخمس نجوم لم يمنحها أحد، فيثق الزبون
        // برقم لا أساس له — ويفقد الثقة بكل التقييمات حين يكتشف ذلك.
        rating: Number(r.rating) || 0,
        deliveryTime: Number(r.deliveryTime) || 25,
        deliveryFee: r.deliveryFee != null ? Number(r.deliveryFee) : 5,
        categories: Array.isArray(r.categories) && r.categories.length ? r.categories : ['all'],
        menu: Array.isArray(r.menu) ? r.menu.filter(m => m && m.available !== false) : [],
        isOpen: r.isOpen !== false,
        menuCount: Array.isArray(r.menu) ? r.menu.filter(m => m && m.available !== false).length : 0
      }));

      res.json({ success: true, count: clean.length, restaurants: clean, city: 'نابلس' });
    } catch (error) {
          res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
          const db = getDb(req);
          const doc = await db.collection('restaurants').doc(req.params.id).get();
          if (!doc.exists) {
            /* لا نُرجع مطعم الكود ما دامت قاعدة البيانات تعمل.
             *
             * القائمة لم تعد تعرضه، لكن رابطاً قديماً أو مفضّلةً محفوظة
             * تفتحه بمعرّفه — فيُبنى منه سلة ويُرسل طلب إلى مطعم لا وجود
             * له. البابان يُغلقان معاً أو لا يُغلق أيّهما. */
            if (!db) {
              const demo = demoRestaurants.find(r => r.id === req.params.id);
              if (demo) return res.json({ success: true, restaurant: { ...demo, isOpen: false } });
            }
            return res.status(404).json({ success: false, error: 'المطعم غير موجود' });
          }
          res.json({ success: true, restaurant: { id: doc.id, ...doc.data() } });
    } catch (error) {
          res.status(500).json({ success: false, error: error.message });
    }
});

// ==============================
// إنشاء وتعديل المطاعم (لتطبيق المطعم)
// ==============================

// POST /api/restaurants — صاحب المطعم يسجل مطعمه (يصل للمدير للاعتماد)
router.post('/', adminOnly, async (req, res) => {
  try {
    invalidate('restaurants:raw');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const b = req.body || {};
    if (!b.name || !String(b.name).trim()) {
      return res.status(400).json({ success: false, error: 'اسم المطعم مطلوب' });
    }
    const id = b.id || ('rest_' + Date.now());
    const doc = {
      id,
      name: String(b.name).trim(),
      description: b.description || '',
      phone: b.phone || '',
      address: b.address || '',
      workingHours: b.workingHours || '',
      ownerId: b.ownerId || null,
      emoji: b.emoji || '🍽️',
      rating: b.rating || 5,
      deliveryTime: b.deliveryTime || 25,
      deliveryFee: b.deliveryFee != null ? b.deliveryFee : 5,
      cuisineType: b.cuisineType || [],
      categories: b.categories || [],
      menu: Array.isArray(b.menu) ? b.menu : [],
      commission: '10%',
      status: 'pending',
      isActive: false,
      createdAt: new Date()
    };
    await db.collection('restaurants').doc(id).set(doc);

    // إشعار فوري للوحة المدير
    const io = req.app.get('socketio');
    if (io) {
      const payload = { id, name: doc.name, phone: doc.phone, type: 'restaurant', date: new Date() };
      io.emit('new_partner_request', payload);
      io.to('manager_monitor').emit('new_partner_request', payload);
    }

    res.status(201).json({ success: true, id, message: 'تم إرسال مطعمك للإدارة — بانتظار الاعتماد ⏳' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* PATCH /api/restaurants/:id — تعديل بيانات المطعم
 *
 * كان `adminOnly`: مفتاح الإدارة وحده. فصاحب المطعم يرفع صورة واجهته
 * بنجاح ثم يُرفض عند حفظ الرابط — «رُفعت الصورة ولم تُحفظ». ولا يفهم
 * لماذا، لأن الرفض جاء من بابٍ لا يعرف أنه يقف أمامه.
 *
 * وهذا نفس العطل الذي أصلحناه في المنيو سابقاً («بصلاحية المالك لا
 * الإدارة») — ونجا هذا المسار منه لأنه لم يُختبر بيد صاحب مطعم.
 *
 * `needsIdentity` تُثبت الهوية، و`ownsRestaurant` تتحقق أن المطعم مطعمه
 * — بالاتجاهين: المطعم يعرف مالكه، والمستخدم يعرف مطعمه. والإدارة تمرّ
 * كما كانت (`req.isAdmin` أول سطر في `ownsRestaurant`).
 */
router.patch('/:id', needsIdentity, async (req, res) => {
  try {
    invalidate('restaurants:raw');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const ref = db.collection('restaurants').doc(String(req.params.id));
    const cur = await ref.get();
    if (!(await ownsRestaurant(db, req, req.params.id, cur.exists ? cur.data() : null))) {
      return res.status(403).json({ success: false, error: 'هذا المطعم ليس لك' });
    }
    if (!cur.exists) {
      const demo = demoRestaurants.find(r => r.id === req.params.id);
      if (demo) { await ref.set({ ...demo, ...req.body, id: demo.id, status: 'approved' }); return res.json({ success: true, created: true }); }
      return res.status(404).json({ success: false, error: 'المطعم غير موجود' });
    }
    const body = { ...req.body };
    delete body.status; delete body.id; // الحالة يغيرها المدير فقط

    // إحداثيات المطعم تُحدّد أجرة التوصيل، فلا تُقبل قيمة غير منطقية.
    // نخزّنها رقمين عاديين lat/lng لا GeoPoint: الأخير يخرج من Firestore
    // باسمي _latitude/_longitude فلا يجدهما التطبيق — تُحفظ ولا تُقرأ.
    for (const k of ['lat', 'lng']) {
      if (body[k] === undefined) continue;
      const v = Number(body[k]);
      if (!Number.isFinite(v)) {
        return res.status(400).json({ success: false, error: `قيمة ${k} غير صحيحة` });
      }
      body[k] = v;
    }
    if (body.lat !== undefined || body.lng !== undefined) {
      const lat = body.lat, lng = body.lng;
      if (lat === undefined || lng === undefined) {
        return res.status(400).json({ success: false, error: 'يجب إرسال lat و lng معاً' });
      }
      // حدود فلسطين تقريباً — تمنع نقرة خاطئة على طرف الخريطة من نقل
      // المطعم إلى قارة أخرى فتصير أجرة التوصيل بالآلاف.
      if (lat < 29 || lat > 34 || lng < 33.5 || lng > 36.5) {
        return res.status(400).json({
          success: false,
          error: 'الموقع خارج فلسطين — تأكد من النقطة على الخريطة'
        });
      }
    }

    await ref.update(body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/restaurants/:id/menu — إضافة وجبة
router.post('/:id/menu', needsIdentity, async (req, res) => {
  try {
    invalidate('restaurants:raw');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const ref = db.collection('restaurants').doc(String(req.params.id));
    const snap = await ref.get();
    let base = snap.exists ? snap.data() : demoRestaurants.find(r => r.id === req.params.id);
    if (!base) return res.status(404).json({ success: false, error: 'المطعم غير موجود' });
    if (!(await ownsRestaurant(db, req, req.params.id, snap.exists ? base : null))) {
      return res.status(403).json({ success: false, error: 'هذا المطعم ليس لك' });
    }
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'اسم الوجبة مطلوب' });
    const price = Number(b.price);
    if (!Number.isFinite(price) || price < 0 || price > 10000) {
      return res.status(400).json({ success: false, error: 'سعر غير صالح' });
    }
    // حقول معلومة فقط — لا نشر لجسم الطلب داخل المنيو
    const item = {
      id:          String(b.id || ('item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6))),
      name:        name.slice(0, 120),
      price:       Math.round(price * 100) / 100,
      description: String(b.description || '').slice(0, 400),
      emoji:       String(b.emoji || '🍽️').slice(0, 8),
      category:    String(b.category || '').slice(0, 60),
      imageUrl:    String(b.imageUrl || '').slice(0, 500),
      available:   b.available === undefined ? true : !!b.available
    };
    const menu = Array.isArray(base.menu) ? base.menu.slice() : [];
    if (menu.some(m => String(m.id) === item.id)) {
      return res.status(409).json({ success: false, error: 'وجبة بهذا المعرّف موجودة' });
    }
    menu.push(item);
    await ref.set({ ...base, menu }, { merge: true });
    res.status(201).json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/restaurants/:id/menu/:itemId — تعديل وجبة (سعر/توفر/وصف)
router.patch('/:id/menu/:itemId', needsIdentity, async (req, res) => {
  try {
    invalidate('restaurants:raw');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const ref = db.collection('restaurants').doc(String(req.params.id));
    const snap = await ref.get();
    let base = snap.exists ? snap.data() : demoRestaurants.find(r => r.id === req.params.id);
    if (!base) return res.status(404).json({ success: false, error: 'المطعم غير موجود' });
    if (!(await ownsRestaurant(db, req, req.params.id, snap.exists ? base : null))) {
      return res.status(403).json({ success: false, error: 'هذا المطعم ليس لك' });
    }
    const menu = Array.isArray(base.menu) ? base.menu.slice() : [];
    const idx = menu.findIndex(m => String(m.id) === String(req.params.itemId));
    if (idx === -1) return res.status(404).json({ success: false, error: 'الوجبة غير موجودة' });
    /* حقول معلومة فقط. نشر req.body كاملاً كان يسمح بحقن أي حقل في
       الوجبة — بما فيها حقول يقرأها التسعير — أو بإفساد شكل المنيو. */
    const patch = {};
    if (req.body.name        !== undefined) patch.name        = String(req.body.name).slice(0, 120);
    if (req.body.description !== undefined) patch.description = String(req.body.description).slice(0, 400);
    if (req.body.emoji       !== undefined) patch.emoji       = String(req.body.emoji).slice(0, 8);
    if (req.body.category    !== undefined) patch.category    = String(req.body.category).slice(0, 60);
    if (req.body.imageUrl    !== undefined) patch.imageUrl    = String(req.body.imageUrl).slice(0, 500);
    if (req.body.available   !== undefined) patch.available   = !!req.body.available;
    if (req.body.price       !== undefined) {
      const p = Number(req.body.price);
      if (!Number.isFinite(p) || p < 0 || p > 10000) {
        return res.status(400).json({ success: false, error: 'سعر غير صالح' });
      }
      patch.price = Math.round(p * 100) / 100;   // قرشان لا أكثر
    }
    menu[idx] = { ...menu[idx], ...patch, id: menu[idx].id };
    await ref.set({ ...base, menu }, { merge: true });
    res.json({ success: true, item: menu[idx] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/restaurants/:id/menu/:itemId — حذف وجبة
router.delete('/:id/menu/:itemId', needsIdentity, async (req, res) => {
  try {
    invalidate('restaurants:raw');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const ref = db.collection('restaurants').doc(String(req.params.id));
    const snap = await ref.get();
    let base = snap.exists ? snap.data() : demoRestaurants.find(r => r.id === req.params.id);
    if (!base) return res.status(404).json({ success: false, error: 'المطعم غير موجود' });
    if (!(await ownsRestaurant(db, req, req.params.id, snap.exists ? base : null))) {
      return res.status(403).json({ success: false, error: 'هذا المطعم ليس لك' });
    }
    const menu = (Array.isArray(base.menu) ? base.menu : []).filter(m => String(m.id) !== String(req.params.itemId));
    await ref.set({ ...base, menu }, { merge: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/restaurants/:id — حذف مطعم (للمدير)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    invalidate('restaurants:raw');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    await db.collection('restaurants').doc(String(req.params.id)).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/restaurants/:id/approve — اعتماد المطعم من المدير
router.post('/:id/approve', adminOnly, async (req, res) => {
  try {
    invalidate('restaurants:raw');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    await db.collection('restaurants').doc(String(req.params.id)).update({ status: 'approved', isActive: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/restaurants/:id/location — يحدّد صاحب المطعم موقعه بنفسه.
 *
 * لماذا مسار منفصل عن PATCH /:id العام؟
 * ذاك مفتوح على كل الحقول (السعر، العمولة، الاعتماد) فبقي للإدارة وحدها.
 * وهذا يقبل حقلين اثنين فقط — lat وlng — ولا شيء غيرهما مهما أُرسل،
 * فلا يستطيع صاحب مطعم أن يعتمد نفسه أو يغيّر عمولته من هنا.
 *
 * ولماذا يُسمح له أصلاً؟ لأنه أدرى بباب محلّه من أي أحد، والموقع الخاطئ
 * يعني مندوباً يدور ويأجرة توصيل محسوبة على مسافة ليست الحقيقية.
 *
 * الشرط: أن يكون هو المالك (ownerId) — أو الإدارة.
 */
router.patch('/:id/location', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });

    const lat = Number(req.body && req.body.lat);
    const lng = Number(req.body && req.body.lng);
    // حدود فلسطين — دبوس خارجها خطأ إدخال لا موقع مطعم
    if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
        lat < 29 || lat > 34 || lng < 33.5 || lng > 36.5) {
      return res.status(400).json({ success: false, error: 'إحداثيات غير صالحة' });
    }

    const ref = db.collection('restaurants').doc(String(req.params.id));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'المطعم غير موجود' });

    if (!(await ownsRestaurant(db, req, req.params.id, doc.data()))) {
      return res.status(403).json({ success: false, error: 'لا تملك صلاحية تعديل موقع هذا المطعم' });
    }

    invalidate('restaurants:raw');
    await ref.update({
      lat: Math.round(lat * 100000) / 100000,
      lng: Math.round(lng * 100000) / 100000,
      locationSetAt: new Date(),
      locationSetBy: req.isAdmin ? 'admin' : 'owner'
    });
    res.json({ success: true, lat, lng });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/restaurants/:id/open — يفتح صاحب المطعم محلّه أو يغلقه.
 *
 * لماذا مسار منفصل؟ لأن PATCH /:id العام يفتح كل الحقول — العمولة والاعتماد
 * والأسعار — فبقي للإدارة وحدها. وكان صاحب المطعم يضغط مفتاح «مغلق» فيردّ
 * السيرفر 403 ويبتلعه التطبيق بصمت: يرى المفتاح أحمر على شاشته والمطعم
 * مفتوح فعلاً، فتصله طلبات وهو مقفل، أو يظنّ نفسه مقفلاً فيتجاهلها.
 *
 * هنا حقل واحد فقط — isOpen — ولمالك المطعم أو الإدارة.
 */
router.patch('/:id/open', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });

    const isOpen = req.body && req.body.isOpen;
    if (typeof isOpen !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isOpen يجب أن يكون true أو false' });
    }

    const ref = db.collection('restaurants').doc(String(req.params.id));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'المطعم غير موجود' });

    if (!(await ownsRestaurant(db, req, req.params.id, doc.data()))) {
      return res.status(403).json({ success: false, error: 'لا تملك صلاحية تغيير حالة هذا المطعم' });
    }

    invalidate('restaurants:raw');
    await ref.update({ isOpen, openChangedAt: new Date() });

    // نُعلم الزبائن فوراً: مطعم أُغلق يجب أن يختفي من قوائمهم بلا انتظار
    const io = req.app.get('socketio');
    if (io) io.emit('restaurant_status_changed', { id: String(req.params.id), isOpen });

    res.json({ success: true, isOpen });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/restaurants/:id/freeze — تجميد المطعم
router.post('/:id/freeze', adminOnly, async (req, res) => {
  try {
    invalidate('restaurants:raw');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    await db.collection('restaurants').doc(String(req.params.id)).update({ status: 'frozen', isActive: false });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
