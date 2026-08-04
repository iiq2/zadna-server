/* ============================================================
   عدّاد عمليات Firestore.

   الرقم الرسمي عند جوجل يأتي من نظام قياس منفصل لا يقرؤه سيرفرنا
   بلا إعداد إضافي. فنَعُدّ بأنفسنا: كل مستند نقرؤه أو نكتبه يُحسب هنا.

   ولماذا نتعب في هذا أصلاً؟
   لأنّ ليلةً كاملة ضاعت ونحن نجهل أنّ استعلاماً واحداً يلتهم الحصة.
   لم يكن العطل خفيّاً — كان **غير مرئي**. ومن لا يقيس لا يعرف أنّ
   شيئاً ساء إلا حين يتوقّف كل شيء.

   والعدّاد يبدأ من صفر عند كل إعادة تشغيل — لأنّ حفظه في قاعدة
   البيانات يعني كتابةً في كل عملية، أي أن نُشعل النار لنقيس حرارتها.
   ومع «مدة التشغيل» بجانبه يُعطي المعدّل بدقّة كافية: من يرى ٢٠٠
   قراءة في الدقيقة يعرف أنّه ذاهب إلى ٢٨٨ ألفاً في اليوم قبل أن
   يصل إليها.
   ============================================================ */

const startedAt = Date.now();
let reads = 0, writes = 0;
const byWhat = {};   // أين تُستهلك؟ — التفصيل يوفّر جولة تخمين كاملة

/** يُسجّل قراءة مستندات. `n` عدد المستندات لا عدد الاستعلامات. */
function addReads(n, what = 'other') {
  const c = Number(n) || 0;
  if (c <= 0) return;
  reads += c;
  byWhat[what] = (byWhat[what] || 0) + c;
}

function addWrites(n, what = 'other') {
  const c = Number(n) || 0;
  if (c <= 0) return;
  writes += c;
}

/* الحصة المجانية اليومية — نعرضها ليقيس عليها لا ليحفظها.
   وهي مجانية حتى على Blaze: لا يُحاسَب إلا ما فوقها. */
const FREE_READS = 50000;
const FREE_WRITES = 20000;

function stats() {
  const upMs = Date.now() - startedAt;
  const upMin = Math.max(1, Math.round(upMs / 60000));
  const perMin = reads / upMin;
  // الإسقاط اليومي: أنفع رقم في الشاشة كلّها — يقول إلى أين تسير
  const projectedDaily = Math.round(perMin * 60 * 24);

  const top = Object.entries(byWhat)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([k, v]) => ({ ما: k, قراءات: v }));

  return {
    منذ_التشغيل_دقيقة: upMin,
    قراءات: reads,
    كتابات: writes,
    قراءات_بالدقيقة: Math.round(perMin * 10) / 10,
    الإسقاط_اليومي: projectedDaily,
    نسبة_الحصة: Math.round((projectedDaily / FREE_READS) * 100),
    الحصة_اليومية: FREE_READS,
    الأعلى_استهلاكاً: top,
    // تقدير التكلفة لو استمرّ هذا المعدّل شهراً كاملاً
    تقدير_الشهر_بالدولار:
      Math.round(Math.max(0, projectedDaily - FREE_READS) * 30 / 100000 * 0.06 * 100) / 100,
  };
}

module.exports = { addReads, addWrites, stats, FREE_READS, FREE_WRITES };
