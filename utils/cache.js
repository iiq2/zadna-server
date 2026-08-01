// كاش مشترك في الذاكرة — يحمي حصة Firestore المجانية (50 ألف قراءة/يوم).
// كل التطبيقات واللوحة تستطلع بالتوازي؛ بدون هذا الكاش كل استطلاع = قراءة
// مجموعة كاملة، وهذا ما استنفد الحصة مراراً.

const store = new Map();

/**
 * يعيد القيمة المخزّنة إن كانت طازجة، وإلا ينفّذ loader ويخزّن نتيجته.
 * الطلبات المتزامنة على نفس المفتاح تتشارك نفس الوعد (لا قراءات مكرّرة).
 */
async function cached(key, ttlMs, loader) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.pending || hit.value;
  const pending = (async () => {
    const value = await loader();
    store.set(key, { value, expires: Date.now() + ttlMs, pending: null });
    return value;
  })();
  // نخزّن الوعد فوراً كي لا ينطلق أكثر من استعلام لنفس المفتاح
  store.set(key, { value: hit ? hit.value : null, expires: now + ttlMs, pending });
  try {
    return await pending;
  } catch (e) {
    store.delete(key);          // لا نُخزّن الفشل
    if (hit && hit.value) return hit.value;  // نُرجع آخر نسخة ناجحة إن وُجدت
    throw e;
  }
}

/**
 * يُعدّل القيمة المخزّنة مكانها بدل مسحها.
 * السيرفر هو الكاتب الوحيد، فتعديل الكاش محلياً يبقيه صحيحاً بلا قراءة جديدة.
 * هذا الفرق بين 72 ألف قراءة/يوم و 12 ألف.
 */
function updateCached(key, mutator) {
  const hit = store.get(key);
  if (!hit || !Array.isArray(hit.value)) return false;
  try {
    const next = mutator(hit.value);
    if (Array.isArray(next)) { store.set(key, { ...hit, value: next }); return true; }
  } catch (e) { store.delete(key); }
  return false;
}

/** يُبطل الكاش بعد أي كتابة، فيرى المستخدم أثر تعديله فوراً. */
function invalidate(...keys) {
  if (!keys.length) return store.clear();
  keys.forEach(k => store.delete(k));
}

module.exports = { cached, invalidate, updateCached };
