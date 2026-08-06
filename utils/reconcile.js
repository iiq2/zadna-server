/* ══════════════════════════════════════════════════════════════════
   فحص التوازن — الذي يصرخ قبل أن تكتشف بنفسك.

   الدفتر يسجّل، وهذا الملفّ **يشكّ**. والفرق جوهري: سجلٌّ يوافق نفسه
   دائماً لأنه يقارن أرقامه بأرقامه. أمّا الخلل الحقيقي فيظهر حين
   تقارن مصدرين مستقلّين — ما يقوله الدفتر بما يقوله الواقع.

   ═══ ما يُفحص ═══

   ١ · كاش المناديب: `cashOnHand` المخزَّن مقابل ما يقوله الدفتر.
       اختلافُهما يعني قيداً ضاع أو عدّاداً تعطّل.

   ٢ · بلاغاتُ تحويلٍ معلّقة: زبونٌ قال «حوّلت» ولم يُؤكَّد منذ ساعات.
       إمّا كذب، أو تحويلٌ لم يصلك، أو أنك نسيت.

   ٣ · تحويلاتٌ بلا بلاغ: مالٌ في حسابك لا تعرف لمن.

   ٤ · استردادات متأخّرة: زبونٌ ينتظر ماله. وهذه أخطرها سمعةً.

   ٥ · طلباتٌ سُلّمت ولم تُقيَّد: تسليمٌ بلا سطرٍ في الدفتر.

   ═══ لماذا لا يُصلح شيئاً ═══

   هذا الملفّ يقرأ ولا يكتب — إلّا تقريره. لأن «إصلاحاً» آلياً لرقمٍ
   مالي مختلٍّ يخفي السبب بدل أن يكشفه: تُصحَّح النتيجة ويبقى العطب
   يعمل. الفحص يقول «هنا خلل»، والقرار لك.
   ══════════════════════════════════════════════════════════════════ */

const meter = require('./meter');
const ledger = require('./ledger');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** عتبات التنبيه — تُضبط من البيئة دون نشر. */
const CLAIM_STALE_MS  = Number(process.env.CLAIM_STALE_MS  || 2 * 60 * 60 * 1000);   // ساعتان
const REFUND_STALE_MS = Number(process.env.REFUND_STALE_MS || 48 * 60 * 60 * 1000);  // يومان
/* فرقٌ أقلّ من شيكل ليس خللاً بل تقريب. ورفعُ العتبة فوق ذلك يخفي
 * أخطاءً حقيقية، وخفضُها إلى الصفر يجعل التنبيه ضجيجاً يُتجاهَل. */
const CASH_TOLERANCE  = Number(process.env.CASH_TOLERANCE  || 1);

