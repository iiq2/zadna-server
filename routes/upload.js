const express = require('express');
const router = express.Router();

/* ============================================================================
 * رفع صور المنتجات وواجهات المطاعم
 *
 * كان السيرفر يقبل حقل `imageUrl` نصّاً في `restaurants.js` و`mart.js`، ولا
 * وجود في أي تطبيق لمنتقي صور ولا لرافع. فالحقل ينتظر رابطاً وصاحب المطعم
 * لا يملك سبيلاً لصنع رابط — والناس يطلبون بأعينهم، فمنيو بلا صور لا يبيع.
 *
 * ثلاثة قرارات في هذا الملف تستحقّ التعليل:
 *
 * ١ · المفتاح لا يدخل التطبيق أبداً.
 *    لو نادى التطبيقُ ImgBB مباشرة لشُحن `IMGBB_KEY` داخل الـAPK، ومن
 *    يستخرج الحزمة يستنزف حصتك أو يرفع بها ما يشاء باسمك. السيرفر يرفع
 *    نيابةً عنه، والمفتاح لا يغادر Render.
 *
 * ٢ · نستقبل الصورة **خاماً** بنوع `image/*` لا JSON.
 *    حدّ الطلب العام 256 كيلوبايت — أصغر من أي صورة. ورفعُه عالمياً يفتح
 *    باب إغراق على كل مسار في المنصّة. وبنوع `image/*` لا يمسّ الطلبَ
 *    مُحلّلُ JSON أصلاً، فيبقى الحدّ العام على حاله ويُستثنى هذا المسار وحده.
 *
 * ٣ · الشركاء وحدهم يرفعون.
 *    مسار رفع مفتوح للجميع يعني أن حصتك المجانية تُستنزف في ليلة.
 * ========================================================================== */

const IMGBB_KEY = process.env.IMGBB_KEY || '';
const MAX_BYTES = 5 * 1024 * 1024;          // 5 ميغابايت
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

if (!IMGBB_KEY) {
  console.warn('⚠️ IMGBB_KEY غير مضبوط — رفع الصور معطّل (لا ينكسر شيء آخر)');
}

/* حدّ معدّل خاص بالرفع.
 * الحدّ العام 600 طلب/دقيقة مناسب لطلبات صغيرة، لا لخمسة ميغابايت
 * لكل واحد. مطعمٌ يبني منيوه يرفع عشرين صورة في جلسة، لا مئتين. */
const hits = new Map();
function uploadLimit(req, res, next) {
  const id = String((req.user && req.user.userId) || req.ip || 'anon');
  const now = Date.now();
  const rec = hits.get(id) || { n: 0, until: now + 3600000 };
  if (now > rec.until) { rec.n = 0; rec.until = now + 3600000; }
  rec.n++;
  hits.set(id, rec);
  if (rec.n > 60) {
    return res.status(429).json({
      success: false,
      error: 'رفعت صوراً كثيرة في وقت قصير — انتظر قليلاً ثم أكمل'
    });
  }
  next();
}
// كنس دوري كي لا تكبر الخريطة بلا حدّ
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now > v.until) hits.delete(k);
}, 600000).unref?.();

router.post(
  '/upload_image',
  express.raw({ type: ALLOWED, limit: MAX_BYTES }),
  uploadLimit,
  async (req, res) => {
    try {
      if (!IMGBB_KEY) {
        return res.status(503).json({
          success: false,
          error: 'رفع الصور غير مفعّل حالياً — تواصل مع إدارة زادنا'
        });
      }

      // الشركاء وحدهم. الزبون لا يرفع شيئاً إلى المنيو.
      const type = String((req.user && req.user.userType) || '');
      if (!req.isAdmin && !['restaurant', 'market', 'manager'].includes(type)) {
        return res.status(403).json({ success: false, error: 'هذه الخدمة لشركاء زادنا' });
      }

      const buf = req.body;
      if (!Buffer.isBuffer(buf) || buf.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'لم تصل الصورة — أعد اختيارها'
        });
      }
      if (buf.length > MAX_BYTES) {
        return res.status(413).json({
          success: false,
          error: 'الصورة كبيرة جداً — اختر صورة أصغر من 5 ميغابايت'
        });
      }

      const form = new FormData();
      form.append('image', buf.toString('base64'));

      let r;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 30000);
        r = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(IMGBB_KEY)}`, {
          method: 'POST',
          body: form,
          signal: ctrl.signal
        });
        clearTimeout(t);
      } catch (e) {
        console.error('❌ تعذّر الوصول إلى ImgBB:', e.message);
        return res.status(503).json({
          success: false, busy: true,
          error: 'خدمة الصور بطيئة الآن — أعد المحاولة بعد دقيقة'
        });
      }

      const d = await r.json().catch(() => ({}));
      const url = d && d.data && (d.data.display_url || d.data.url);

      if (!r.ok || !url) {
        // نطبع سبب المزوّد لنا، ولا نُلقيه على صاحب المطعم
        console.error('❌ ImgBB رفض الرفع:', r.status, JSON.stringify(d).slice(0, 300));
        return res.status(502).json({
          success: false,
          error: 'تعذّر حفظ الصورة — جرّب صورة أخرى، وإن تكرّر تواصل معنا'
        });
      }

      console.log(`🖼️ رُفعت صورة (${Math.round(buf.length / 1024)}ك) لـ${type}`);
      return res.json({
        success: true,
        url,
        deleteUrl: (d.data && d.data.delete_url) || null,  // نحفظه لعلّنا نحتاجه
        sizeKb: Math.round(buf.length / 1024)
      });
    } catch (error) {
      const fail = req.app.get('failJson');
      if (fail) return fail(res, error, 'رفع صورة');
      console.error('❌ رفع صورة:', error.message);
      return res.status(500).json({ success: false, error: 'تعذّر رفع الصورة' });
    }
  }
);

module.exports = router;
