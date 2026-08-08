/* ══════════════════════════════════════════════════════════════════
   مطابقة تحويلات البنك — الباب الضيّق.

   ما يدخل من هنا: مبلغٌ ورقمُ مرجعٍ ووقت. لا نصّ رسالة، ولا رصيد،
   ولا اسم مرسِل. وهذا قرارُ تصميمٍ لا تقصير: نصُّ رسالة بنكٍ يحمل
   رصيدك وحركاتك، وتخزينه على سيرفرٍ يعني أن اختراقاً واحداً يكشف
   حسابك كلّه. ما لا يُرسَل لا يُسرَق.

   ═══ لماذا مفتاحٌ منفصل ═══

   `ADMIN_KEY` يفتح كل شيء: التسويات والحذف والتجميد وكشوف الزبائن.
   ووضعُه في تطبيقٍ على جوالٍ يُحمل في الشارع يعني أن ضياع الجوال
   يساوي ضياع المنصّة.

   `SMS_HOOK_KEY` يفتح هذا المسار وحده. ولو تسرّب، فأسوأ ما يستطيعه
   حامله أن يدّعي وصولَ تحويلات — ولا ينجح، لأن التأكيد لا يقع إلا
   على طلبٍ **قائمٍ فعلاً** بمرجعٍ **أبلغ عنه زبونٌ** وبمبلغٍ **يطابق
   قيمته بالقرش**. ثلاثة أقفال، والمفتاح لا يفتح إلا الرابع.

   ═══ لماذا لا نثق بالمرجع وحده ═══

   رقم المرجع يُخترع. لذلك لا نبحث عنه في الفراغ بل نطابقه ببلاغٍ
   سابقٍ من صاحب الطلب. أي أن التأكيد يحتاج طرفين اتفقا بلا أن
   يتواطآ: الزبون قال «حوّلتُ برقم كذا»، والبنك قال «وصلك بهذا الرقم».
   ══════════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();
const meter = require('../utils/meter');
const ledger = require('../utils/ledger');
const { breakdown, applyPayment } = require('../utils/money');
const { releaseHeldOrder } = require('./push');   // إطلاق الطلب المحجوز بعد تأكيد البنك

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const getDb = (req) => req.app.get('db');

/* نافذة المطابقة: تحويلٌ وصل قبل ساعتين لا يُطابَق ببلاغ اليوم.
 * والسبب أن الأرقام تتكرّر: مبلغُ ١١٥ ₪ شائع، ومرجعٌ قديمٌ قد يصادف
 * بلاغاً جديداً. النافذة تجعل الصدفة شبه مستحيلة. */
const MATCH_WINDOW_MS = Number(process.env.SMS_MATCH_WINDOW_MS || 3 * 60 * 60 * 1000);

/* ══ الحارس ══
 *
 * مقارنةٌ بطول ثابت (`timingSafeEqual`) لا بـ`===`: المقارنة العادية
 * تتوقّف عند أول حرفٍ مختلف، فيختلف زمن الردّ باختلاف عدد الحروف
 * الصحيحة — ويُستخرج المفتاح حرفاً حرفاً بقياس الزمن. الهجوم بعيد
 * عملياً على شبكةٍ بطيئة، لكن ثمن الحماية سطران.
 */
function hookAuth(req, res, next) {
  const KEY = process.env.SMS_HOOK_KEY;
  if (!KEY || KEY.length < 20) {
    console.error('🚨 SMS_HOOK_KEY غير مضبوط (أو أقصر من ٢٠ حرفاً) — رُفض نداء البنك');
    return res.status(503).json({ success: false, error: 'مفتاح المطابقة غير مضبوط على السيرفر' });
  }
  const given = String(req.headers['x-sms-key'] || '');
  const crypto = require('crypto');
  const a = Buffer.from(given);
  const b = Buffer.from(KEY);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    console.warn('🔒 نداء بنك بمفتاح خاطئ — طوله:', given.length);
    return res.status(401).json({ success: false, error: 'مفتاح غير صالح' });
  }
  next();
}

