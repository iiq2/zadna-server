const fs = require('fs');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const Joi = require('joi');
// كاش مشترك — يحمي حصة Firestore المجانية (٥٠ ألف قراءة/يوم)
const { cached, invalidate } = require('./utils/cache');
const meter = require('./utils/meter');

/* ============================================================
   ردّ الخطأ للمستخدم.

   ثلاث علل كانت في كل مسار:

   ١) «حدث خطأ داخلي في السيرفر» — جملة تقنية باردة. الزبون يقرؤها
      وهو يحاول التسجيل أول مرة، فلا يفهم ما جرى ولا ماذا يفعل،
      فيحذف التطبيق ولا يعود. وهذا أول ما يلمسه كل مستخدم جديد.

   ٢) وأسوأ: أحدها كان يُرسل `error.message` حرفياً — أي تفاصيل
      قاعدة بياناتنا الداخلية إلى أي أحد يجرّب التسجيل. من يقرؤها
      يعرف ما نستعمل وأين نتعثّر، وهي نصف طريق المهاجم.

   ٣) ولا تُفرّق بين «عندنا خلل» و«الخدمة مضغوطة الآن». والفرق
      يهمّ المستخدم: الأولى لا يفعل حيالها شيئاً، والثانية تكفيها
      إعادة محاولة بعد دقيقة.

   القاعدة: المستخدم يرى سبباً بالعربية وخطوة يفعلها، والتفصيل
   الكامل يُسجَّل عندنا. لا نُخفي المعلومة، بل نضعها عند من يقرؤها.
   ============================================================ */
function failJson(res, error, what) {
  const msg = String((error && error.message) || '');
  const code = (error && error.code);
  // 8 = RESOURCE_EXHAUSTED · 14 = UNAVAILABLE · 4 = DEADLINE_EXCEEDED
  const busy = code === 8 || code === 14 || code === 4
    || /RESOURCE_EXHAUSTED|Quota exceeded|UNAVAILABLE|DEADLINE_EXCEEDED/i.test(msg);

  console.error(`❌ ${what}:`, msg);

  if (busy) {
    return res.status(503).json({
      success: false, busy: true,
      error: 'الخدمة مضغوطة الآن — أعد المحاولة بعد دقيقة',
    });
  }
  return res.status(500).json({
    success: false,
    error: 'تعذّر إتمام العملية — أعد المحاولة، وإن تكرّر تواصل معنا',
  });
}

dotenv.config();

// إنشاء تطبيق Express
const app = express();
// تُشارَك مع المسارات في routes/ — رسالة واحدة في كل المنصّة، لا لهجات
app.set('failJson', failJson);
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.set('socketio', io);

// =====================
// Middleware
// =====================
app.use(cors());
// جسم الطلب محدود بـ 256 كيلوبايت: لا حاجة لأكثر في أي مسار عندنا،
// وبلا حدّ يستطيع أحدهم إرسال جسم بحجم ميغابايتات فيخنق ذاكرة السيرفر.
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

/* ============================================================
   حدّ معدّل الطلبات — مكتوب هنا بلا حزمة خارجية عن قصد:
   كل حزمة جديدة خطر على النشر، والسيرفر نسخة واحدة على Render
   فالعدّ في الذاكرة كافٍ ودقيق.

   كان لا يوجد أي حدّ إطلاقاً:
     · تخمين كلمات المرور بلا مانع
     · سكربت واحد يستهلك حصة Firestore (50 ألف قراءة) في دقائق
       فتتوقف المنصة كلها — وهي حصة تصارعها أصلاً
   ============================================================ */
const _hits = new Map();
setInterval(() => {                      // كنس دوري كي لا تكبر الخريطة بلا حد
  const now = Date.now();
  for (const [k, v] of _hits) if (now > v.reset) _hits.delete(k);
}, 60000).unref();

function rateLimit({ windowMs, max, key = 'g', message }) {
  return (req, res, next) => {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
            || req.socket.remoteAddress || 'unknown';
    const id = key + ':' + ip;
    const now = Date.now();
    let e = _hits.get(id);
    if (!e || now > e.reset) { e = { count: 0, reset: now + windowMs }; _hits.set(id, e); }
    e.count++;
    if (e.count > max) {
      const secs = Math.ceil((e.reset - now) / 1000);
      res.set('Retry-After', String(secs));
      console.warn('⏱️ تجاوز الحدّ:', id, req.method, req.originalUrl);
      return res.status(429).json({
        success: false,
        error: message || `طلبات كثيرة جداً — حاول بعد ${secs} ثانية`
      });
    }
    next();
  };
}

// تسجيل الدخول والتسجيل: الهدف منع تخمين كلمات المرور
app.use(['/api/auth/login', '/api/auth/register', '/api/auth/google'],
  rateLimit({ windowMs: 300000, max: 20, key: 'auth',
              message: 'محاولات دخول كثيرة — انتظر خمس دقائق' }));

// إنشاء الطلبات: زبون حقيقي لا يرسل أكثر من بضعة طلبات في الدقيقة
app.use('/api/orders',
  (req, res, next) => req.method === 'POST'
    ? rateLimit({ windowMs: 60000, max: 10, key: 'neworder' })(req, res, next)
    : next());

// فحص كود الانضمام: الصيغة ZADNA-DRV-XXXX أربعة أرقام = 9000 احتمال فقط.
// بلا حدّ ضيّق يُخمَّن الكود كله في دقائق ويصير المخمِّن مندوباً عندك.
// 10 محاولات في الساعة تكفي أي شريك حقيقي وتجعل التخمين مستحيلاً عملياً.
app.use('/api/partner_codes',
  (req, res, next) => /\/verify$/.test(req.path)
    ? rateLimit({ windowMs: 3600000, max: 10, key: 'verify',
                  message: 'محاولات كثيرة — تواصل مع إدارة زادنا للحصول على كودك' })(req, res, next)
    : next());

// سقف عام يحمي حصة Firestore من الاستنزاف.
//
// 600/دقيقة = 10 طلبات في الثانية من عنوان واحد. رقم مرتفع عن قصد: شبكات
// الجوال في فلسطين تضع مشتركين كثيرين خلف عنوان واحد (CGNAT)، فحدّ ضيّق
// يقطع الخدمة عن زبائن أبرياء. السكربت المُسيء يتجاوز هذا الرقم بأضعاف.
app.use('/api', rateLimit({ windowMs: 60000, max: 600, key: 'all' }));

// =====================
// Firebase Configuration
// =====================

let db;

try {
  console.log('🔑 جاري الاتصال بـ Firebase...');

  let serviceAccount;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // If running on Render/Production with Environment Variable
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('✅ Using Firebase Service Account from Environment Variable');
  } else {
    // If running locally with file
    serviceAccount = require('./firebase-key.json');
    console.log('✅ Using Firebase Service Account from local file');
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  db = admin.firestore();
  app.set('db', db);

  console.log('✅ Firestore Database متصل ومفعل برمجياً');

} catch (error) {
  console.error('❌ خطأ Firebase:', error.message);
  console.log('📝 تشغيل في وضع Demo بدون Database');
  db = null;
}

// =====================
// Validation Schemas
// =====================

const registerSchema = Joi.object({
  name: Joi.string().required().min(3).max(50),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^(059|056|050|052|053|054|055|058)[0-9]{7}$/).required().messages({
    'string.pattern.base': 'رقم الجوال غير صالح ❌ — يجب أن يكون 10 أرقام ويبدأ بـ 059 (جوال) أو 056 (وطنية) أو رقم إسرائيلي صحيح (050/052/053/054/055/058)'
  }),
  password: Joi.string().required().min(6),
  userType: Joi.string().valid('customer', 'driver', 'restaurant', 'manager').required(),
  adminCode: Joi.string().optional().allow(''),
  // النسخ القديمة من التطبيق ترسل نصاً فارغاً لغير المطاعم، وJoi يرفضه
  // افتراضياً فيفشل تسجيل كل زبون ومندوب. نقبله ونعامله كـ null.
  ownedRestaurantId: Joi.string().optional().allow(null, '')
});

