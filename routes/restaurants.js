const express = require('express');
const router = express.Router();

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

router.get('/', async (req, res) => {
    try {
          const db = getDb(req);
          const snapshot = await db.collection('restaurants').get();
          const restaurants = [];
          snapshot.forEach(doc => {
                  restaurants.push({ id: doc.id, ...doc.data() });
          });

      // دمج المطاعم الأساسية مع المسجلة، وإخفاء غير المعتمدة عن الزبائن
      const showAll = req.query.all === '1' || req.query.all === 'true';
      const visible = showAll
        ? restaurants
        : restaurants.filter(r => !r.status || r.status === 'approved');
      const ids = new Set(visible.map(r => String(r.id)));
      const merged = visible.concat(demoRestaurants.filter(d => !ids.has(String(d.id))));

      res.json({ success: true, count: merged.length, restaurants: merged, city: 'نابلس' });
    } catch (error) {
          res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
          const db = getDb(req);
          const doc = await db.collection('restaurants').doc(req.params.id).get();
          if (!doc.exists) {
                  // Fallback check in demoData
            const demo = demoRestaurants.find(r => r.id === req.params.id);
                  if (demo) return res.json({ success: true, restaurant: demo });
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
router.post('/', async (req, res) => {
  try {
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

// PATCH /api/restaurants/:id — تعديل بيانات المطعم
router.patch('/:id', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const ref = db.collection('restaurants').doc(String(req.params.id));
    if (!(await ref.get()).exists) {
      const demo = demoRestaurants.find(r => r.id === req.params.id);
      if (demo) { await ref.set({ ...demo, ...req.body, id: demo.id, status: 'approved' }); return res.json({ success: true, created: true }); }
      return res.status(404).json({ success: false, error: 'المطعم غير موجود' });
    }
    const body = { ...req.body };
    delete body.status; delete body.id; // الحالة يغيرها المدير فقط
    await ref.update(body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/restaurants/:id/menu — إضافة وجبة
router.post('/:id/menu', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const ref = db.collection('restaurants').doc(String(req.params.id));
    const snap = await ref.get();
    let base = snap.exists ? snap.data() : demoRestaurants.find(r => r.id === req.params.id);
    if (!base) return res.status(404).json({ success: false, error: 'المطعم غير موجود' });
    const item = req.body || {};
    if (!item.name) return res.status(400).json({ success: false, error: 'اسم الوجبة مطلوب' });
    item.id = item.id || ('item_' + Date.now());
    if (item.available === undefined) item.available = true;
    const menu = Array.isArray(base.menu) ? base.menu.slice() : [];
    menu.push(item);
    await ref.set({ ...base, menu }, { merge: true });
    res.status(201).json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/restaurants/:id/menu/:itemId — تعديل وجبة (سعر/توفر/وصف)
router.patch('/:id/menu/:itemId', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const ref = db.collection('restaurants').doc(String(req.params.id));
    const snap = await ref.get();
    let base = snap.exists ? snap.data() : demoRestaurants.find(r => r.id === req.params.id);
    if (!base) return res.status(404).json({ success: false, error: 'المطعم غير موجود' });
    const menu = Array.isArray(base.menu) ? base.menu.slice() : [];
    const idx = menu.findIndex(m => String(m.id) === String(req.params.itemId));
    if (idx === -1) return res.status(404).json({ success: false, error: 'الوجبة غير موجودة' });
    menu[idx] = { ...menu[idx], ...req.body, id: menu[idx].id };
    await ref.set({ ...base, menu }, { merge: true });
    res.json({ success: true, item: menu[idx] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/restaurants/:id/menu/:itemId — حذف وجبة
router.delete('/:id/menu/:itemId', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const ref = db.collection('restaurants').doc(String(req.params.id));
    const snap = await ref.get();
    let base = snap.exists ? snap.data() : demoRestaurants.find(r => r.id === req.params.id);
    if (!base) return res.status(404).json({ success: false, error: 'المطعم غير موجود' });
    const menu = (Array.isArray(base.menu) ? base.menu : []).filter(m => String(m.id) !== String(req.params.itemId));
    await ref.set({ ...base, menu }, { merge: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/restaurants/:id — حذف مطعم (للمدير)
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    await db.collection('restaurants').doc(String(req.params.id)).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/restaurants/:id/approve — اعتماد المطعم من المدير
router.post('/:id/approve', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    await db.collection('restaurants').doc(String(req.params.id)).update({ status: 'approved', isActive: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/restaurants/:id/freeze — تجميد المطعم
router.post('/:id/freeze', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    await db.collection('restaurants').doc(String(req.params.id)).update({ status: 'frozen', isActive: false });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
