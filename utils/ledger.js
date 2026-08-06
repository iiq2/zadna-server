/* ============================================================
   دفتر أستاذ زادنا — قيودٌ تُضاف ولا تُمحى.

   لماذا وُجد هذا الملفّ:

   كان الطلب يحمل **صورةً** لا **قصّة**. حقولٌ مثل `paymentMethod` و
   `paidAt` تقول ما هو الحال الآن، ولا تقول كيف صار كذلك: من أكّد
   الدفع؟ ومتى؟ وهل تغيّرت الطريقة بعد ذلك؟

   والصورة تكفي ما دام لا خلاف. فإذا اختلفتَ مع مندوبٍ بعد أسبوع —
   «الطلب #٤٤٧١ دفعه الزبون بـQR» — لم يكن في المنصّة سطرٌ واحد يشهد
   متى قيل ذلك ولا من قاله. وكشف الحساب الذي لا يُصدَّق أسوأ من غيابه.

   ═══ القواعد الأربع ═══

   ١ · **يُضاف ولا يُعدَّل.** لا `update` ولا `delete` على قيدٍ أبداً.
       ولذلك لا تجد في هذا الملفّ دالةً تفعل ذلك — الغياب حارس.

   ٢ · **التصحيح بقيدٍ مضادّ.** أخطأتَ فسجّلت ١١٥ بدل ١٥؟ لا تمحُ —
       أضف قيداً عكسياً بـ١١٥ ثم قيداً صحيحاً بـ١٥. فيبقى الخطأ
       مرئياً ومعه تصحيحه، وهذا **بالضبط** ما يجعل الدفتر يُصدَّق:
       دفترٌ يُمحى منه شيءٌ لا يُحتجّ به على أحد.

   ٣ · **كل قيدٍ يحمل فاعله.** من (المعرّف والدور) · متى · كم ·
       بأي مرجع. قيدٌ بلا فاعل لا يحسم خلافاً.

   ٤ · **الفشل في القيد لا يُسقط العملية.** المندوب سلّم الطلب فعلاً؛
       فلو تعثّرت الكتابة في الدفتر لا نُلغي التسليم — نُسجّل تحذيراً
       صارخاً في السجلّ ونمضي. الدفتر شاهدٌ لا حارس.

   ═══ الكلفة ═══

   قيدٌ واحد لكل حدث. الطلب الواحد يُنتج ٣–٥ قيود (إنشاء · تحصيل ·
   تأكيد · تسليم)، والتسوية قيداً. بمئة طلب يومياً = ٥٠٠ كتابة —
   جزءٌ يسير من حصة Firestore (٢٠ ألف كتابة يومياً)، وثمنٌ زهيد
   لسجلٍّ يحسم الخلافات.
   ============================================================ */

const meter = require('./meter');

/* أنواع القيود — قائمة مغلقة عمداً.
 *
 * نوعٌ حرّ يعني أن يخترع كل مسارٍ اسمه، فتصير قراءة الدفتر تخميناً.
 * وإضافة نوعٍ جديد هنا سطرٌ واحد، لكنها قرارٌ واعٍ لا انزلاق. */
const KINDS = {
  ORDER_CREATED:   'order_created',      // نشأ التزام: الزبون يدين بالمبلغ
  COLLECTED_CASH:  'collected_cash',     // المندوب قبض نقداً
  COLLECTED_QR:    'collected_qr',       // المندوب قبض بتحويل على حسابه
  /* ادّعاءُ الزبون أنه حوّل — لا مالٌ تحرّك بعد.
   *
   * ويُقيَّد مع ذلك، ومبلغُه صفرٌ في الميزان (`neutral`)، لأنه أهمّ
   * سطرٍ عند الخلاف: زبونٌ يقول «حوّلتُ الساعة الثالثة برقم كذا»
   * وأنت لم تجد التحويل — السطر يقول متى ادّعى وبأي رقم، فتبحث في
   * كشفك بدل أن تتجادلا بالذاكرة. */
  QR_CLAIMED:      'qr_claimed',         // الزبون أبلغ أنه حوّل — لم يُؤكَّد بعد
  PAID_ONLINE:     'paid_online',        // وصل زادنا مباشرةً (بطاقة/محفظة)
  CUSTOMER_CONFIRM:'customer_confirmed', // الزبون أقرّ بالدفع
  PAID_RESTAURANT: 'paid_restaurant',    // المندوب دفع للمحلّ نقداً
  DELIVERED:       'delivered',          // سُلّم الطلب
  SETTLE_IN:       'settle_in',          // المندوب سدّد لزادنا
  SETTLE_OUT:      'settle_out',         // زادنا دفعت للمندوب
  PARTNER_PAYOUT:  'partner_payout',     // زادنا دفعت للمحلّ
  CANCELLED:       'cancelled',          // أُلغي الطلب
  REFUND_DUE:      'refund_due',         // استرداد مستحقّ للزبون
  REFUND_PAID:     'refund_paid',        // نُفّذ الاسترداد
  REVERSAL:        'reversal',           // قيدٌ مضادّ يُلغي أثر قيدٍ سابق
};