const loginSchema = Joi.object({
  email: Joi.string().required(), // Relaxed to allow master IDs like 'boss'
  password: Joi.string().required()
});

// =====================
// Helper Functions
// =====================

const JWT_SECRET_ACTIVE = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) console.warn('⚠️ JWT_SECRET غير مضبوط - تم توليد مفتاح مؤقت (التوكنات تنتهي عند إعادة التشغيل)');

function generateToken(userId, userType) {
  return jwt.sign(
    { userId, userType },
    JWT_SECRET_ACTIVE,
    // 90 يوماً: تطبيقات التوصيل تُبقي المستخدم داخلاً لأشهر. سبعة أيام
    // كانت تجبره على كتابة بريده وكلمة سره كل أسبوع بلا سبب.
    { expiresIn: process.env.TOKEN_DAYS ? process.env.TOKEN_DAYS + 'd' : '90d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET_ACTIVE);
  } catch (error) {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'لا يوجد توثيق - مطلوب Token' });
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, error: 'التوثيق غير صالح أو منتهي' });
  }
  
  req.user = decoded;
  next();
}

/**
 * توثيق مرن: يقبل توكن مستخدم صالح أو مفتاح إدارة.
 * سبب المرونة أن لوحة المدير تطبيق سطح مكتب لا يسجّل دخولاً بتوكن،
 * بينما التطبيقات تستعمل التوكن. الاثنان يحتاجان نفس المسارات.
 *
 * ADMIN_KEY يُضبط من متغيرات البيئة على Render. إن لم يُضبط،
 * يُسمح بمرور طلبات الإدارة مؤقتاً مع تحذير في السجل — كي لا تتوقف
 * لوحتك فجأة قبل أن تضبط المفتاح.
 */
const ADMIN_KEY = process.env.ADMIN_KEY || '';

/* ============================================================
   حالة الحساب الحيّة — قلب التجميد الفوري.

   كان التجميد يُفحص عند تسجيل الدخول وحده، والتوكن يعيش 90 يوماً.
   فالمندوب الذي تجمّده اليوم يواصل استقبال الطلبات وتحصيل الكاش من
   الزبائن ثلاثة أشهر، لأنه لن يسجّل دخولاً جديداً أبداً. زرّ التجميد
   في لوحتك كان يقول «تم» ولا يفعل شيئاً — وهذا أسوأ أنواع الأعطال:
   أداة سيطرة تبدو أنها تعمل.

   الآن تُفحص الحالة عند كل طلب. والكاش (60 ثانية) ضروري: بدونه
   يصير كل نداء قراءةً من Firestore فتُلتهم الحصة المجانية.
   ============================================================ */
const _statusCache = new Map();   // userId -> { status, at }
const STATUS_TTL = 60000;

async function accountBlockedReason(userId) {
  if (!userId || !db) return null;
  const hit = _statusCache.get(userId);
  if (hit && (Date.now() - hit.at) < STATUS_TTL) return hit.reason;

  let reason = null;
  try {
    const snap = await db.collection('users').doc(String(userId)).get();
    meter.addReads(1, 'سجلّ المستخدم');
    if (snap.exists) {
      const u = snap.data() || {};
      if (u.isFrozen === true || u.status === 'frozen') {
        reason = 'حسابك مجمّد من الإدارة ⛔ تواصل معنا لإعادة التفعيل';
      } else if (u.isRejected === true || u.status === 'rejected') {
        reason = 'تم رفض حسابك من الإدارة ❌';
      } else if (u.status === 'pending' && (u.userType === 'driver' || u.userType === 'restaurant')) {
        reason = 'حسابك قيد المراجعة — بانتظار موافقة الإدارة ⏳';
      }
    }
  } catch (e) {
    // تعذّرت القراءة: لا نُسقط الخدمة ولا نمنع مستخدماً سليماً بسبب عطل شبكة
    console.warn('⚠️ تعذّر فحص حالة الحساب:', userId, e.message);
    return null;
  }
  _statusCache.set(userId, { reason, at: Date.now() });
  return reason;
}

/** تُنادى بعد كل تجميد/رفض/اعتماد ليسري المفعول في نفس اللحظة لا بعد دقيقة. */
function clearStatusCache(userId) {
  if (userId) _statusCache.delete(String(userId)); else _statusCache.clear();
}
app.set('clearStatusCache', clearStatusCache);

/* سجلّ المستخدم مُكاشاً — تحتاجه المسارات لتعرف نطاق صاحب الطلب
   (هاتفه، مطعمه) فتفرضه بنفسها بدل أن تصدّق ما يرسله التطبيق. */
const _userCache = new Map();
const USER_TTL = 120000;
async function loadUser(userId) {
  if (!userId || !db) return null;
  const hit = _userCache.get(userId);
  if (hit && (Date.now() - hit.at) < USER_TTL) return hit.user;
  try {
    const snap = await db.collection('users').doc(String(userId)).get();
    meter.addReads(1, 'سجلّ المستخدم');
    const user = snap.exists ? { id: snap.id, ...snap.data() } : null;
    _userCache.set(userId, { user, at: Date.now() });
    return user;
  } catch (e) {
    console.warn('⚠️ تعذّرت قراءة سجلّ المستخدم:', userId, e.message);
    return null;
  }
}
app.set('loadUser', loadUser);

function requireIdentity(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  if (ADMIN_KEY && adminKey === ADMIN_KEY) { req.isAdmin = true; return next(); }
  if (!ADMIN_KEY && adminKey) {
    console.warn('⚠️ ADMIN_KEY غير مضبوط على السيرفر — طلب إدارة مرّ بلا تحقق:', req.method, req.originalUrl);
    req.isAdmin = true; return next();
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    // نسجّل سبب الرفض؛ بدونه يفشل الطلب بصمت ولا نعرف أهو غياب توكن أم بطلانه
    console.warn('🔒 رفض بلا توكن:', req.method, req.originalUrl,
                 '| Authorization:', req.headers.authorization ? 'موجود لكن بصيغة خاطئة' : 'غير مرسل');
    return res.status(401).json({ success: false, error: 'مطلوب تسجيل دخول لتنفيذ هذه العملية' });
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    console.warn('🔒 توكن مرفوض:', req.method, req.originalUrl, '| طوله:', token.length);
    return res.status(401).json({ success: false, error: 'انتهت جلستك — سجّل دخولك من جديد' });
  }
  req.user = decoded;

  // حساب المدير من متغيّرات البيئة ليس في مجموعة users — لا حالة تُفحص له
  if (decoded.userId === 'admin_root') { req.isAdmin = true; return next(); }

  accountBlockedReason(decoded.userId)
    .then(reason => {
      if (reason) {
        console.warn('⛔ حساب موقوف حاول العمل:', decoded.userId, '|', req.method, req.originalUrl);
        return res.status(403).json({ success: false, error: reason, accountBlocked: true });
      }
      next();
    })
    .catch(() => next());   // عطل في الفحص لا يمنع مستخدماً سليماً
}

/** عمليات لا يجوز إلا للإدارة: التسويات، الأسعار، الاعتماد والتجميد. */
function requireAdmin(req, res, next) {
  requireIdentity(req, res, () => {
    if (req.isAdmin) return next();
    return res.status(403).json({ success: false, error: 'هذه العملية للإدارة فقط' });
  });
}

app.set('requireIdentity', requireIdentity);
app.set('requireAdmin', requireAdmin);

const demoUsers = [];

// =====================
// Routes - Authentication
// =====================