/* التطبيع من utils/refs — لا نسخةٌ محلية. كانت هنا نسخةٌ تُطبّق على
 * الحفظ وحده، فيُخزَّن المرجع نظيفاً ويُبحث عنه خاماً فلا يلتقيان. */
const { normRef } = require('../utils/refs');

/* ══════════════════════════════════════════════════════════════════
   POST /api/bank/sms — وصلني تحويل.

   الجسم: { amount, reference, at?, currency? }
   ولا شيء غير ذلك يُقرأ — حتى لو أرسل التطبيق أكثر.
   ══════════════════════════════════════════════════════════════════ */
router.post('/bank/sms', hookAuth, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(503).json({ success: false, error: 'لا قاعدة بيانات' });

    const b = req.body || {};
    const amount = r2(Number(b.amount));
    const reference = normRef(b.reference);
    const atMs = Number(b.at) || Date.now();

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'مبلغ غير صالح' });
    }
    if (reference.length < 4) {
      return res.status(400).json({ success: false, error: 'مرجع قصير جداً — لا يصلح للمطابقة' });
    }

    /* ══ لا يُستهلك تحويلٌ مرّتين ══
     *
     * الرسالة قد تصل مرّتين (إعادة محاولة من التطبيق · مزامنة).
     * ومعرّف الوثيقة هو المرجع نفسه، فالكتابة الثانية تصطدم بالأولى
     * بدل أن تُضيف تحويلاً وهمياً. `create` لا `set`. */
    const inRef = db.collection('bank_inbox').doc(reference);
    try {
      await inRef.create({
        amount, reference, at: new Date(atMs),
        currency: String(b.currency || 'ILS').slice(0, 8),
        status: 'unmatched',
        receivedAt: new Date(),
      });
      meter.addWrites && meter.addWrites(1, 'تحويل بنكي');
    } catch (e) {
      const dup = e && (e.code === 6 || /ALREADY_EXISTS/i.test(String(e.message)));
      if (dup) {
        const prev = (await inRef.get()).data() || {};
        return res.json({
          success: true, already: true, status: prev.status,
          orderId: prev.orderId || null,
          message: 'هذا التحويل مسجَّل سابقاً',
        });
      }
      throw e;
    }

    /* ══ البحث عن بلاغٍ يطابقه ══
     *
     * نبحث بالمرجع وحده (حقلٌ واحد — لا فهرس مركّب)، ثم نفحص المبلغ
     * والنافذة الزمنية في الذاكرة. */
    /* البحث بالحقل **المطبَّع** الذي يكتبه مسار البلاغ. الطلبات التي
     * سبقت هذا الحقل لا تُطابَق آلياً — وهي قليلة وتُؤكَّد من اللوحة. */
    const snap = await db.collection('orders')
      .where('qrClaim.refNorm', '==', reference)
      .limit(5).get();
    meter.addReads(snap.size || 1, 'مطابقة تحويل');

    let match = null;
    snap.forEach(d => {
      if (match) return;
      const o = d.data() || {};
      if (o.paidOnline === true) return;
      if (String(o.status || '') === 'CANCELLED') return;

      const expected = Number((o.money && o.money.grandTotal) != null ? o.money.grandTotal : o.grandTotal) || 0;
      if (Math.abs(expected - amount) > 0.01) return;      // المبلغ بالقرش

      const claimAt = o.qrClaim && o.qrClaim.at;
      const cms = claimAt && claimAt._seconds ? claimAt._seconds * 1000
                : (claimAt ? new Date(claimAt).getTime() : 0);
      if (cms && Math.abs(atMs - cms) > MATCH_WINDOW_MS) return;   // خارج النافذة

      match = { id: d.id, o, expected };
    });

    /* ══ لم يطابق طلباً؟ جرّب بلاغ تسوية مندوب ══
     *
     * المندوب يسدّد دَينه لزادنا بالQR (قرار يزن ٨ آب: كاش يدوي، QR
     * آلي). يبلّغ من تطبيقه بمرجع تحويله، فيُكتب على مستنده
     * `settlementClaim{refNorm, amount, ...}`. ورسالة البنك تطابقه هنا
     * فتُسجَّل التسوية آلياً وينفكّ الحجب — بلا لمس اللوحة.
     *
     * والفرق عن الطلب: هنا لا `paidOnline` يُقلب بل `settlement` تُنشأ
     * و`debtToZadna` يُنقص — نفس أثر التسوية اليدوية. */
    if (!match) {
      const dsnap = await db.collection('users')
        .where('settlementClaim.refNorm', '==', reference)
        .limit(3).get();
      meter.addReads(dsnap.size || 1, 'مطابقة تسوية مندوب');

      let dmatch = null;
      dsnap.forEach(du => {
        if (dmatch) return;
        const ud = du.data() || {};
        const sc = ud.settlementClaim || {};
        if (sc.settledAt) return;                           // بلاغٌ سُوِّي سلفاً
        if (Math.abs(Number(sc.amount || 0) - amount) > 0.01) return;
        const cms = sc.at && sc.at._seconds ? sc.at._seconds * 1000
                  : (sc.at ? new Date(sc.at).getTime() : 0);
        if (cms && Math.abs(atMs - cms) > MATCH_WINDOW_MS) return;
        dmatch = { id: du.id, u: ud, amount };
      });

      if (dmatch) {
        const FV = require('firebase-admin').firestore.FieldValue;
        const uref = db.collection('users').doc(dmatch.id);
        const ud = dmatch.u;
        /* رقم إيصالٍ للتسوية كأختها اليدوية. */
        let receiptNo;
        try {
          const cnt = await db.collection('settlements').count().get();
          receiptNo = 'SET-' + String((cnt.data().count || 0) + 1).padStart(4, '0');
        } catch (_) { receiptNo = 'SET-' + Date.now().toString().slice(-6); }

        await db.collection('settlements').add({
          driverId: dmatch.id, driverName: ud.name || '',
          amount, direction: 'in', receiptNo,
          reference, note: 'تسوية بالQR — طابقتها رسالة البنك آلياً',
          confirmedBy: 'bank_sms',
          createdAt: new Date(),
        });

        /* الكاش والدَّين ينقصان معاً — نفس منطق التسوية اليدوية. */
        await uref.update({
          cashOnHand:  Math.max(0, Number(ud.cashOnHand || 0) - amount),
          debtToZadna: Math.max(0, Number(ud.debtToZadna || 0) - amount),
          'settlementClaim.settledAt': new Date(),
          'settlementClaim.settledVia': 'bank_sms',
        });
        await inRef.update({ status: 'matched_settlement', driverId: dmatch.id, matchedAt: new Date() });

        ledger.record(db, {
          kind: ledger.KINDS.SETTLE_IN, orderId: null,
          amount, direction: 'in',
          actorId: 'bank_sms', actorRole: 'system',
          actorName: ud.name || dmatch.id,
          reference: receiptNo,
          note: `تسوية مندوب بالQR — طابقتها رسالة البنك · مرجع ${reference}`,
          meta: { driverId: dmatch.id, auto: true, bankReference: reference },
        }).catch(() => {});

        try { require('../utils/cache').invalidate('orders:all'); } catch (_) {}
        const io2 = req.app.get('socketio');
        if (io2) {
          io2.emit('settlement_matched', { driverId: dmatch.id, amount, reference, receiptNo });
          io2.emit('bank_matched', { driverId: dmatch.id, amount, reference, kind: 'settlement' });
        }
        console.log(`✅ طوبقت تسوية مندوب ${reference} · ${amount} ₪ → ${ud.name || dmatch.id}`);
        return res.json({ success: true, matched: true, kind: 'settlement', driverId: dmatch.id, amount, reference });
      }
    }

    if (!match) {
      /* تحويلٌ وصلك بلا بلاغٍ يقابله. ليس خطأً — قد يكون زبوناً نسي
       * أن يُبلغ، أو مالاً لك من مصدرٍ آخر. يبقى في الصندوق ظاهراً
       * في اللوحة كي تربطه يدوياً. */
      console.warn(`📥 تحويل بلا بلاغ: ${amount} ₪ · مرجع ${reference}`);
      const io = req.app.get('socketio');
      if (io) io.emit('bank_unmatched', { amount, reference, at: new Date(atMs) });
      return res.json({
        success: true, matched: false, reference, amount,
        message: 'سُجّل التحويل ولم يُطابَق بأي بلاغ — راجعه في اللوحة',
      });
    }

    /* ══ التأكيد — نفس منطق /payment حرفياً ══ */
    const cur = match.o;
    const id = match.id;
    const patched = { ...cur, paidOnline: true, paymentStatus: 'paid', paymentMethod: 'qr' };
    const m = applyPayment(breakdown(patched), patched);

    /* المندوب استلم فعلاً؟ إذن دفع للمحلّ من جيبه — فالدَّين له لا
     * للمحلّ. (الشرح الكامل في routes/orders.js عند نفس الحارس.) */
    const AFTER_PICKUP = ['PICKED_UP', 'ON_THE_WAY', 'DELIVERED'];
    if (AFTER_PICKUP.includes(String(cur.status || '')) && m.owedToRestaurant > 0) {
      const reimburse = m.owedToRestaurant;
      m.owedToDriver = r2(m.owedToDriver + reimburse);
      m.zadnaOwesDriver = r2(m.zadnaOwesDriver + reimburse);
      m.owedToRestaurant = 0;
      m.driverPaidRestaurant = reimburse;
    }

    await db.collection('orders').doc(id).update({
      paidOnline: true,
      paymentStatus: 'paid',
      paymentMethod: 'qr',
      paymentReference: reference,
      paidAt: new Date(),
      paymentConfirmedBy: 'bank_sms',      // أُكّد آلياً لا بيدك — أثرٌ يُسأل عنه
      money: m,
      grandTotal: m.grandTotal,
    });
    await inRef.update({ status: 'matched', orderId: id, matchedAt: new Date() });

    try { require('../utils/cache').invalidate('orders:all'); } catch (e) {}

    ledger.record(db, {
      kind: ledger.KINDS.PAID_ONLINE,
      orderId: id,
      amount: m.grandTotal,
      direction: 'in',
      actorId: 'bank_sms',
      actorRole: 'system',
      actorName: 'مطابقة آلية من رسالة البنك',
      reference,
      note: `طابق بلاغ الزبون — عليك للمحلّ ${m.owedToRestaurant} وللمندوب ${m.owedToDriver}`,
      meta: { method: 'qr', auto: true },
    }).catch(() => {});

    const io = req.app.get('socketio');
    if (io) {
      io.emit('order_paid', { orderId: id, method: 'qr', money: m });
      io.emit('bank_matched', { orderId: id, amount, reference });
    }

    /* الطلب المحجوز بانتظار الدفع يصل المطعم الآن — هنا بيت القصيد من
     * الميزة: التأكيد جاء من البنك، فيُطلَق. (لا شيء إن لم يكن محجوزاً.) */
    try { await releaseHeldOrder(req.app, db, id, { ...cur, grandTotal: m.grandTotal }); } catch (_) {}

    console.log(`✅ طوبق تحويل ${reference} · ${amount} ₪ → طلب #${id}`);
    res.json({ success: true, matched: true, orderId: id, amount, reference });
  } catch (e) {
    console.error('❌ مطابقة تحويل:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/* GET /api/bank/inbox — التحويلات التي لم تُطابَق.
 * بصلاحية الإدارة لا بمفتاح الهوك: هذه قراءةُ مالٍ، والمفتاح الضيّق
 * لا يُوسَّع لمجرّد أنه موجود. */
router.get('/bank/inbox', (req, res, next) => {
  const fn = req.app.get('requireAdmin');
  return fn ? fn(req, res, next) : res.status(503).json({ error: 'الحماية غير مضبوطة' });
}, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.json({ count: 0, items: [] });
    const snap = await db.collection('bank_inbox').where('status', '==', 'unmatched').get();
    meter.addReads(snap.size || 1, 'صندوق البنك');
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => {
      const t = (x) => (x.at && x.at._seconds) ? x.at._seconds : 0;
      return t(b) - t(a);
    });
    res.json({ count: items.length, items: items.slice(0, 100) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