/** وصفٌ عربي لكل نوع — تعرضه اللوحة بلا خريطة ثانية تختلف عنها. */
const KIND_AR = {
  order_created:      'أُنشئ الطلب',
  collected_cash:     'تحصيل نقدي',
  collected_qr:       'تحصيل بتحويل QR',
  qr_claimed:         'الزبون أبلغ عن تحويل — بانتظار التأكيد',
  paid_online:        'دُفع إلكترونياً لزادنا',
  customer_confirmed: 'الزبون أكّد الدفع',
  paid_restaurant:    'دُفع للمحلّ نقداً',
  delivered:          'سُلّم الطلب',
  settle_in:          'تسوية — سدّد لزادنا',
  settle_out:         'دفعة — زادنا دفعت له',
  partner_payout:     'تحويل للمحلّ',
  cancelled:          'أُلغي الطلب',
  refund_due:         'استرداد مستحقّ',
  refund_paid:        'نُفّذ الاسترداد',
  reversal:           'قيد مضادّ (تصحيح)',
};

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ============================================================
   القيد الواحد

   `direction` يقول أين ذهب المال من زاوية **زادنا**:
     · `in`      دخل إلينا
     · `out`     خرج منّا
     · `neutral` تحرّك بين طرفين ولم يمرّ بنا (كاش الزبون→المندوب)

   والثالث ليس تكاسلاً: نموذج الكاش كلّه محايد بالنسبة لخزنتك، وما
   يبقى عليك منه هو العمولة وحدها. فلو سمّيناه `in` لبدا أن مئةً
   وخمسة عشر شيكلاً دخلت خزنتك وهي لم تلمسها.
   ============================================================ */
function entryOf({ kind, orderId, amount, direction, actorId, actorRole, actorName,
                   reference, note, meta }) {
  if (!Object.values(KINDS).includes(String(kind))) {
    throw new Error(`نوع قيد غير معروف: ${kind}`);
  }
  return {
    kind: String(kind),
    kindAr: KIND_AR[kind] || String(kind),
    orderId: orderId ? String(orderId) : null,
    amount: r2(amount),
    direction: ['in', 'out', 'neutral'].includes(direction) ? direction : 'neutral',

    // من فعلها — بلا هذا لا يحسم القيد خلافاً
    actorId: actorId ? String(actorId) : null,
    actorRole: String(actorRole || 'system'),   // customer · driver · partner · admin · system
    actorName: String(actorName || ''),

    reference: reference ? String(reference).slice(0, 120) : null,
    note: note ? String(note).slice(0, 300) : null,
    meta: meta && typeof meta === 'object' ? meta : null,

    at: new Date(),
  };
}

/* ============================================================
   الكتابة — لا تُسقط العملية إن فشلت.

   المندوب سلّم الطلب فعلاً، والزبون استلم طعامه. فلو تعثّرت الكتابة
   في الدفتر (شبكة · حصة · خطأ) لا يجوز أن نُرجع خطأً للتطبيق فيظنّ
   المندوب أن التسليم لم يُسجَّل ويُعيده.

   لكن الصمت خطر أيضاً: دفترٌ ينقصه قيدٌ ولا أحد يعلم. فنصرخ في
   السجلّ برمزٍ مميّز يسهل البحث عنه.
   ============================================================ */