/**
 * POST /api/auth/register
 * شو يسويه: تسجيل مستخدم جديد
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('📝 طلب تسجيل جديد من:', req.body.email);

    // نطبّع الحقول الاختيارية قبل التحقق
    if (req.body && typeof req.body.ownedRestaurantId === 'string' && !req.body.ownedRestaurantId.trim()) {
      req.body.ownedRestaurantId = null;
    }
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { name, email, phone, password, userType, adminCode, ownedRestaurantId } = value;

    // Security Guard: Check Secret Codes for Partners
    const CODES = {
      driver: process.env.CODE_DRIVER,
      restaurant: process.env.CODE_RESTAURANT,
      manager: process.env.CODE_MANAGER
    };

    const isPartner = (userType === 'driver' || userType === 'restaurant');
    const envCodeOk = CODES[userType] && adminCode === CODES[userType];

    // المدير: فقط عبر كود البيئة
    if (userType === 'manager' && !envCodeOk) {
      return res.status(403).json({ success: false, error: 'كود تفعيل الإدارة غير صحيح.' });
    }
    // الشريك: يلزمه كود اعتماد من المدير (أو كود بيئة احتياطي)
    if (isPartner && !envCodeOk && (!db || !adminCode)) {
      return res.status(403).json({ success: false, error: 'كود الاعتماد مطلوب — اطلبه من إدارة زادنا 🔑' });
    }

    // إذا كان Firebase متصل
    if (db) {
      const existingUser = await db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (!existingUser.empty) {
        return res.status(400).json({
          success: false,
          error: 'البريد الإلكتروني موجود بالفعل - جرب تسجيل دخول'
        });
      }

      // حرق كود الاعتماد ذرياً (Transaction) — يمنع استخدامه مرتين
      if (isPartner && !envCodeOk) {
        const codeRef = db.collection('partner_codes').doc(String(adminCode).toUpperCase().trim());
        try {
          await db.runTransaction(async (t) => {
            const snap = await t.get(codeRef);
            if (!snap.exists) throw new Error('كود الاعتماد غير صحيح ❌');
            const c = snap.data();
            if (c.isUsed) throw new Error('هذا الكود مستخدم سابقاً ❌ اطلب كوداً جديداً من الإدارة');
            if (c.type !== userType) throw new Error('هذا الكود مخصص لنوع شريك آخر ❌');
            t.update(codeRef, { isUsed: true, usedBy: phone || email, usedAt: new Date() });
          });
        } catch (txErr) {
          return res.status(403).json({ success: false, error: txErr.message });
        }
      }

      const hashedPassword = await bcryptjs.hash(password, 10);

      const newUser = {
        name,
        email,
        phone,
        userType,
        ownedRestaurantId: ownedRestaurantId || null,
        password: hashedPassword,
        createdAt: new Date(),
        profileImage: '',
        rating: 5,
        isActive: true,
        walletBalance: 0,
        addresses: [],
        ...(isPartner ? { status: 'pending', joinCode: String(adminCode || '').toUpperCase() } : {})
      };

      const docRef = await db.collection('users').add(newUser);
      const userId = docRef.id;

      // صاحب المطعم: أنشئ مطعمه تلقائياً واربطه بحسابه
      let createdRestId = null;
      if (userType === 'restaurant' && ownedRestaurantId && String(ownedRestaurantId).trim()) {
        try {
          const restName = String(ownedRestaurantId).trim();
          createdRestId = 'rest_' + Date.now();
          await db.collection('restaurants').doc(createdRestId).set({
            id: createdRestId,
            name: restName,
            description: 'مطعم شريك على منصة زادنا',
            phone: phone,
            ownerId: userId,
            ownerEmail: email,
            emoji: '🍽️',
            rating: 5,
            deliveryTime: 25,
            deliveryFee: 5,
            categories: [],
            menu: [],
            commission: '10%',
            status: 'pending',
            isActive: false,
            isOpen: false,
            createdAt: new Date()
          });
          await db.collection('users').doc(userId).update({ ownedRestaurantId: createdRestId });
          console.log('🏠 مطعم جديد بانتظار الاعتماد:', restName, createdRestId);
        } catch (e) {
          console.error('تعذر إنشاء المطعم:', e.message);
        }
      }

      // إشعار فوري للوحة المدير بطلب انضمام جديد
      if (isPartner) {
        const ioRT = req.app.get('socketio');
        if (ioRT) {
          ioRT.emit('new_partner_request', { id: userId, name, phone, type: userType, date: new Date() });
          ioRT.to('manager_monitor').emit('new_partner_request', { id: userId, name, phone, type: userType, date: new Date() });
        }
      }

      const token = generateToken(userId, userType);

      console.log('✅ تم تسجيل:', email, '- ID:', userId);

      return res.status(201).json({
        success: true,
        message: isPartner ? 'تم التسجيل! حسابك قيد المراجعة — بانتظار موافقة الإدارة ⏳' : 'تم التسجيل بنجاح - مرحباً بك في زادنا!',
        token,
        user: {
          id: userId,
          name,
          email,
          phone,
          userType,
          ownedRestaurantId: createdRestId || newUser.ownedRestaurantId,
          restaurantName: userType === 'restaurant' ? String(ownedRestaurantId || '').trim() : null
        }
      });

    } else {
      // وضع Demo
      const existingUser = demoUsers.find(u => u.email === email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'البريد الإلكتروني موجود بالفعل (Demo Mode)'
        });
      }

      const hashedPassword = await bcryptjs.hash(password, 10);
      
      const newUser = {
        id: 'demo_' + Date.now(),
        name,
        email,
        phone,
        userType,
        ownedRestaurantId: ownedRestaurantId || null,
        password: hashedPassword,
        rating: 5,
        isActive: true,
        walletBalance: 0,
        createdAt: new Date()
      };

      demoUsers.push(newUser);
      const token = generateToken(newUser.id, newUser.userType);

      console.log('✅ تم تسجيل (Demo):', email);

      return res.status(201).json({
        success: true,
        message: 'تم التسجيل بنجاح (Demo Mode)',
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          userType: newUser.userType,
          ownedRestaurantId: createdRestId || newUser.ownedRestaurantId,
          restaurantName: userType === 'restaurant' ? String(ownedRestaurantId || '').trim() : null
        }
      });
    }

  } catch (error) {
    /* الرسالة الداخلية لم تعد تُرسَل للمستخدم — كانت تكشف تفاصيلنا
       لأي أحد يجرّب التسجيل. المستخدم يرى عربية، ونحن نرى التفصيل. */
    return failJson(res, error, 'التسجيل');
  }
});

/**
 * POST /api/auth/google
 * دخول أو تسجيل بحساب جوجل.
 *
 * التطبيق يرسل توكن فايربيز، والسيرفر يتحقق منه بالمفتاح السرّي الموجود عنده
 * أصلاً — فلا يستطيع أحد انتحال هوية بإرسال بريد إلكتروني فقط.
 *
 * الزبائن فقط: الكباتن والمطاعم يمرّون بكود اعتماد الشريك وموافقة الإدارة،
 * ولا يجوز أن يلتفّ أحد على ذلك بضغطة زر جوجل.
 */
app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) {
      return res.status(400).json({ success: false, error: 'توكن جوجل مفقود' });
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      console.warn('🔒 توكن جوجل مرفوض:', e.message);
      return res.status(401).json({ success: false, error: 'تعذّر التحقق من حساب جوجل — حاول مجدداً' });
    }

    const email = String(decoded.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, error: 'حساب جوجل بلا بريد إلكتروني' });
    }
    const name = decoded.name || email.split('@')[0];
    const picture = decoded.picture || null;

    if (!db) {
      return res.status(503).json({ success: false, error: 'قاعدة البيانات غير متصلة' });
    }

    // حساب موجود؟ ندخله. غير موجود؟ ننشئه كزبون.
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();

    let userId, userDoc;
    if (!snap.empty) {
      userId = snap.docs[0].id;
      userDoc = snap.docs[0].data();
      if (userDoc.isFrozen === true || userDoc.isRejected === true) {
        return res.status(403).json({ success: false, error: 'حسابك موقوف — تواصل مع إدارة زادنا' });
      }
    } else {
      const ref = await db.collection('users').add({
        name,
        email,
        phone: '',                 // يُطلب من الزبون عند أول طلب — لا نخترع رقماً
        userType: 'customer',
        profileImage: picture,
        authProvider: 'google',    // لا كلمة سر لهذا الحساب
        isActive: true,
        walletBalance: 0,
        createdAt: new Date()
      });
      userId = ref.id;
      userDoc = { name, email, phone: '', userType: 'customer', profileImage: picture };
      console.log('✅ حساب جديد بجوجل:', email);
    }

    const token = generateToken(userId, userDoc.userType || 'customer');
    return res.json({
      success: true,
      message: 'أهلاً بك في زادنا 👋',
      token,
      user: {
        id: userId,
        name: userDoc.name || name,
        email,
        phone: userDoc.phone || '',
        userType: userDoc.userType || 'customer',
        profileImage: userDoc.profileImage || picture,
        ownedRestaurantId: userDoc.ownedRestaurantId || null
      }
    });
  } catch (error) {
    return failJson(res, error, 'الدخول بجوجل');
  }
});

