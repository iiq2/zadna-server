const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

const getDb = (req) => req.app.get('db');
const needsIdentity = (req, res, next) => {
  const fn = req.app.get('requireIdentity');
  return fn ? fn(req, res, next) : next();
};

/* ============================================================
   الإشعارات — القناة الوحيدة التي تصل المستخدم وتطبيقه مغلق.

   قبلها كان النظام أعمى: صاحب المطعم لا يعلم بطلب وصله إلا إن
   كان فاتحاً التطبيق وناظراً إليه، والمندوب كذلك، والزبون ينتظر
   بلا خبر. وهذا لا يصلح لعمل التوصيل: صاحب المطعم في المطبخ
   والمندوب على الموتور.

   القنوات وأصواتها (الملفات في res/raw بالتطبيق):
     zadna_alert    → المطعم: طلب جديد | المندوب: طلب جاهز
     zadna_update   → الزبون: تحديثات وسط الطريق
     zadna_arrived  → الزبون: المندوب على الباب
     zadna_success  → الزبون: نجح الطلب / تم التوصيل (أغنية زادنا)
   ============================================================ */

const CHANNELS = {
  alert:   { id: 'zadna_alert',   sound: 'zadna_alert',   priority: 'high' },
  update:  { id: 'zadna_update',  sound: 'zadna_update',  priority: 'default' },
  arrived: { id: 'zadna_arrived', sound: 'zadna_arrived', priority: 'high' },
  success: { id: 'zadna_success', sound: 'zadna_success', priority: 'high' },
};

/* ===== حفظ رموز الأجهزة ===== */
// المستخدم قد يملك أكثر من جهاز (جوال وتابلت)، فالرموز مصفوفة.

// POST /api/fcm_token  { token }
router.post('/fcm_token', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    const token = String((req.body && req.body.token) || '').trim();
    const uid = String((req.user && req.user.userId) || '');
    if (!db || !uid) return res.status(400).json({ success: false, error: 'لا يمكن تسجيل الجهاز' });
    if (token.length < 20) return res.status(400).json({ success: false, error: 'رمز جهاز غير صالح' });

    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'الحساب غير موجود' });

    const cur = Array.isArray(snap.data().fcmTokens) ? snap.data().fcmTokens : [];
    if (!cur.includes(token)) {
      // نُبقي آخر 5 أجهزة فقط — أكثر من ذلك يعني أجهزة قديمة لم تُحذف
      await ref.update({ fcmTokens: [token, ...cur].slice(0, 5) });
    }
    res.json({ success: true });
  } catch (e) {
    console.error('❌ حفظ رمز الجهاز:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/fcm_token  { token } — عند تسجيل الخروج
router.delete('/fcm_token', needsIdentity, async (req, res) => {
  try {
    const db = getDb(req);
    const token = String((req.body && req.body.token) || '').trim();
    const uid = String((req.user && req.user.userId) || '');
    if (!db || !uid || !token) return res.json({ success: true });
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return res.json({ success: true });
    const cur = Array.isArray(snap.data().fcmTokens) ? snap.data().fcmTokens : [];
    await ref.update({ fcmTokens: cur.filter(t => t !== token) });
    res.json({ success: true });
  } catch (e) {
    res.json({ success: true });   // فشل الإزالة لا يمنع الخروج
  }
});

/* ===== الإرسال ===== */

async function tokensOf(db, userIds) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) return [];
  const snaps = await Promise.all(ids.map(id => db.collection('users').doc(id).get()));
  const out = [];
  snaps.forEach(s => {
    if (!s.exists) return;
    const t = s.data().fcmTokens;
    if (Array.isArray(t)) out.push(...t);
  });
  return [...new Set(out)];
}

/**
 * يرسل إشعاراً ويحذف الرموز الميتة.
 *
 * الرمز يموت حين يحذف المستخدم التطبيق أو يمسح بياناته. تركه يعني
 * محاولة إرسال فاشلة في كل مرة إلى آخر الدهر، وبطء متراكم.
 */
async function push(db, tokens, { title, body, channel = 'update', data = {} }) {
  if (!tokens || !tokens.length) return { sent: 0, failed: 0 };
  const ch = CHANNELS[channel] || CHANNELS.update;

  const message = {
    notification: { title, body },
    data: Object.fromEntries(Object.entries({ ...data, channel: ch.id }).map(([k, v]) => [k, String(v)])),
    android: {
      priority: 'high',
      notification: {
        channelId: ch.id,
        sound: ch.sound,
        // الإشعار يبقى حتى يفتحه — طلب فيه مال لا يُفوَّت بلمسة عابرة
        ...(channel === 'alert' ? { visibility: 'public' } : {}),
      },
    },
  };

  try {
    const r = await admin.messaging().sendEachForMulticast({ tokens, ...message });
    const dead = [];
    r.responses.forEach((resp, i) => {
      if (!resp.success) {
        const code = resp.error && resp.error.code;
        if (code === 'messaging/registration-token-not-registered'
         || code === 'messaging/invalid-registration-token') dead.push(tokens[i]);
      }
    });
    if (dead.length) cleanupDeadTokens(db, dead).catch(() => {});
    return { sent: r.successCount, failed: r.failureCount };
  } catch (e) {
    console.warn('⚠️ تعذّر إرسال إشعار:', e.message);
    return { sent: 0, failed: tokens.length, error: e.message };
  }
}

async function cleanupDeadTokens(db, dead) {
  const snap = await db.collection('users').where('fcmTokens', 'array-contains-any', dead.slice(0, 10)).get();
  const jobs = [];
  snap.forEach(d => {
    const keep = (d.data().fcmTokens || []).filter(t => !dead.includes(t));
    jobs.push(d.ref.update({ fcmTokens: keep }));
  });
  await Promise.all(jobs);
  console.log(`🧹 حُذف ${dead.length} رمز جهاز ميت`);
}