async function record(db, payload) {
  if (!db) return null;
  try {
    const e = entryOf(payload);
    const ref = await db.collection('ledger').add(e);
    meter.addWrites && meter.addWrites(1, 'قيد دفتر');
    return { id: ref.id, ...e };
  } catch (err) {
    console.error('🚨 LEDGER_WRITE_FAILED — قيدٌ ضاع:',
      JSON.stringify({ kind: payload && payload.kind, orderId: payload && payload.orderId,
                       amount: payload && payload.amount, err: err.message }));
    return null;
  }
}

/** عدة قيود دفعةً واحدة — لحدثٍ يُنتج أكثر من أثر. */
async function recordMany(db, payloads) {
  if (!db || !Array.isArray(payloads) || !payloads.length) return [];
  const out = [];
  for (const p of payloads) out.push(await record(db, p));
  return out;
}

/* ============================================================
   القيد المضادّ — الطريقة **الوحيدة** لتصحيح خطأ.

   لا تحذف القيد الخاطئ ولا تعدّله. أضف نقيضه: نفس المبلغ، اتجاهٌ
   معاكس، وإشارةٌ إلى الأصل. فيصير المجموع صحيحاً ويبقى الأثر كاملاً.

   ولماذا هذا مهمّ عملياً لا نظرياً: مندوبٌ يرى في كشفه قيداً خاطئاً
   ثم يراه اختفى يفقد الثقة في الدفتر كلّه. وحين يرى الخطأ ومعه
   تصحيحه يفهم ما جرى — ويصدّق ما بقي.
   ============================================================ */
async function reverse(db, originalEntryId, { actorId, actorRole, actorName, reason }) {
  if (!db || !originalEntryId) return null;
  try {
    const snap = await db.collection('ledger').doc(String(originalEntryId)).get();
    meter.addReads(1, 'قراءة قيد للعكس');
    if (!snap.exists) return null;

    const o = snap.data() || {};
    if (o.reversedBy) {
      console.warn('⚠️ محاولة عكس قيدٍ معكوسٍ سلفاً:', originalEntryId);
      return null;
    }

    const flip = o.direction === 'in' ? 'out' : o.direction === 'out' ? 'in' : 'neutral';
    const rev = await record(db, {
      kind: KINDS.REVERSAL,
      orderId: o.orderId,
      amount: o.amount,
      direction: flip,
      actorId, actorRole, actorName,
      reference: o.reference,
      note: `عكسُ قيد ${originalEntryId}${reason ? ' — ' + reason : ''}`,
      meta: { reversesEntryId: String(originalEntryId), originalKind: o.kind },
    });

    /* نُعلّم الأصل بأنه عُكس — وهذه **ليست** مخالفةً لقاعدة «لا تعديل»:
     * لا نمسّ المبلغ ولا الاتجاه ولا الفاعل. نضيف إشارةً تمنع عكسه
     * مرّتين، والمبلغ الأصلي يبقى كما قُيّد حرفاً بحرف. */
    if (rev) {
      await db.collection('ledger').doc(String(originalEntryId))
        .update({ reversedBy: rev.id, reversedAt: new Date() });
    }
    return rev;
  } catch (err) {
    console.error('🚨 LEDGER_REVERSE_FAILED:', err.message);
    return null;
  }
}

/* ============================================================
   قراءة قصّة طلبٍ واحد — مرتَّبةً زمنياً.

   هذه الشاشة التي تفتحها حين يقول مندوب «أنا سلّمتها ودفع» ويقول
   الزبون غير ذلك. لا رأي فيها ولا تفسير — سطورٌ بأوقاتها وفاعليها.
   ============================================================ */
async function storyOf(db, orderId) {
  if (!db || !orderId) return [];
  try {
    const snap = await db.collection('ledger').where('orderId', '==', String(orderId)).get();
    meter.addReads(snap.size || 1, 'قصّة طلب');
    const out = [];
    snap.forEach(d => out.push({ id: d.id, ...d.data() }));
    out.sort((a, b) => atMs(a) - atMs(b));
    return out;
  } catch (err) {
    console.error('❌ قراءة قصّة الطلب:', err.message);
    return [];
  }
}