/**
 * POST /api/auth/login
 * شو يسويه: دخول مستخدم
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 طلب دخول من:', req.body.email);

    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { email, password } = value;

    // --- Admin Account (from environment variables only) ---
    const ADMIN_USER = process.env.ADMIN_USER;
    const ADMIN_PASS = process.env.ADMIN_PASS;
    if (ADMIN_USER && ADMIN_PASS && email === ADMIN_USER && password === ADMIN_PASS) {
      const token = generateToken('admin_root', 'manager');
      console.log('👑 دخول المدير من متغيرات البيئة');
      return res.json({
        success: true,
        message: 'تم الدخول بحساب المدير',
        token,
        user: {
          id: 'admin_root',
          name: 'المدير العام',
          email: ADMIN_USER + '@zadna.app',
          phone: '0590000000',
          userType: 'manager',
          ownedRestaurantId: null
        }
      });
    }

    /* ===== الدخول بالرقم أو بالبريد =====
     *
     * كان البحث بالبريد وحده. والمندوب في نابلس ينسى بريده وقد لا يملك
     * بريداً يستعمله أصلاً، بينما رقم جواله يحفظه عن ظهر قلب — وهو الرقم
     * نفسه الذي سجّله عندنا ونحاسبه عليه.
     *
     * كلمة السر تبقى كلمته هو، لا تمرّ عبر واتساب ولا يعرفها أحد سواه.
     */
    const idRaw = String(email || '').trim();
    // 059… أو 0568… أو بصيغة دولية +970 / 00972
    const digits = idRaw.replace(/[\s\-()]/g, '');
    const asLocalPhone =
      /^\+?9(70|72)\d{9}$/.test(digits) ? '0' + digits.replace(/^\+?9(70|72)/, '')
      : /^00 ?9(70|72)\d{9}$/.test(digits) ? '0' + digits.replace(/^00 ?9(70|72)/, '')
      : /^0\d{9}$/.test(digits) ? digits
      : null;

    // إذا كان Firebase متصل
    if (db) {
      let userSnapshot;
      if (asLocalPhone) {
        userSnapshot = await db.collection('users')
          .where('phone', '==', asLocalPhone)
          .limit(1)
          .get();
      } else {
        userSnapshot = await db.collection('users')
          .where('email', '==', idRaw)
          .limit(1)
          .get();
      }

      if (userSnapshot.empty) {
        return res.status(401).json({
          success: false,
          error: asLocalPhone
            ? 'رقم الجوال أو كلمة السر غير صحيحة'
            : 'البريد الإلكتروني أو كلمة السر غير صحيحة'
        });
      }

      const userDoc = userSnapshot.docs[0];
      const user = userDoc.data();
      const userId = userDoc.id;

      // حساب أُنشئ بجوجل لا يملك كلمة سر أصلاً. تمرير قيمة غير موجودة إلى
      // bcrypt يرمي استثناءً فيصير الرد خطأ 500 بلا معنى، والمستخدم يظن أنه
      // نسي كلمة سره ويذهب لاستعادتها — وهي غير موجودة أصلاً.
      if (!user.password || user.authProvider === 'google') {
        return res.status(409).json({
          success: false,
          error: 'هذا الحساب مسجّل بحساب جوجل — استخدم زر «الدخول بحساب جوجل» بالأسفل',
          authProvider: 'google'
        });
      }

      const isPasswordValid = await bcryptjs.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'البريد الإلكتروني أو كلمة السر غير صحيحة'
        });
      }

      // فحص حالة الشريك (المستخدمون القدامى بدون status يمرون عادي)
      if (user.userType === 'driver' || user.userType === 'restaurant') {
        if (user.status === 'rejected') {
          return res.status(403).json({ success: false, error: 'تم رفض طلب انضمامك من الإدارة ❌' });
        }
        if (user.status === 'frozen') {
          return res.status(403).json({ success: false, error: 'حسابك مجمد مؤقتاً من الإدارة ⛔ تواصل معنا لإعادة التفعيل' });
        }
        if (user.status === 'pending') {
          return res.status(403).json({ success: false, error: 'حسابك قيد المراجعة — بانتظار موافقة الإدارة ⏳' });
        }
      }

      const token = generateToken(userId, user.userType);

      console.log('✅ تم دخول:', email);

      return res.json({
        success: true,
        message: 'مرحباً بعودتك إلى زادنا!',
        token,
        user: {
          id: userId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          userType: user.userType,
          ownedRestaurantId: user.ownedRestaurantId || null
        }
      });

    } else {
      // وضع Demo
      const user = demoUsers.find(u => u.email === email);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'المستخدم غير موجود (Demo)'
        });
      }

      const isValid = await bcryptjs.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: 'كلمة السر غير صحيحة'
        });
      }

      const token = generateToken(user.id, user.userType);

      console.log('✅ تم دخول (Demo):', email);

      return res.json({
        success: true,
        message: 'تم الدخول بنجاح (Demo Mode)',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          userType: user.userType,
          ownedRestaurantId: user.ownedRestaurantId || null
        }
      });
    }

  } catch (error) {
    return failJson(res, error, 'تسجيل الدخول');
  }
});

/**
 * GET /api/auth/profile
 */
app.get('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (db) {
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
      }
      let user = userDoc.data();
      delete user.password;

      return res.json({ 
        success: true, 
        user: { id: userId, ...user } 
      });
    } else {
      const user = demoUsers.find(u => u.id === userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'المستخدم غير موجود (Demo)' });
      }
      delete user.password;
      return res.json({ success: true, user });
    }

  } catch (error) {
    console.error('❌ خطأ:', error);
    return res.status(500).json({ success: false, error: 'حدث خطأ داخلي' });
  }
});

/**
 * PATCH /api/auth/profile
 * تحديث بيانات المستخدم لنفسه فقط (الاسم والهاتف).
 *
 * الداعي: من يدخل بحساب جوجل لا يصل معه رقم هاتف، فيضطر لكتابته في كل طلب.
 * نحفظه بعد أول طلب فلا يكتبه ثانية — والأهم أن يبقى رقم واحد ثابت في
 * حسابه، لأن اختلاف الرقم بين الطلبات يُربك المندوب ويُفسد سجل الزبون.
 *
 * لا يُسمح بتعديل userType ولا ownedRestaurantId ولا الرصيد من هنا:
 * تلك قرارات إدارة، ولو فُتحت للمستخدم لرقّى نفسه إلى مندوب أو مطعم.
 */