/* ===== واجهات جاهزة تستعملها المسارات ===== */

/** صاحب المطعم — طلب جديد وصله */
async function notifyRestaurant(app, restaurantId, { title, body, data }) {
  const db = app.get('db');
  if (!db || !restaurantId) return;
  try {
    // نجد المالك عبر ownerId على المطعم، أو عبر ownedRestaurantId على المستخدم
    const r = await db.collection('restaurants').doc(String(restaurantId)).get();
    let ownerIds = [];
    if (r.exists && r.data().ownerId) ownerIds.push(r.data().ownerId);
    if (!ownerIds.length) {
      const us = await db.collection('users').where('ownedRestaurantId', '==', String(restaurantId)).get();
      us.forEach(u => ownerIds.push(u.id));
    }
    const tokens = await tokensOf(db, ownerIds);
    return await push(db, tokens, { title, body, channel: 'alert', data });
  } catch (e) { console.warn('⚠️ إشعار المطعم:', e.message); }
}

/* ============================================================
   ترتيب المناديب: الأقرب للمطعم أولاً، والمشغول آخِراً.

   كان الإشعار يُرسل للجميع دفعةً واحدة، فيتسابقون على الطلب: يصل
   البعيد أولاً فيأخذه، ويصل الطلب متأخراً، ويغضب من كان على بُعد
   مئتَي متر ووجده مأخوذاً.

   والقرب وحده لا يكفي: مندوب على بُعد ٢٠٠ متر ماسكٌ طلبين أبطأ فعلياً
   من فارغٍ على بُعد ٦٠٠. لذلك نستبعد المشغول بطلبين ونضعه في آخر
   الترتيب لا نحرمه — فقد يكون هو الوحيد المتاح.
   ============================================================ */
const R_EARTH = 6371;
const rad = (d) => (d * Math.PI) / 180;
function distKm(aLat, aLng, bLat, bLng) {
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(s));
}
const BUSY_LIMIT = 2;           // من معه طلبان فأكثر يُؤخَّر
const ACTIVE = ['DRIVER_ASSIGNED', 'AT_RESTAURANT', 'PICKED_UP', 'ON_THE_WAY'];

/** كم طلباً نشطاً مع كل مندوب الآن؟ */
async function activeLoadByDriver(db) {
  const load = {};
  try {
    const snap = await db.collection('orders').where('status', 'in', ACTIVE).get();
    snap.forEach(d => {
      const o = d.data();
      const k = (o.driver && typeof o.driver === 'object')
        ? String(o.driver.id || o.driver.phone || '') : String(o.driverId || '');
      if (k) load[k] = (load[k] || 0) + 1;
    });
  } catch (e) { /* بلا فهرس: نكمل بلا أحمال */ }
  return load;
}

/**
 * كل المناديب المعتمدين وغير المجمّدين — طلب جاهز للاستلام.
 * إن مرّرتَ موقع المطعم، رُتِّبوا بالقرب منه.
 */
async function notifyDrivers(app, { title, body, data, restaurantLat, restaurantLng }) {
  const db = app.get('db');
  if (!db) return;
  try {
    const snap = await db.collection('users').where('userType', '==', 'driver').get();
    const ids = [];
    snap.forEach(d => {
      const u = d.data();
      const st = String(u.status || 'approved');
      // المجمّد والمرفوض لا يُنبَّهان — لا نُغريه بطلب لا يستطيع أخذه
      if (st === 'approved') ids.push(d.id);
    });
    if (!ids.length) return;

    const haveGeo = Number.isFinite(Number(restaurantLat)) && Number.isFinite(Number(restaurantLng));
    if (haveGeo) {
      const locs = app.get('lastDriverLocation') || new Map();
      const load = await activeLoadByDriver(db);
      const scored = ids.map(id => {
        const l = locs.get(String(id));
        // من لا نعرف موقعه يُوضع بعد من نعرفهم لا يُحرَم
        const km = l ? distKm(Number(restaurantLat), Number(restaurantLng), l.lat, l.lng) : 999;
        const busy = (load[String(id)] || 0) >= BUSY_LIMIT ? 1 : 0;
        return { id, km, busy };
      });
      scored.sort((a, b) => (a.busy - b.busy) || (a.km - b.km));
      ids.length = 0;
      scored.forEach(s => ids.push(s.id));
      const near = scored.filter(s => s.km < 900).slice(0, 3)
        .map(s => `${s.id.slice(0, 6)}:${s.km.toFixed(1)}كم${s.busy ? '(مشغول)' : ''}`);
      if (near.length) console.log('🛵 أقرب المناديب:', near.join(' · '));
    }

    const tokens = await tokensOf(db, ids);
    return await push(db, tokens, { title, body, channel: 'alert', data });
  } catch (e) { console.warn('⚠️ إشعار المناديب:', e.message); }
}

/** الزبون — بهاتفه المسجَّل على الطلب */
async function notifyCustomer(app, customerPhone, { title, body, channel = 'update', data }) {
  const db = app.get('db');
  if (!db || !customerPhone) return;
  try {
    const snap = await db.collection('users').where('phone', '==', String(customerPhone)).limit(1).get();
    if (snap.empty) return;
    const tokens = await tokensOf(db, [snap.docs[0].id]);
    return await push(db, tokens, { title, body, channel, data });
  } catch (e) { console.warn('⚠️ إشعار الزبون:', e.message); }
}

module.exports = router;
module.exports.notifyRestaurant = notifyRestaurant;
module.exports.notifyDrivers = notifyDrivers;
module.exports.notifyCustomer = notifyCustomer;