/** الوقت بالميلي — يقبل Date و Timestamp و ISO. */
function atMs(e) {
  const v = e && e.at;
  if (!v) return 0;
  if (typeof v.toDate === 'function') { try { return v.toDate().getTime(); } catch (x) { return 0; } }
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  const d = new Date(v);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/* ============================================================
   حركة اليوم — ما وصلك وما عليك وما لك.

   القراءة بنافذةٍ زمنية لا بالمجموعة كلّها: الدفتر ينمو أبداً ولا
   يُقلَّم، وقراءته كاملةً كل مرّة تلتهم الحصة خلال أسابيع.
   ============================================================ */
async function movement(db, fromDate, toDate) {
  if (!db) return null;
  const from = fromDate instanceof Date ? fromDate : new Date(fromDate || Date.now() - 86400000);
  const to   = toDate   instanceof Date ? toDate   : new Date(toDate   || Date.now());

  try {
    /* استعلامٌ بحقلٍ واحد (`at`) بمدىً — لا يحتاج فهرساً مركّباً.
     * أي شرطٍ ثانٍ مع المدى يطلب فهرساً، وغيابه يرمي خطأً لا صفراً. */
    const snap = await db.collection('ledger')
      .where('at', '>=', from)
      .where('at', '<=', to)
      .get();
    meter.addReads(snap.size || 1, 'حركة الدفتر');

    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    rows.sort((a, b) => atMs(b) - atMs(a));   // الأحدث أولاً

    const sum = (pred) => r2(rows.filter(pred).reduce((s, e) => s + (Number(e.amount) || 0), 0));
    const K = KINDS;

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      count: rows.length,

      // ما وصل زادنا فعلاً (بطاقة/محفظة) — لا الكاش الذي لم يمرّ بها
      receivedOnline: sum(e => e.kind === K.PAID_ONLINE),

      // ما حصّله المناديب — نقداً وبالتحويل
      collectedCash: sum(e => e.kind === K.COLLECTED_CASH),
      collectedQr:   sum(e => e.kind === K.COLLECTED_QR),

      // حركة الخزنة
      settledIn:     sum(e => e.kind === K.SETTLE_IN),
      paidToDrivers: sum(e => e.kind === K.SETTLE_OUT),
      paidToPartners:sum(e => e.kind === K.PARTNER_PAYOUT),

      refundsDue:    sum(e => e.kind === K.REFUND_DUE),
      refundsPaid:   sum(e => e.kind === K.REFUND_PAID),

      /* ═══ الخلاصة: كم صار لك فعلاً في هذه المدّة ═══
       *
       * تُحسب من `direction` وحده لا من قائمة أنواع. وهذا مقصود:
       * لو أضفنا نوع قيدٍ جديداً غداً ونسينا تحديث هذه الدالة، بقي
       * الصافي صحيحاً — لأن كل قيدٍ يحمل اتجاهه معه. المجموع الذي
       * يعتمد على قائمةٍ يدوية يكذب أوّل يوم تُنسى القائمة.
       *
       * وهو يبتلع التصحيحات تلقائياً: القيد المضادّ يحمل الاتجاه
       * المعاكس، فيلغي أصله في الجمع بلا استثناءٍ خاص.
       *
       * و`neutral` خارج الحساب عمداً — كاشٌ مرّ بين الزبون والمندوب
       * والمحلّ ولم يلمس خزنتك. عدُّه دخلاً يضخّم أرقامك أضعافاً. */
      totalIn:  sum(e => e.direction === 'in'),
      totalOut: sum(e => e.direction === 'out'),
      net: r2(
        rows.reduce((s, e) => {
          const a = Number(e.amount) || 0;
          if (e.direction === 'in') return s + a;
          if (e.direction === 'out') return s - a;
          return s;
        }, 0)
      ),

      orders:        rows.filter(e => e.kind === K.ORDER_CREATED).length,
      delivered:     rows.filter(e => e.kind === K.DELIVERED).length,
      cancelled:     rows.filter(e => e.kind === K.CANCELLED).length,
      reversals:     rows.filter(e => e.kind === K.REVERSAL).length,

      entries: rows.slice(0, 200),
    };
  } catch (err) {
    console.error('❌ حركة الدفتر:', err.message);
    return { error: err.message, entries: [] };
  }
}

module.exports = { KINDS, KIND_AR, record, recordMany, reverse, storyOf, movement, atMs, r2 };