app.patch('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, phone } = req.body || {};

    const updates = {};
    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (typeof phone === 'string' && phone.trim()) {
      // نُطبّع الرقم قبل التحقق: الزبون قد يكتبه بصيغ كثيرة
      // (+970 / 00970 / +972 / 0592… / 592…) وكلها لنفس الجوال.
      // تخزينها كما كُتبت يعني أن نفس الزبون يظهر برقمين مختلفين.
      let p = phone.trim().replace(/[\s-]/g, '');
      p = p.replace(/^(\+?970|00970|\+?972|00972)/, '');
      if (!p.startsWith('0')) p = '0' + p;

      // القاعدة نفسها المستعملة في التطبيق (PhoneValidator):
      // 059/056 فلسطينية، و050/052/053/054/058 إسرائيلية يستعملها كثيرون
      // في الضفة. السيرفر لا يجوز أن يكون أضيق من التطبيق، وإلا قَبِل الطلب
      // ورفض حفظ رقم صاحبه — فيبقى الزبون بلا رقم في حسابه بلا سبب ظاهر.
      if (!/^05[0234689]\d{7}$/.test(p)) {
        return res.status(400).json({ success: false, error: 'رقم الجوال غير صحيح' });
      }
      updates.phone = p;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'لا يوجد ما يُحدَّث' });
    }

    if (!db) return res.status(503).json({ success: false, error: 'قاعدة البيانات غير متصلة' });

    const ref = db.collection('users').doc(userId);
    if (!(await ref.get()).exists) {
      return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
    }
    await ref.update(updates);

    const fresh = (await ref.get()).data();
    delete fresh.password;
    return res.json({ success: true, user: { id: userId, ...fresh } });

  } catch (error) {
    return failJson(res, error, 'تحديث الحساب');
  }
});

// =====================
// Routes - Chats
// =====================

/**
 * POST /api/driver_chats
 */
/* ============================================================
   قواعد هوية الشات — تُفرض هنا، لا في التطبيق.

   كان هذا المسار مفتوحاً ويكتب `{...chatData}` كما وردت. أي شخص يرسل
   senderName: "📢 الإدارة" فينتحل شخصيتك أمام مناديبك ويأمرهم بما شاء.
   وقواعد الخصوصية التي وضعناها (الزبون بلا اسم، المندوب باسمه) كانت
   مكتوبة في التطبيق وحده — والتطبيق ليس حارساً، فمن يعدّله يتجاوزها.

   الآن السيرفر يشتقّ الاسم والدور من التوكن ويتجاهل ما يرسله العميل.
   ============================================================ */
async function chatIdentityOf(req) {
  if (req.isAdmin) return { senderId: 'admin_root', senderRole: 'manager', senderName: '📢 الإدارة' };
  const loadUser = req.app.get('loadUser');
  const me = loadUser ? await loadUser(req.user && req.user.userId) : null;
  if (!me) return null;
  const t = String(me.userType || 'customer');
  if (t === 'driver')     return { senderId: String(me.id), senderRole: 'driver',     senderName: (me.name || 'كابتن زادنا') };
  if (t === 'restaurant') return { senderId: String(me.id), senderRole: 'restaurant', senderName: (me.name || 'المطعم') };
  if (t === 'manager')    return { senderId: String(me.id), senderRole: 'manager',    senderName: '📢 الإدارة' };
  // الزبون بلا اسم — حمايةً لخصوصيته أمام المندوب وأمام أي قارئ لاحق للسجل
  return { senderId: String(me.id), senderRole: 'customer', senderName: 'الزبون' };
}

/* توحيد صيغة الهاتف قبل المقارنة.
 *
 * الرقم الواحد يُكتب عندنا بأربع صور: 0599123456 و +970599123456
 * و 00970599123456 و 059-912-3456. والمقارنة الحرفية تعتبرها أربعة
 * أشخاص. وهذا ما كان يمنع الزبون من دخول شات طلبه هو. */
function samePhone(a, b) {
  const norm = (p) => {
    let s = String(p || '').replace(/[\s\-()]/g, '');
    s = s.replace(/^\+?9(70|72)/, '0').replace(/^00 ?9(70|72)/, '0');
    return s;
  };
  const x = norm(a), y = norm(b);
  return !!x && x === y;
}
app.set('samePhone', samePhone);

/** هل لصاحب الطلب حقّ الدخول إلى هذه الغرفة؟ */
async function canAccessRoom(req, roomId) {
  if (req.isAdmin) return true;

  /* الهوية من التوكن أولاً، وسجلّ المستخدم إثراءٌ لا شرط.
     كان الاعتماد على قراءة السجلّ وحده يعني أن أي تعثّر — نفاد حصة
     Firestore، انقطاع لحظي، سجلّ لم يُنشأ بعد — يُقفل الشات في وجه
     المندوب وهو يرى الغرفة أمامه فيظن أن التطبيق تعطّل. والتوكن موقَّع
     ومُتحقَّق منه، فهو مصدر كافٍ للمعرّف والدور. */
  const tokenId   = String((req.user && req.user.userId) || '');
  const tokenType = String((req.user && req.user.userType) || '');
  if (!tokenId) return false;

  const loadUser = req.app.get('loadUser');
  const me = loadUser ? await loadUser(tokenId) : null;
  const myId = String((me && me.id) || tokenId);
  const myPhone = String((me && me.phone) || '');
  const myType = String((me && me.userType) || tokenType);

  // غرفة الإدارة الخاصة بمندوب: admin_driver_<معرّف المندوب>
  if (roomId.startsWith('admin_driver_')) {
    const key = roomId.slice('admin_driver_'.length);
    return key === myId || (myPhone && key === myPhone);
  }
  // الغرف العامة: للمناديب والإدارة فقط.
  //
  // لا بد من ذكر الأسماء الثلاثة جميعاً: التطبيق يفتح global_driver_chat
  // من زرّ «غرفة الكباتن»، واللوحة تبثّ عليها، بينما global_zadna_chat هي
  // القيمة الاحتياطية داخل ChatRepository. إغفال أيّها يردّ المندوب بـ403
  // على غرفة يراها أمامه ويظن أن الشات تعطّل.
  if (roomId === 'global_driver_chat' || roomId === 'global_zadna_chat' || roomId === 'manager_monitor') {
    /* لا نشترط أن يكون نوع الحساب «مندوب».
     *
     * كررتُ هنا خطأ فلترة الطلبات نفسه: من يعمل مندوباً بحسابٍ نوعه
     * «مطعم» — وهي حالتك، وحالة أي صاحب مطعم يوصّل بنفسه — كان يُردّ
     * بـ403 على غرفة الكباتن. فيرى الغرفة أمامه، ويكتب فيها فتصل
     * الإدارة، ولا يصله شيء أبداً. عطل باتجاه واحد يصعب تفسيره.
     *
     * الغرفة للشركاء لا للزبائن: من له حساب شريك يدخلها. */
    return myType === 'driver' || myType === 'restaurant' || myType === 'manager';
  }

  /* غرفة طلب: لا يدخلها إلا أطرافه.
   *
   * وحين نمنع، نقول في السجلّ لماذا. المنع الصامت هنا كلّف ساعات:
   * الزبون والمندوب يكتبان ولا تصل رسالة، والشاشة لا تُظهر سبباً،
   * فلا يُعرف أهو رقم هاتف مختلف عن المسجَّل، أم معرّف طلب لا يطابق
   * مستنده، أم حساب بلا هاتف أصلاً. سطرٌ واحد في السجلّ يحسم هذا. */
  try {
    if (!db) return false;
    const snap = await db.collection('orders').doc(roomId).get();
    if (!snap.exists) {
      console.warn(`🔒 شات: لا يوجد طلب بالمعرّف "${roomId}" — الطالب ${myId}/${myType}`);
      return false;
    }
    const o = snap.data() || {};
    const drv = (o.driver && typeof o.driver === 'object')
      ? String(o.driver.id || o.driver.phone || '') : String(o.driverId || '');
    if (drv && (drv === myId || samePhone(drv, myPhone))) return true;

    /* الزبون: بمعرّفه أولاً ثم برقمه.
     *
     * المطابقة بالرقم وحده كانت تكسر شات الزبون مع مندوبه: صفحة
     * الدفع تسمح بتعديل الرقم («تعديل ✏️»)، فمن كتب رقم زوجته أو
     * رقماً بصيغة أخرى صار — في نظر الحارس — شخصاً غريباً عن طلبه.
     * يكتب فلا تصل، ويكتب المندوب فلا يرى. المعرّف لا يتغيّر. */
    if (o.customerId && String(o.customerId) === myId) return true;
    if (samePhone(o.customerPhone, myPhone)) return true;

    if (me && me.ownedRestaurantId && String(o.restaurantId || '') === String(me.ownedRestaurantId)) return true;

    console.warn(
      `🔒 شات مرفوض · طلب ${roomId} · الطالب id=${myId} phone=${myPhone || '—'} type=${myType}` +
      ` · على الطلب: مندوب=${drv || '—'} زبون=${o.customerPhone || '—'} مطعم=${o.restaurantId || '—'}` +
      ` · مطعمي=${(me && me.ownedRestaurantId) || '—'}`
    );
    return false;
  } catch (e) {
    /* عجزنا عن الفحص ≠ ليس له حقّ.
     *
     * حين نفدت حصة Firestore اليوم، فشلت قراءة مستند الطلب، فأعاد
     * هذا السطر false، فقال السيرفر للزبون: «لا تملك صلاحية قراءة
     * هذه المحادثة». وهي جملة كاذبة: المحادثة محادثته، والعطل عندنا.
     *
     * نُميّز الحالتين الآن: المنع يبقى ٤٠٣، والعجز يصير ٥٠٣ برسالة
     * صادقة. أسوأ ما في العطل أن يتّهم صاحبَ الحقّ في حقّه. */
    console.warn(`🔒 شات: تعثّر فحص الصلاحية للطلب ${roomId} — ${e.message}`);
    const err = new Error('تعذّر التحقق');
    err.checkFailed = true;
    throw err;
  }
}

