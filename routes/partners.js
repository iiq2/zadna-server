const express = require('express');
const router = express.Router();

const getDb = (req) => req.app.get('db');
/** اعتماد الشركاء وتجميدهم وتوليد الأكواد — للإدارة وحدها. */
const adminOnly = (req, res, next) => {
  const fn = req.app.get('requireAdmin');
  return fn ? fn(req, res, next) : next();
};
const { cached, invalidate } = require('../utils/cache');
// عدّاد القراءات — قراءةٌ لا تُحصى تجعل مقياس الحصة يكذب، والمقياس
// الذي لا يُصدَّق أسوأ من غياب المقياس.
const meter = require('../utils/meter');
// 5 دقائق: أي اعتماد أو تجميد أو تسجيل جديد يُبطل الكاش فوراً.
const PARTNERS_TTL = 300000;

// ==============================
// أكواد الشركاء الأحادية (partner_codes)
// الكود نفسه = document ID (يمنع التكرار تلقائياً)
// ==============================

// POST /api/partner_codes — توليد كود جديد من لوحة المدير
router.post('/partner_codes', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const { type, code } = req.body || {};
    /* `market` نوعٌ ثالث — والسوبرماركت شريك في نفس مجموعة المطاعم
     * بحقل `partnerType='market'`، فيرث الطلبات والمحفظة والشات
     * والإشعارات والفتح والإغلاق بلا سطر إضافي. الكود وحده يميّزه،
     * ليعرف السيرفر ماذا يُنشئ عند التسجيل. */
    if (!['driver', 'restaurant', 'market'].includes(type)) {
      return res.status(400).json({ success: false, error: 'نوع الشريك غير صحيح' });
    }
    const prefix = type === 'driver' ? 'ZADNA-DRV'
                 : type === 'market' ? 'ZADNA-MKT'
                 : 'ZADNA-RST';
    const finalCode = String(code || (prefix + '-' + Math.floor(1000 + Math.random() * 9000))).toUpperCase().trim();
    const ref = db.collection('partner_codes').doc(finalCode);
    const existing = await ref.get();
    if (existing.exists) {
      return res.status(409).json({ success: false, error: 'هذا الكود موجود سابقاً' });
    }
    await ref.set({
      code: finalCode,
      type,
      isUsed: false,
      usedBy: null,
      createdAt: new Date()
    });
    res.status(201).json({ success: true, code: finalCode, type });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/partner_codes — قائمة الأكواد وحالتها
//
// ⛔ كان هذا المسار مفتوحاً للإنترنت كله. من يفتح الرابط يحصل على الأكواد
// غير المستعملة ويسجّل نفسه مندوباً في زادنا — أي أن نظام «لا تسجيل إلا
// بكود»، وهو حجر الأساس في معرفة من يحمل بضاعتك ونقودك، كان يسقط برابط
// واحد. ويكشف أيضاً أرقام هواتف من استعمل كل كود.
router.get('/partner_codes', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json([]);
    const snapshot = await db.collection('partner_codes').get();
    const codes = [];
    snapshot.forEach(doc => codes.push(doc.data()));
    codes.sort((a, b) => ((b.createdAt && b.createdAt._seconds) || 0) - ((a.createdAt && a.createdAt._seconds) || 0));
    res.json(codes);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/partner_codes/:code — حذف/إبطال كود
router.delete('/partner_codes/:code', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    await db.collection('partner_codes').doc(String(req.params.code).toUpperCase()).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==============================
// الشركاء المسجلون (من users الحقيقية)
// استعلامان بسيطان بدون orderBy => لا حاجة لفهرس مركب
// ==============================

// GET /api/registered_partners
// كان يكشف أسماء كل شركائك وهواتفهم وإيميلاتهم لأي زائر.
router.get('/registered_partners', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json([]);
    const partners = await cached('partners:all', PARTNERS_TTL, async () => {
      const list = [];

      /* ============================================================
         نوع المحلّ — مطعم أم سوبرماركت.

         السوبرماركت يُسجَّل حسابه بنوع `restaurant` عمداً: يرث الطلبات
         والمحفظة والشات والفتح والإغلاق بلا تكرار أي مسار. والفرق كلّه
         على مستند محلّه بحقل `partnerType`.

         وبدون هذه القراءة تعرض لوحتك «🏠 مطعم شريك» لصاحب ماركت،
         فتعتمده وأنت تظنّه مطعماً، ثم لا تفهم لماذا لا يظهر في تبويب
         المطاعم عند الزبون — لأنه ليس مطعماً، وللماركت تبويبه.

         نقرأ المحلّات مرّة واحدة لا مرّة لكل شريك: الحلقة داخل الحلقة
         تعني قراءةً لكل شريك في كل تحديث للوحة، وحصّة Firestore خمسون
         ألفاً في اليوم.
         ============================================================ */
      const kindOf = {};
      try {
        const rs = await db.collection('restaurants').get();
        rs.forEach(d => { kindOf[d.id] = String((d.data() || {}).partnerType || 'restaurant'); });
        meter.addReads(rs.size, 'أنواع المحلّات');
      } catch (e) {
        console.warn('⚠️ تعذّرت قراءة أنواع المحلّات:', e.message);
      }

      for (const t of ['driver', 'restaurant']) {
        const snap = await db.collection('users').where('userType', '==', t).get();
        snap.forEach(doc => {
          const u = doc.data();
          list.push({
            id: doc.id,
            name: u.name || '',
            phone: u.phone || '',
            email: u.email || '',
            type: t,
            // للمندوب يبقى فارغاً — لا محلّ له
            partnerType: t === 'restaurant' ? (kindOf[String(u.ownedRestaurantId || '')] || 'restaurant') : '',
            ownedRestaurantId: u.ownedRestaurantId || '',
            status: u.status || 'approved',
            date: (u.createdAt && u.createdAt._seconds) ? new Date(u.createdAt._seconds * 1000).toLocaleString('ar-EG') : ''
          });
        });
      }
      return list;
    });
    res.json(partners);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/registered_partners/approve
router.post('/registered_partners/approve', adminOnly, async (req, res) => {
  try {
    invalidate('partners:all');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'id مطلوب' });
    await db.collection('users').doc(String(id)).update({ status: 'approved' });

    /* ============================================================
       واعتماد المحلّ نفسه — لا حساب صاحبه وحده.

       هذا العطل كان يعمل بصمت تامّ، وهو أسوأ ما وجدتُه اليوم:

       التسجيل يُنشئ مستندين لا واحداً — حساب المستخدم في `users`،
       ومستند المحلّ في `restaurants` بـ`status:'pending'` و`isOpen:false`
       (server.js:590). وكان هذا المسار يعتمد الأول ويترك الثاني.

       فماذا يرى كلٌّ من الأطراف الثلاثة؟
         · **أنت** في اللوحة: «معتمد ✅ ومفعّل» — لأن الجدول يقرأ `users`
         · **الشريك**: يدخل تطبيقه ويعمل، ويرى لوحته، ولا يأتيه طلب واحد
         · **الزبون**: لا يرى المحلّ إطلاقاً — `nearest` يفلتر بـ`status`
           على مستند المحلّ، و`isOpen !== false` كذلك

       ولا شاشة في المنصّة كلّها تقول إنّ شيئاً ناقص. الرسالة التي تظهر
       لك بعد الضغط تقول حرفياً «يقدر يفتح التطبيق ويشتغل هلق» — وهي
       غير صحيحة.

       وهذا ما كان يحدث فعلاً: ماركتان مسجّلان، حسابا صاحبيهما معتمدان
       في لوحتك منذ يومين، و`nearest` يردّ `approved: 0` — أي أنّ زادنا
       مارت كان مغلقاً أمام كل زبون في نابلس، وشريكان أدخلا بضاعتهما
       وينتظران عملاً لن يأتي.

       و`isOpen: true` عمداً: أُنشئ `false` عند التسجيل، ومن يُعتمَد اليوم
       يريد أن يعمل اليوم. ويبقى المفتاح بيده يُغلق متى شاء من تطبيقه.
       ============================================================ */
    try {
      const uDoc = await db.collection('users').doc(String(id)).get();
      const shopId = String(((uDoc.data() || {}).ownedRestaurantId) || '');
      if (shopId) {
        await db.collection('restaurants').doc(shopId)
          .update({ status: 'approved', isActive: true, isOpen: true });
        // الكاشات الثلاثة التي تُخفي المحلّ حتى تنتهي مُددها
        invalidate('restaurants:raw', 'markets:list', 'mart:all');
        console.log('🏪 فُتح المحلّ مع صاحبه:', shopId);
      }
    } catch (e) {
      /* لا نُسقط اعتماد الحساب لأن المحلّ تعثّر — لكن لا نبتلع الخبر:
       * حسابٌ معتمد ومحلٌّ مغلق هو بالضبط الحالة التي أخفت العطل شهراً. */
      console.error('⚠️ اعتُمد الحساب ولم يُفتح محلّه:', id, e.message);
    }

    // بلا هذين السطرين يبقى الاعتماد حبيس اللوحة: الشريك لا يعلم أنه اعتُمد
    // حتى يُغلق تطبيقه ويفتحه، وكاش الحالة يظل يردّه دقيقةً كاملة.
    const clr = req.app.get('clearStatusCache'); if (clr) clr(String(id));
    const io0 = req.app.get('socketio');
    if (io0) io0.emit('partner_status_changed', { id: String(id), status: 'approved', note: '' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ============================================================
   POST /api/registered_partners/reconcile_shops
   إصلاح مَن اعتُمد حسابه قبل هذا التصحيح ومحلّه ما زال مغلقاً.

   الإصلاح أعلاه يمنع تكرار العطل، ولا يُداوي مَن وقع فيه: شريكان
   اعتُمدا بالمسار القديم يبقيان محجوبين إلى الأبد، وزرّ «موافقة» لا
   يظهر لهما أصلاً لأن اللوحة تراهما معتمدين — فلا سبيل يدوياً لفتحهما.

   ولا يفتح هذا المسار محلّاً لم تعتمده أنت: يمرّ على أصحاب الحسابات
   المعتمدة وحدهم. أي أنّه يُنفّذ قرارك أنت الذي لم يُنفَّذ كاملاً.
   ============================================================ */
router.post('/registered_partners/reconcile_shops', adminOnly, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });

    const users = await db.collection('users').where('userType', '==', 'restaurant').get();
    const fixed = [], already = [], orphan = [];

    for (const u of users.docs) {
      const d = u.data() || {};
      if (String(d.status || 'approved') !== 'approved') continue;   // لم تعتمده — لا نتجاوزك
      const shopId = String(d.ownedRestaurantId || '');
      if (!shopId) { orphan.push({ user: u.id, name: d.name || '' }); continue; }

      const shop = await db.collection('restaurants').doc(shopId).get();
      if (!shop.exists) { orphan.push({ user: u.id, shopId, سبب: 'مستند المحلّ مفقود' }); continue; }
      const s = shop.data() || {};

      if (String(s.status || 'approved') === 'approved' && s.isOpen !== false) {
        already.push({ shopId, name: s.name || '' });
        continue;
      }
      await db.collection('restaurants').doc(shopId)
        .update({ status: 'approved', isActive: true, isOpen: true });
      fixed.push({ shopId, name: s.name || '', نوع: s.partnerType || 'restaurant' });
    }

    invalidate('restaurants:raw', 'markets:list', 'mart:all', 'partners:all');
    console.log(`🔧 مصالحة المحلّات: فُتح ${fixed.length}، سليم ${already.length}، يتيم ${orphan.length}`);
    res.json({ success: true, فُتِح: fixed, كان_سليماً: already, بلا_محلّ: orphan });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ============================================================
   مصير المحلّ يتبع مصير صاحبه — في كل الأزرار لا في الاعتماد وحده.

   جولة الفحص كشفت أنّ عطل الاعتماد الذي أُصلح الليلة مكرَّرٌ بعينه
   في التجميد والرفض والحذف: كلّها تكتب على `users/{id}` وحده، بينما
   الزبون والطلبات وأقرب ماركت تقرأ من مستند المحلّ في `restaurants`.

   فماذا كان يحدث عند «تجميد مؤقت ⛔»؟ حساب الشريك يُجمَّد فعلاً —
   يُحجب بـ403 عن كل نداء — لكن محلّه يبقى `approved` ومفتوحاً: يظهر
   لكل زبون ويستقبل الطلبات، وصاحبه **ممنوعٌ حتى من رفضها**. فيعلق
   الطلب عشرين دقيقة ثم يُلغى تلقائياً، والزبون ينتظر طعاماً لن يُطبخ،
   والشريك يُتَّهم بإهمال طلبات لم يُسمح له برؤيتها.

   والرفض النهائي أسوأ: شريك أنهيتَ تعاونه يبقى محلّه يبيع باسم زادنا.
   والحذف أسوأهما: محلٌّ حيّ بلا مالك — واجهة تقبل طلبات لا أحد يفتحها.

   هذه الدالة الواحدة تُغلق الباب في المواضع الأربعة: كل حكم على
   الحساب يسري على المحلّ في نفس السطر، وتُمحى الكاشات الأربعة التي
   كانت تُبقي المحلّ ظاهراً دقائق بعد «فوراً».
   ============================================================ */
async function syncShopWithOwner(req, db, userId, patch) {
  try {
    const uDoc = await db.collection('users').doc(String(userId)).get();
    const shopId = String(((uDoc.data() || {}).ownedRestaurantId) || '');
    if (!shopId) return null;                       // مندوب أو زبون — لا محلّ له
    await db.collection('restaurants').doc(shopId).update({ ...patch, statusAt: new Date() });
    invalidate('restaurants:raw', 'markets:list', 'mart:all', 'partners:all');
    return shopId;
  } catch (e) {
    /* لا نُسقط الحكم على الحساب لأن المحلّ تعثّر — لكن نصرخ:
     * حسابٌ محكوم ومحلٌّ طليق هو بالضبط العطل الذي نسدّه. */
    console.error('⚠️ حُكم على الحساب ولم يُمسّ محلّه:', userId, e.message);
    return null;
  }
}

// POST /api/registered_partners/reject
router.post('/registered_partners/reject', adminOnly, async (req, res) => {
  try {
    invalidate('partners:all');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'id مطلوب' });
    const note = (req.body && req.body.note) || '';
    await db.collection('users').doc(String(id)).update({ status: 'rejected', statusNote: note, statusAt: new Date() });
    // المحلّ يُوقف مع صاحبه — لا واجهة تبيع باسم شريكٍ أنهيتَ تعاونه
    await syncShopWithOwner(req, db, id, { status: 'rejected', isActive: false, isOpen: false, statusNote: note });
    const clr = req.app.get('clearStatusCache'); if (clr) clr(String(id));
    const io = req.app.get('socketio');
    if (io) io.emit('partner_status_changed', { id: String(id), status: 'rejected', note });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/registered_partners/freeze — تجميد مؤقت
router.post('/registered_partners/freeze', adminOnly, async (req, res) => {
  try {
    invalidate('partners:all');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'id مطلوب' });
    const note = (req.body && req.body.note) || '';
    await db.collection('users').doc(String(id)).update({ status: 'frozen', statusNote: note, statusAt: new Date() });
    // «لن يستقبل طلبات حتى تفكّ التجميد» — الآن صادقة: المحلّ يُغلق معه
    await syncShopWithOwner(req, db, id, { status: 'frozen', isActive: false, isOpen: false, statusNote: note });
    // أبلغ الشريك فوراً عبر السوكت
    const clr = req.app.get('clearStatusCache'); if (clr) clr(String(id));
    const io = req.app.get('socketio');
    if (io) io.emit('partner_status_changed', { id: String(id), status: 'frozen', note });
    res.json({ success: true, status: 'frozen' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/registered_partners/unfreeze — فك التجميد (يرجع معتمد)
router.post('/registered_partners/unfreeze', adminOnly, async (req, res) => {
  try {
    invalidate('partners:all');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'id مطلوب' });
    await db.collection('users').doc(String(id)).update({ status: 'approved', statusNote: '', statusAt: new Date() });
    // فكّ التجميد يفتح المحلّ كما أغلقه التجميد — بابٌ واحد للاثنين
    await syncShopWithOwner(req, db, id, { status: 'approved', isActive: true, isOpen: true, statusNote: '' });
    const clr = req.app.get('clearStatusCache'); if (clr) clr(String(id));
    const io = req.app.get('socketio');
    if (io) io.emit('partner_status_changed', { id: String(id), status: 'approved', note: '' });
    res.json({ success: true, status: 'approved' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/registered_partners/delete
router.post('/registered_partners/delete', adminOnly, async (req, res) => {
  try {
    invalidate('partners:all');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'id مطلوب' });

    /* ترتيب السطور هنا مقصود ولا يُقلب:
     *
     * ١) المحلّ أولاً — الدالة تقرأ `ownedRestaurantId` من مستند
     *    المستخدم، فلو حُذف المستند أولاً ضاع الرابط إلى المحلّ
     *    للأبد وبقي حيّاً بلا مالك: واجهة تقبل طلبات لا أحد يفتحها.
     *    (لا نحذف مستند المحلّ نفسه: فيه تاريخ طلبات ومال — يُوقف
     *    ويبقى للسجلّ، والحذف النهائي للبيانات قرارك بيدك.)
     *
     * ٢) ثم حذف الحساب.
     *
     * ٣) ثم `clearStatusCache` — وهذا سدّ الثغرة الأخطر في الفحص:
     *    توكن المحذوف يبقى صالحاً ٩٠ يوماً، وفحص الحظر كان يقول
     *    «لا مانع» عن حسابٍ لا وجود له (أُصلح في server.js ليحظر)،
     *    لكن الكاش كان يحفظ «لا مانع» الأخيرة دقيقةً كاملة — تكفي
     *    مندوباً محذوفاً ليقبل طلباً ويُحصّل كاش زبونه. */
    const shopId = await syncShopWithOwner(req, db, id,
      { status: 'rejected', isActive: false, isOpen: false, statusNote: 'حُذف حساب صاحبه' });
    await db.collection('users').doc(String(id)).delete();
    const clr = req.app.get('clearStatusCache'); if (clr) clr(String(id));
    const io = req.app.get('socketio');
    if (io) io.emit('partner_status_changed', { id: String(id), status: 'rejected', note: 'حُذف الحساب' });
    res.json({ success: true, closedShop: shopId || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/registered_partners — التطبيق يبلّغ عن شريك جديد (توافقية)
router.post('/registered_partners', async (req, res) => {
  try {
    invalidate('partners:all');
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'Database not connected' });
    const b = req.body || {};
    const io = req.app.get('socketio');
    if (io) {
      const payload = { id: b.id || null, name: b.name || '', phone: b.phone || '', type: b.type || b.userType || 'driver', date: new Date() };
      io.emit('new_partner_request', payload);
      io.to('manager_monitor').emit('new_partner_request', payload);
    }
    res.status(200).json({ success: true, message: 'تم استلام الطلب' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/partner_codes/:code/verify — التحقق من صلاحية الكود قبل التسجيل
router.get('/partner_codes/:code/verify', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json({ valid: false, error: 'Database not connected' });
    const snap = await db.collection('partner_codes').doc(String(req.params.code).toUpperCase().trim()).get();
    if (!snap.exists) return res.json({ valid: false, error: 'كود الاعتماد غير صحيح ❌' });
    const c = snap.data();
    if (c.isUsed) return res.json({ valid: false, error: 'هذا الكود مستخدم سابقاً ❌' });
    res.json({ valid: true, type: c.type });
  } catch (error) {
    res.json({ valid: false, error: error.message });
  }
});

// GET /api/partner_status?phone=... أو ?id=... — حالة الشريك (للتحقق من التجميد بالتطبيق)
router.get('/partner_status', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json({ status: 'approved' });
    const { phone, id, email } = req.query;
    let data = null;
    if (id) {
      const d = await db.collection('users').doc(String(id)).get();
      if (d.exists) data = d.data();
    } else if (phone || email) {
      /* الرقم يُطبَّع قبل البحث — وهذا آخر موضع بقي بمطابقة حرفية.
       *
       * طبّعنا الرقم في فلتر الطلبات وفي `notifyCustomer`، ونسيناه هنا.
       * فصاحب مطعمٍ حُفظ رقمه `0599…` ويرسل تطبيقه `+970599…` لا يُطابَق،
       * فيردّ السيرفر ٤٠٤ «المستخدم غير موجود»، وتظهر له لافتة صفراء
       * تقول «تعذّر التحقق من حالة حسابك مع الإدارة» — وحسابه سليم
       * معتمَد يعمل. تحذيرٌ كاذب يُقلق شريكاً لا ذنب له.
       *
       * نجرّب المُطبَّع أولاً ثم الخام — كما في `notifyCustomer` تماماً. */
      if (phone) {
        const { normPhone } = require('../utils/phone');
        const raw = String(phone);
        const norm = normPhone(raw) || raw;
        let snap = await db.collection('users').where('phone', '==', norm).limit(1).get();
        if (snap.empty && norm !== raw) {
          snap = await db.collection('users').where('phone', '==', raw).limit(1).get();
        }
        if (!snap.empty) data = snap.docs[0].data();
      } else {
        const snap = await db.collection('users').where('email', '==', String(email)).limit(1).get();
        if (!snap.empty) data = snap.docs[0].data();
      }
    }
    if (!data) return res.status(404).json({ status: 'unknown', error: 'المستخدم غير موجود' });
    const status = data.status || 'approved';
    res.json({
      status,
      statusNote: data.statusNote || '',
      isFrozen: status === 'frozen',
      isRejected: status === 'rejected',
      isPending: status === 'pending',
      canWork: status === 'approved'
    });
  } catch (error) {
    res.status(500).json({ status: 'unknown', error: error.message });
  }
});

// GET /api/top_driver — أفضل مندوب لليوم (إعفاء من العمولة يوم واحد)
// نسبة إعفاء أفضل مندوب — نفس المتغير المستخدم في المحفظة
// لا إعفاء مالي لأفضل مندوب — الجائزة عرض اسمه فقط (قرار الإدارة).

router.get('/top_driver', async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json({ topDriverId: null, deliveries: 0, date: null });
    const start = new Date(); start.setHours(0, 0, 0, 0);
    // تطبيق المندوب يستطلع هذا المسار؛ بلا كاش كان كل نداء يقرأ
    // مجموعة الطلبات كاملة من كل جهاز.
    const docs = await cached('top_driver:delivered', 300000, async () => {
      const snap = await db.collection('orders').where('status', '==', 'DELIVERED').get();
      const out = [];
      snap.forEach(d => out.push(d.data()));
      return out;
    });
    const counts = {};
    docs.forEach(o => {
      const ts = o.createdAt && o.createdAt._seconds ? new Date(o.createdAt._seconds * 1000) : null;
      if (!ts || ts < start) return;
      const drvId = (o.driver && (o.driver.id || o.driver.phone || o.driver.name)) || o.driverId;
      if (!drvId) return;
      const key = String(drvId);
      if (!counts[key]) counts[key] = { id: key, name: (o.driver && o.driver.name) || key, deliveries: 0 };
      counts[key].deliveries++;
    });
    const list = Object.values(counts).sort((a, b) => b.deliveries - a.deliveries);
    const top = list[0] || null;
    res.json({
      topDriverId: top ? top.id : null,
      topDriverName: top ? top.name : null,
      deliveries: top ? top.deliveries : 0,
      // الجائزة الأساسية عرض الاسم؛ الإعفاء المالي حسب النسبة المضبوطة
      commissionExempt: false,
      waiverRate: 0,
      period: 'اليوم',
      date: start.toISOString().slice(0, 10),
      leaderboard: list.slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