const ms = (v) => {
  if (!v) return 0;
  if (typeof v.toDate === 'function') { try { return v.toDate().getTime(); } catch (e) { return 0; } }
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  const d = new Date(v);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

/* ══ ١ · كاش المناديب: المخزَّن مقابل المحسوب ══
 *
 * `cashOnHand` عدّادٌ يُزاد عند التسليم ويُنقص عند التسوية. وهو عرضةٌ
 * للانحراف: تحديثٌ فشل، أو تسليمٌ سُجّل مرّتين، أو تعديلٌ يدوي.
 *
 * والمحسوب من الطلبات هو الحقيقة: ما حصّله ناقص ما دفعه للمحلّات
 * ناقص ما سدّده لك. */
async function driverCash(db) {
  const out = [];
  try {
    const [users, orders, setts] = await Promise.all([
      db.collection('users').where('role', '==', 'driver').get(),
      db.collection('orders').where('status', '==', 'DELIVERED').get(),
      db.collection('settlements').get(),
    ]);
    meter.addReads(users.size + orders.size + setts.size, 'فحص كاش المناديب');

    const kept = new Map();     // driverKey → ما بقي في جيبه من الطلبات
    orders.forEach(d => {
      const o = d.data() || {};
      const m = o.money || {};
      const drv = o.driver || {};
      const key = String(o.driverId || drv.id || drv.phone || '');
      if (!key) return;
      const v = Math.max(0, Number(m.cashToCollect || 0) - Number(m.payToRestaurant || 0));
      kept.set(key, (kept.get(key) || 0) + v);
    });

    const settled = new Map();  // ما سدّده لك (اتجاه in فقط)
    setts.forEach(d => {
      const s = d.data() || {};
      if (String(s.direction || 'in') !== 'in') return;
      const k = String(s.driverId || '');
      settled.set(k, (settled.get(k) || 0) + (Number(s.amount) || 0));
    });

    users.forEach(d => {
      const u = d.data() || {};
      const id = d.id;
      const stored = Number(u.cashOnHand || 0);
      /* المفتاح قد يكون المعرّف أو الهاتف — الطلبات القديمة تختلف.
       * نجمع الصيغتين بدل أن نفترض واحدة فنقرأ صفراً كاذباً. */
      const earned = (kept.get(id) || 0) + (kept.get(String(u.phone || '')) || 0);
      const paid   = (settled.get(id) || 0) + (settled.get(String(u.phone || '')) || 0);
      const expected = Math.max(0, earned - paid);
      const diff = r2(stored - expected);

      if (Math.abs(diff) > CASH_TOLERANCE) {
        out.push({
          driverId: id,
          name: u.name || id,
          phone: u.phone || '',
          stored: r2(stored),
          expected: r2(expected),
          diff,
          hint: diff > 0
            ? 'العدّاد أكبر من الواقع — تسوية لم تُخصم، أو تسليم عُدّ مرّتين'
            : 'العدّاد أصغر من الواقع — تسليم لم يُحتسب، أو خصمٌ زائد',
        });
      }
    });
  } catch (e) {
    return { error: e.message, items: [] };
  }
  out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return { items: out };
}

/* ══ ٢ · بلاغات تحويل عالقة ══ */
async function staleClaims(db) {
  const items = [];
  try {
    const snap = await db.collection('orders')
      .where('paymentStatus', '==', 'claim_pending').get();
    meter.addReads(snap.size || 1, 'بلاغات معلّقة');
    const now = Date.now();
    snap.forEach(d => {
      const o = d.data() || {};
      if (o.paidOnline === true) return;
      const c = o.qrClaim || {};
      const age = now - ms(c.at);
      if (age < CLAIM_STALE_MS) return;
      items.push({
        orderId: d.id,
        amount: Number(c.amount || 0),
        reference: c.reference || '',
        hours: Math.round(age / 3600000),
        customerName: o.customerName || '',
        customerPhone: o.customerPhone || '',
        status: o.status || '',
      });
    });
  } catch (e) { return { error: e.message, items: [] }; }
  items.sort((a, b) => b.hours - a.hours);
  return { items };
}

/* ══ ٣ · تحويلات وصلتك بلا صاحب ══ */
async function unmatchedTransfers(db) {
  const items = [];
  try {
    const snap = await db.collection('bank_inbox').where('status', '==', 'unmatched').get();
    meter.addReads(snap.size || 1, 'تحويلات بلا مطابقة');
    snap.forEach(d => {
      const t = d.data() || {};
      items.push({ reference: d.id, amount: Number(t.amount || 0), at: t.at || null });
    });
  } catch (e) { return { error: e.message, items: [] }; }
  return { items };
}

/* ══ ٤ · استردادات لم تُنفَّذ ══ */
async function lateRefunds(db) {
  const items = [];
  try {
    const snap = await db.collection('orders').where('refundStatus', '==', 'pending').get();
    meter.addReads(snap.size || 1, 'استردادات متأخّرة');
    const now = Date.now();
    snap.forEach(d => {
      const o = d.data() || {};
      const age = now - ms(o.cancelledAt);
      items.push({
        orderId: d.id,
        amount: Number(o.refundDue || 0),
        hours: Math.round(age / 3600000),
        late: age > REFUND_STALE_MS,
        customerPhone: o.customerPhone || '',
      });
    });
  } catch (e) { return { error: e.message, items: [] }; }
  items.sort((a, b) => b.hours - a.hours);
  return { items };
}

/* ══ ٥ · تسليمٌ بلا قيد ══
 *
 * أقوى فحصٍ هنا: يقارن مصدرين لا يعرف أحدهما الآخر. طلبٌ حالته
 * DELIVERED ولا سطر `delivered` في الدفتر يعني أن الكتابة فشلت —
 * وهي تفشل صامتةً بحكم التصميم (الدفتر شاهدٌ لا حارس).
 *
 * نقصره على نافذةٍ زمنية لأن الدفتر لم يكن موجوداً قبل اليوم،
 * فالطلبات الأقدم منه كلّها بلا قيود وليست خللاً. */
async function unloggedDeliveries(db, sinceMs) {
  const items = [];
  try {
    const since = sinceMs || (Date.now() - 7 * 86400000);
    const mv = await ledger.movement(db, new Date(since), new Date());
    if (!mv || mv.error) return { items: [], note: 'تعذّرت قراءة الدفتر' };

    const logged = new Set();
    (mv.entries || []).forEach(e => {
      if (e.kind === ledger.KINDS.DELIVERED && e.orderId) logged.add(String(e.orderId));
    });

    const snap = await db.collection('orders').where('status', '==', 'DELIVERED').get();
    meter.addReads(snap.size || 1, 'تسليمات بلا قيد');
    snap.forEach(d => {
      const o = d.data() || {};
      const t = ms(o.deliveredAt || o.updatedAt || o.createdAt);
      if (!t || t < since) return;                 // أقدم من الدفتر — ليس خللاً
      if (logged.has(String(d.id))) return;
      items.push({
        orderId: d.id,
        amount: Number((o.money && o.money.grandTotal) || o.grandTotal || 0),
        at: o.deliveredAt || o.updatedAt || null,
      });
    });
  } catch (e) { return { error: e.message, items: [] }; }
  return { items };
}

/* ══════════════════════════════════════════════════════════════════
   الفحص الكامل — يُرجع تقريراً بمستوى خطورة.

   `severity`:
     · ok      كل شيء متّزن
     · notice  أمورٌ تستحقّ نظرةً ولا تستدعي قلقاً
     · alert   مالٌ في الاتجاه الخطأ — افحص اليوم
   ══════════════════════════════════════════════════════════════════ */
async function fullCheck(db, opts = {}) {
  if (!db) return { severity: 'alert', error: 'لا قاعدة بيانات' };

  const [cash, claims, unmatched, refunds, unlogged] = await Promise.all([
    driverCash(db),
    staleClaims(db),
    unmatchedTransfers(db),
    lateRefunds(db),
    unloggedDeliveries(db, opts.since),
  ]);

  const problems = [];
  const add = (level, code, title, count, total, items) =>
    problems.push({ level, code, title, count, total: r2(total || 0), items: (items || []).slice(0, 20) });

  if (cash.items && cash.items.length) {
    const t = cash.items.reduce((s, x) => s + Math.abs(x.diff), 0);
    add('alert', 'driver_cash', 'كاش مناديب لا يطابق الدفتر', cash.items.length, t, cash.items);
  }
  if (unlogged.items && unlogged.items.length) {
    const t = unlogged.items.reduce((s, x) => s + x.amount, 0);
    add('alert', 'unlogged_delivery', 'طلبات سُلّمت ولم تُقيَّد في الدفتر', unlogged.items.length, t, unlogged.items);
  }
  const lateOnes = (refunds.items || []).filter(x => x.late);
  if (lateOnes.length) {
    const t = lateOnes.reduce((s, x) => s + x.amount, 0);
    add('alert', 'late_refund', 'زبائن ينتظرون استرداداً منذ أكثر من يومين', lateOnes.length, t, lateOnes);
  }
  if (claims.items && claims.items.length) {
    const t = claims.items.reduce((s, x) => s + x.amount, 0);
    add('notice', 'stale_claim', 'بلاغات تحويل لم تُؤكَّد', claims.items.length, t, claims.items);
  }
  if (unmatched.items && unmatched.items.length) {
    const t = unmatched.items.reduce((s, x) => s + x.amount, 0);
    add('notice', 'unmatched_transfer', 'تحويلات وصلتك بلا بلاغ يقابلها', unmatched.items.length, t, unmatched.items);
  }
  const pendingRefunds = (refunds.items || []).filter(x => !x.late);
  if (pendingRefunds.length) {
    const t = pendingRefunds.reduce((s, x) => s + x.amount, 0);
    add('notice', 'pending_refund', 'استردادات مستحقّة لم تُنفَّذ بعد', pendingRefunds.length, t, pendingRefunds);
  }

  const severity = problems.some(p => p.level === 'alert') ? 'alert'
                 : problems.length ? 'notice' : 'ok';

  return {
    at: new Date().toISOString(),
    severity,
    problems,
    summary: severity === 'ok'
      ? 'كل الأرقام متّزنة'
      : problems.map(p => `${p.title}: ${p.count}${p.total ? ` (${p.total} ₪)` : ''}`).join(' · '),
  };
}

module.exports = { fullCheck, driverCash, staleClaims, unmatchedTransfers, lateRefunds, unloggedDeliveries };