app.post('/api/driver_chats', requireIdentity, async (req, res) => {
  try {
    const db = req.app.get('db');
    const orderId = String((req.body && req.body.orderId) || 'global_zadna_chat');

    if (!(await canAccessRoom(req, orderId))) {
      return res.status(403).json({ success: false, error: 'لا تملك صلاحية الكتابة في هذه المحادثة' });
    }
    const who = await chatIdentityOf(req);
    if (!who) return res.status(403).json({ success: false, error: 'تعذّر التعرّف على حسابك' });

    const text = String((req.body && req.body.text) || '').slice(0, 2000).trim();
    if (!text) return res.status(400).json({ success: false, error: 'الرسالة فارغة' });

    if (db) {
      // نكتب حقولاً معلومة فقط — لا نشر لجسم الطلب، فلا يستطيع أحد
      // حقن حقول تُغيّر شكل المحادثة أو تنتحل هوية.
      /* الوقت نصاً بنفس صيغة مسار السوكت بالضبط.
       *
       * كنت أخزّنه هنا رقماً (Date.now) بينما السوكت يخزّنه نصاً
       * «04:29 ص». فنتج عطلان ظاهران للمستخدم:
       *   · يظهر الوقت في الشاشة هكذا: 1.785720442168E12
       *   · وتتكرّر كل رسالة مرتين، لأن التطبيق يمنع التكرار بمطابقة
       *     (النص + الوقت + الاسم) — واختلاف صيغة الوقت يجعله يظنّ
       *     النسختين رسالتين مختلفتين.
       * createdAt يبقى تاريخاً حقيقياً للترتيب. */
      await db.collection('chats').doc(orderId).collection('messages').add({
        orderId,
        text,
        senderId:   who.senderId,
        senderName: who.senderName,
        senderRole: who.senderRole,
        timestamp:  new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        createdAt:  new Date()
      });
      // الكاتب يرى رسالته فوراً — لا ينتظر انتهاء كاش الثواني الثماني
      invalidate(`chat:${orderId}`);
    }

    res.json({ success: true });
  } catch (error) {
    if (error && error.checkFailed) {
      return res.status(503).json({ success: false, busy: true,
        error: 'الخدمة مشغولة الآن — رسالتك لم تُرسَل، أعد المحاولة بعد قليل' });
    }
    return failJson(res, error, 'حفظ رسالة');
  }
});

/**
 * GET /api/driver_chats
 */
app.get('/api/driver_chats', requireIdentity, async (req, res) => {
  try {
    const db = req.app.get('db');
    const orderId = String(req.query.orderId || 'global_zadna_chat');

    // كان أي شخص يقرأ أي محادثة بمجرد معرفة رقم الطلب — والأرقام من ستّ خانات
    if (!(await canAccessRoom(req, orderId))) {
      return res.status(403).json({ success: false, error: 'لا تملك صلاحية قراءة هذه المحادثة' });
    }

    if (!db) return res.json([]);

    /* ============================================================
       هنا كانت تُستهلك الحصة كلّها.

       كان كل استطلاع يقرأ **المحادثة بأكملها** بلا حدّ ولا كاش.
       وفي Firestore تُحسب القراءة لكل مستند لا لكل استعلام: محادثة
       فيها ٥٠ رسالة = ٥٠ قراءة في كل مرّة.

       ولوحة الإدارة تستطلع كل ١٥ ثانية، والتطبيقات كل ٩٠. أي أن
       شاشة شات واحدة مفتوحة كانت تلتهم آلاف القراءات في الساعة،
       حتى نفدت الخمسون ألفاً اليومية — فتوقّف كل شيء: لا شات، ولا
       فحص حساب، ولا حتى صلاحية دخول الغرفة (فيُقرأ الرفض 403 وكأنه
       منع، وهو في الحقيقة عجزٌ عن القراءة).

       الحلّ في ملاحظة بسيطة: **لا أحد يكتب في المحادثة إلا عبرنا.**
       كل رسالة تمرّ بـ POST /api/driver_chats — من التطبيقات ومن
       اللوحة معاً. فما دام لا كاتب سوانا، لا داعي لأن نسأل قاعدة
       البيانات «هل تغيّر شيء؟» كل بضع ثوانٍ: نحن نعلم متى يتغيّر.

       فالكاش يعيش خمس دقائق، ويُمحى لحظة وصول رسالة جديدة. النتيجة:
       القراءة تحدث عند تغيّر حقيقي فقط، والاستطلاع الفارغ — وهو
       الغالبية الساحقة — لا يكلّف قراءة واحدة.

       ومعه حدّ ١٠٠ رسالة، فلا تكبر المحادثة الطويلة بلا سقف.
       ============================================================ */
    const CHAT_LIMIT = 100;
    const snapshot = await cached(`chat:${orderId}`, 300000, () =>
      db.collection('chats')
        .doc(orderId)
        .collection('messages')
        .orderBy('createdAt', 'desc')     // الأحدث أولاً كي يقتطع الحدّ الأقدم
        .limit(CHAT_LIMIT)
        .get()
    );

    // نُرفق معرّف المستند مع كل رسالة.
    //
    // بدونه لا يملك التطبيق وسيلة يقينية ليعرف أن الرسالة القادمة من
    // السيرفر هي نفسها التي عرضها عبر السوكت، فيقارن بالنص والوقت —
    // وأي اختلاف بسيط في صيغة الوقت يُظهر الرسالة مرّتين.
    const messages = [];
    snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
    meter.addReads(snapshot.size, 'المحادثات');
    // قرأناها من الأحدث للأقدم لنقتطع القديم؛ والتطبيق يعرضها بالترتيب
    // الزمني، فنعيدها إلى نصابها قبل الإرسال.
    messages.reverse();
    res.json(messages);
  } catch (error) {
    if (error && error.checkFailed) {
      return res.status(503).json({ success: false, busy: true,
        error: 'الخدمة مشغولة الآن — أعد المحاولة بعد قليل' });
    }
    return failJson(res, error, 'جلب المحادثة');
  }
});

// =====================
// Routes - Restaurants
// =====================
const restaurantsRouter = require('./routes/restaurants');
app.use('/api/restaurants', restaurantsRouter);

// =====================
// Routes - Orders
// =====================
const ordersRouter = require('./routes/orders');
app.use('/api/orders', ordersRouter);
// حارس الطلبات المعلّقة: مطعم لا يردّ لا يترك زبوناً ينتظر بلا نهاية
if (ordersRouter.startRestaurantTimeout) ordersRouter.startRestaurantTimeout(app);

const martRouter = require('./routes/mart');
app.use('/api/mart_products', martRouter);

