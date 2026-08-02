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

dotenv.config();

// إنشاء تطبيق Express
const app = express();
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  next();
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
    console.error('❌ خطأ في التسجيل:', error);
    return res.status(500).json({
      success: false,
      error: `حدث خطأ داخلي: ${error.message}`
    });
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
    console.error('❌ خطأ بدخول جوجل:', error);
    return res.status(500).json({ success: false, error: 'خطأ داخلي — حاول مجدداً' });
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

    // إذا كان Firebase متصل
    if (db) {
      const userSnapshot = await db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (userSnapshot.empty) {
        return res.status(401).json({
          success: false,
          error: 'البريد الإلكتروني أو كلمة السر غير صحيحة'
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
    console.error('❌ خطأ في الدخول:', error);
    return res.status(500).json({
      success: false,
      error: 'حدث خطأ داخلي في السيرفر'
    });
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
    console.error('❌ خطأ بتحديث الحساب:', error);
    return res.status(500).json({ success: false, error: 'حدث خطأ داخلي' });
  }
});

// =====================
// Routes - Chats
// =====================

/**
 * POST /api/driver_chats
 */
app.post('/api/driver_chats', async (req, res) => {
  try {
    const db = req.app.get('db');
    const chatData = req.body;
    const orderId = chatData.orderId || 'global_zadna_chat';

    if (db) {
      await db.collection('chats').doc(orderId).collection('messages').add({
        ...chatData,
        createdAt: new Date()
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error saving chat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/driver_chats
 */
app.get('/api/driver_chats', async (req, res) => {
  try {
    const db = req.app.get('db');
    const orderId = req.query.orderId || 'global_zadna_chat';

    if (!db) return res.json([]);

    const snapshot = await db.collection('chats')
      .doc(orderId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .get();

    const messages = [];
    snapshot.forEach(doc => messages.push(doc.data()));
    res.json(messages);
  } catch (error) {
    console.error('❌ Error fetching chats:', error);
    res.status(500).json({ success: false, error: error.message });
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

const martRouter = require('./routes/mart');
app.use('/api/mart_products', martRouter);

const partnersRouter = require('./routes/partners');
app.use('/api', partnersRouter);

const walletRouter = require('./routes/wallet');
app.use('/api', walletRouter);

const logsRouter = require('./routes/logs');
app.use('/api', logsRouter);

const zonesRouter = require('./routes/zones');
app.use('/api', zonesRouter);

// =====================
// Routes - General
// =====================

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: '✅ الخادم يعمل بنجاح!',
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
    firebaseConnected: !!db
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
io.on('connection', (socket) => {
  console.log('✅ مستخدم متصل بـ Real-time:', socket.id);
  
  // تحديث حالة الطلب في الـ real-time
  socket.on('order_status_update', (data) => {
    console.log('🔄 تحديث حالة طلب:', data.orderId, '→', data.status);

    // إذا أصبح الطلب جاهزاً، نخبر جميع المناديب
    if (data.status === 'ready_for_pickup' || data.status === 'ready') {
      io.emit('new_ready_order', {
        orderId: data.orderId,
        restaurantName: data.restaurantName || 'زادنا مارت',
        location: data.location || { lat: 32.2211, lng: 35.2622 }
      });
    }

    io.emit('order_updated', {
      orderId: data.orderId,
      status: data.status,
      timestamp: new Date()
    });
  });

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
    console.log('📍 تحديث موقع المندوب:', data.driverId, lat, lng);
    io.emit('driver_location', {
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
    console.log(`📩 New message in ${data.orderId}: ${data.text}`);

    const messagePayload = {
      id: Date.now().toString(),
      orderId: data.orderId || 'global_zadna_chat',
      senderId: data.senderId,
      senderRole: data.senderRole,
      senderName: data.senderName,
      text: data.text,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date()
    };

    // الغرف العامة تُستخدم باسمها، وشات الطلب بصيغة order_room_[orderId]
    const GLOBAL_ROOMS = ['global_driver_chat', 'global_zadna_chat', 'manager_monitor'];
    const isGlobal = GLOBAL_ROOMS.includes(messagePayload.orderId);
    const targetRoom = isGlobal ? messagePayload.orderId : `order_room_${messagePayload.orderId}`;

    // Save to Firestore if available
    if (db) {
      try {
        await db.collection('chats').doc(messagePayload.orderId).collection('messages').add(messagePayload);
      } catch (err) {
        console.error('Error saving chat to firestore:', err);
      }
    }

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