// النسخة الاحتياطية — تُنزَّل على جهاز المدير، ولا تُحفظ على السيرفر
const backupRouter = require('./routes/backup');
app.use('/api/backup', backupRouter);

const partnersRouter = require('./routes/partners');
app.use('/api', partnersRouter);

const walletRouter = require('./routes/wallet');
app.use('/api', walletRouter);

const logsRouter = require('./routes/logs');
app.use('/api', logsRouter);

const zonesRouter = require('./routes/zones');
app.use('/api', zonesRouter);

const cleanupRouter = require('./routes/cleanup');
app.use('/api', cleanupRouter);

const reportsRouter = require('./routes/reports');
app.use('/api', reportsRouter);

const pushRouter = require('./routes/push');
app.use('/api', pushRouter);

/* ============================================================
   إبقاء السيرفر صاحياً.

   خطة Render المجانية تُنيم الخدمة بعد ١٥ دقيقة بلا حركة، وأول طلب
   بعدها ينتظر خمسين ثانية أو أكثر. لا تظهر هذه أثناء التطوير لأننا
   نضرب السيرفر كل دقيقة — لكن أول زبون صباحاً يفتح شاشة فارغة دقيقة
   كاملة، فيظن أن التطبيق معطّل.

   السيرفر يضرب نفسه عبر عنوانه العام (لا عبر localhost) — فيُحسب
   الطلب حركةً واردة ويبقى صاحياً.

   ملاحظة: الخطة المجانية تمنح ٧٥٠ ساعة شهرياً، والشهر ٧٢٠ ساعة —
   أي أن البقاء صاحياً على مدار الشهر يقع داخل الحدّ. وإن أضفت خدمة
   ثانية على نفس الحساب فستتقاسمان الساعات؛ عندها الترقية أسلم.
   ============================================================ */
const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || '';
if (SELF_URL && process.env.KEEP_AWAKE !== '0') {
  const PING_MS = 10 * 60 * 1000;   // ١٠ دقائق — أقلّ من مهلة النوم (١٥)
  setInterval(async () => {
    try {
      const r = await fetch(SELF_URL.replace(/\/$/, '') + '/api/health');
      if (!r.ok) console.warn('⏰ نبضة الإيقاظ ردّت', r.status);
    } catch (e) {
      console.warn('⏰ تعذّرت نبضة الإيقاظ:', e.message);
    }
  }, PING_MS).unref();
  console.log('⏰ الإيقاظ الذاتي مفعّل — نبضة كل ١٠ دقائق إلى', SELF_URL);
} else {
  console.log('⏰ الإيقاظ الذاتي معطّل (لا عنوان عام أو KEEP_AWAKE=0)');
}

// =====================
// Routes - General
// =====================

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  /* الاستهلاك في نفس شاشة الصحة.
   *
   * ضاعت ليلة كاملة ونحن نجهل أنّ استعلاماً واحداً يلتهم الحصة.
   * لم يكن العطل خفيّاً — كان **غير مرئي**: لا شاشة تقول «أنت تقرأ
   * ألفاً في الدقيقة»، فلا يُكتشف إلا حين يتوقّف كل شيء دفعة واحدة.
   *
   * وأنفع رقم هنا ليس ما استُهلك، بل **إلى أين تسير**: الإسقاط
   * اليومي بناءً على المعدّل الحالي. من يراه ٢٠٪ ينام مطمئناً،
   * ومن يراه ٣٠٠٪ يعرف قبل أن يقف. */
  const jwtOk = !!process.env.JWT_SECRET;
  res.json({
    status: '✅ الخادم يعمل بنجاح!',
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
    firebaseConnected: !!db,
    // الحقول التي تقرؤها لوحة الإدارة
    uptimeMinutes: Math.max(1, Math.round(process.uptime() / 60)),
    jwtConfigured: jwtOk,
    memoryMB: Math.round(process.memoryUsage().rss / 1048576),
    firestore: meter.stats(),
  });
});

/**
 * GET /api/app-info
 */
app.get('/api/app-info', (req, res) => {
  res.json({
    appName: '🚀 زادنا - Zadna Express',
    version: '1.2.0',
    city: 'نابلس',
    country: 'فلسطين 🇵🇸',
    supportPhone: process.env.SUPPORT_PHONE || '0593654276',
    founders: [
      'يزن حناوي'
    ],
    database: db ? 'Firebase Firestore' : 'Demo Mode',
    modules: ['Authentication', 'Restaurants', 'Orders', 'Management']
  });
});

// =====================
// Socket.io Events
// =====================
/* نقرأ التوكن من المصافحة ونعلّق الهوية على الاتصال نفسه.
   لا نرفض غير الموثَّق: التطبيق يتصل عند الإقلاع قبل الدخول، ويحتاج
   الاستماع للأحداث العامة. لكن أي فعل باسم أحد يتطلب هوية مثبتة. */
/* آخر موقع معروف لكل مندوب: معرّفه → { lat, lng, at }.
   في الذاكرة عن قصد — يتجدّد كل ثوانٍ ولا قيمة له بعد دقائق. */
const lastDriverLocation = new Map();
app.set('lastDriverLocation', lastDriverLocation);
setInterval(() => {                       // كنس: من انقطع منذ ١٠ دقائق لم يعد معروف الموقع
  const now = Date.now();
  for (const [k, v] of lastDriverLocation) if (now - v.at > 600000) lastDriverLocation.delete(k);
}, 300000).unref();

io.use((socket, next) => {
  try {
    const a = socket.handshake.auth || {};
    const q = socket.handshake.query || {};

    // لوحة المدير تطبيق سطح مكتب لا يسجّل دخولاً بتوكن، بل تُثبت هويتها
    // بمفتاح الإدارة — كما تفعل في نداءات HTTP. بدون هذا الفرع كان تعميم
    // المدير على المناديب يُرفض بصمت ولا يصل أحداً فوراً.
    const k = a.adminKey || q.adminKey;
    if (k && ADMIN_KEY && String(k) === ADMIN_KEY) {
      socket.data.user = { userId: 'admin_root', userType: 'manager' };
      return next();
    }

    const t = a.token || q.token;
    if (t) {
      const decoded = verifyToken(String(t));
      if (decoded) socket.data.user = decoded;
    }
  } catch (e) { /* اتصال بلا هوية — مسموح للاستماع فقط */ }
  next();
});

io.on('connection', (socket) => {
  console.log('✅ مستخدم متصل بـ Real-time:', socket.id,
              socket.data.user ? '| موثَّق: ' + socket.data.user.userId : '| بلا هوية');

  /* أُزيل المستمع order_status_update.
     لم يكن أي تطبيق يبثّه إطلاقاً (التطبيقات تمرّ عبر PATCH /orders/:id
     الذي يفحص الصلاحية ثم يبثّ بنفسه)، بينما كان يسمح لأي متصل بالسوكت
     أن يبثّ للناس كلهم أن طلباً صار جاهزاً أو تغيّرت حالته — إشعارات
     كاذبة لكل المناديب بلا أي تحقق. مستمع ميت وباب مفتوح في آن. */

  // تحديث موقع المندوب
  socket.on('driver_location_update', (data) => {
    // تطبيق المندوب يرسل lat/lng، وكان هذا المستمع يقرأ latitude/longitude
    // فقط — وهما غير موجودين في الرسالة، فيُبثّ الموقع فارغاً وترميه لوحة
    // المدير عند فحص الأرقام. النتيجة: لم يصل موقع حقيقي واحد إلى الخريطة
    // منذ بداية المشروع، وما كان يظهر عليها دبابيس مولّدة محلياً.
    // نقبل الاسمين معاً حتى لا ينكسر أي إصدار تطبيق قديم منصَّب على جوال.
    const lat = Number(data.lat != null ? data.lat : data.latitude);
    const lng = Number(data.lng != null ? data.lng : data.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn('⚠️ موقع مندوب بلا إحداثيات صالحة:', data && data.driverId);
      return;
    }
    // بلا هوية لا يُقبل موقع: وإلا بثّ أي شخص موقعاً باسم أي مندوب،
    // فتُظهر خريطتك مندوباً في مكان ليس فيه وتوزّع الطلبات على أساسه.
    const su = socket.data && socket.data.user;
    if (!su) { console.warn('🔒 موقع من اتصال بلا هوية — رُفض'); return; }
    // نتجاهل driverId المُرسل ونعتمد صاحب التوكن
    data = Object.assign({}, data, { driverId: String(su.userId) });

    /* نحفظ آخر موقع في الذاكرة.
     *
     * كان يُبثّ للوحة ويُنسى، فلا يعرف السيرفر أين المناديب حين يريد
     * توجيه طلب لأقربهم. الذاكرة تكفي هنا ولا نكتب في قاعدة البيانات:
     * الموقع يصل كل بضع ثوانٍ لكل مندوب، وكتابته تلتهم الحصة وحدها،
     * وهو بلا قيمة بعد دقائق أصلاً. */
    lastDriverLocation.set(String(su.userId), { lat, lng, at: Date.now() });
    console.log('📍 تحديث موقع المندوب:', data.driverId, lat, lng);
    /* للوحة الإدارة وحدها.
     *
     * كان io.emit — أي بثّ لكل متصل بالسيرفر: كل جوال زبون وكل مطعم
     * يستقبل موقع كل مندوب، كل بضع ثوانٍ. لا تطبيق يعرضه، لكن من
     * يفتح سوكتاً بنفسه يتتبّع مناديبك في الوقت الحقيقي — أين يعملون
     * وأين يبيتون. هذه بيانات موظفيك لا تُبثّ للعالم.
     *
     * اللوحة منضمّة إلى manager_monitor منذ اتصالها، فلا يتغيّر عندك شيء. */
    io.to('manager_monitor').emit('driver_location', {
      driverId: data.driverId,
      // التطبيق يرسل اسم المندوب مع الموقع، وكان يُسقَط هنا — فتعرض لوحة
      // المدير «كابتن 1234» بدل الاسم الحقيقي ولا يعرف من على الخريطة.
      driverName: data.driverName || '',
      driverPhone: data.driverPhone || '',
      // نسبة الشحن الحقيقية من جهاز المندوب (-1 إن تعذّرت قراءتها)
      battery: (data.battery == null ? -1 : data.battery),
      accuracy: (data.accuracy == null ? -1 : data.accuracy),
      // نبثّ بالاسمين: latitude/longitude للوحة، وlat/lng لأي مستهلك آخر
      latitude: lat,
      longitude: lng,
      lat: lat,
      lng: lng,
      timestamp: new Date()
    });
  });

  socket.on('join_chat', (roomName) => {
    socket.join(roomName);
    console.log(`💬 مستخدم انضم للغرفة: ${roomName}`);
  });

  socket.on('send_message', async (data) => {
    /* الهوية من التوكن لا من الرسالة.
     *
     * كان senderName يُؤخذ كما أُرسل، فيكتب أي متصل «📢 الإدارة» وينتحل
     * شخصيتك أمام مناديبك — يأمرهم بتسليم طلب لعنوان آخر أو بترك موقعهم.
     * وكانت قاعدة إخفاء اسم الزبون مطبَّقة في التطبيق وحده، فمن يعدّل
     * التطبيق يكشف اسم كل زبون يكلّمه. الآن يشتقّها السيرفر ويفرضها. */
    const u = socket.data && socket.data.user;
    if (!u) {
      console.warn('🔒 رسالة شات من اتصال بلا هوية — رُفضت');
      return socket.emit('message_rejected', { error: 'انتهت جلستك — سجّل خروج ودخول' });
    }

    let who;
    if (u.userId === 'admin_root' || u.userType === 'manager') {
      who = { senderId: String(u.userId), senderRole: 'manager', senderName: '📢 الإدارة' };
    } else {
      const me = await loadUser(u.userId);
      if (!me) return socket.emit('message_rejected', { error: 'تعذّر التعرّف على حسابك' });
      const t = String(me.userType || 'customer');
      who = {
        senderId: String(me.id),
        senderRole: t === 'driver' ? 'driver' : t === 'restaurant' ? 'restaurant' : 'customer',
        senderName: t === 'driver'     ? (me.name || 'كابتن زادنا')
                  : t === 'restaurant' ? (me.name || 'المطعم')
                  : 'الزبون'      // الزبون بلا اسم — خصوصيته أمام المندوب وأمام السجل
      };
    }

    const text = String(data && data.text || '').slice(0, 2000).trim();
    if (!text) return;

    console.log(`📩 رسالة في ${data.orderId} من ${who.senderRole}`);

    const messagePayload = {
      id: Date.now().toString(),
      orderId: data.orderId || 'global_zadna_chat',
      senderId: who.senderId,
      senderRole: who.senderRole,
      senderName: who.senderName,
      text,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date()
    };

    // الغرف العامة تُستخدم باسمها، وشات الطلب بصيغة order_room_[orderId]
    const GLOBAL_ROOMS = ['global_driver_chat', 'global_zadna_chat', 'manager_monitor'];
    const isGlobal = GLOBAL_ROOMS.includes(messagePayload.orderId);
    const targetRoom = isGlobal ? messagePayload.orderId : `order_room_${messagePayload.orderId}`;

    /* لا نكتب هنا في Firestore.
     *
     * التطبيق يرسل كل رسالة مرتين: POST /api/driver_chats للحفظ، ثم
     * send_message عبر السوكت للتوصيل الفوري. وكان كلاهما يكتب — فكل
     * رسالة مخزَّنة نسختين: ضِعف استهلاك الحصة، وتكرار ظاهر في سجلّ
     * المحادثة عند تحميله.
     *
     * تقسيم المسؤولية الآن: HTTP يحفظ (ويردّ بنتيجة يفحصها التطبيق
     * فيعرف إن لم تصل رسالته)، والسوكت يوصِّل فوراً. */

    // Broadcast to specific order room (Customer/Driver sync)
    io.to(targetRoom).emit('receive_message', messagePayload);

    // ملاحظة: الغرف العامة تُبث أعلاه مباشرة عبر targetRoom

    // Broadcast to Manager monitor room
    if (messagePayload.orderId !== 'manager_monitor') {
      io.to('manager_monitor').emit('receive_message', messagePayload);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('❌ انقطع اتصال:', socket.id);
  });
});

// =====================
// Error Handling
// =====================
app.use((err, req, res, next) => {
  console.error('❌ خطأ عام:', err.message);
  res.status(500).json({ 
    success: false, 
    error: 'حدث خطأ غير متوقع في السيرفر',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

// =====================
// 404 Handler
// =====================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'المسار غير موجود',
    path: req.path,
    method: req.method
  });
});

// =====================
// Start Server
// =====================
const PORT = process.env.PORT || 5000;

// ===== التقاط أخطاء السيرفر تلقائياً =====
app.use((err, req, res, next) => {
  console.error(`🐞 [server/${req.method} ${req.path}] ${err.message}`);
  // لا نُرسل تفاصيلنا للمستخدم — تُسجَّل عندنا وتُعرض له بالعربية
  if (db) { db.collection('error_logs').add({ level:'error', app:'server', screen:`${req.method} ${req.path}`, message:String(err.message).slice(0,500), detail:String(err.stack||'').slice(0,1500), createdAt:new Date() }).catch(()=>{}); }
  res.status(500).json({ success: false, error: 'حدث خطأ داخلي' });
});
process.on('unhandledRejection', (r) => console.error('🐞 [server/unhandledRejection]', r));
process.on('uncaughtException', (e) => console.error('🐞 [server/uncaughtException]', e.message));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║      🚀 زادنا - Zadna Server 🚀       ║
  ║   🚀 المنفذ: ${PORT}                      ║
  ║   📍 الوضع: سحابي (Production)        ║
  ╚════════════════════════════════════════╝
  `);
});

module.exports = { app, io, db };
