#!/usr/bin/env node
/* يشغّل كل الاختبارات ويُرجع 1 إن فشل أيٌّ منها.
 * كلٌّ في عملية مستقلّة: بعضها يحقن وحداتٍ وهمية في require.cache،
 * وتشغيلها في عملية واحدة يجعل أحدها يُفسد الآخر. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname)
  .filter(f => f.startsWith('test-') && f.endsWith('.js')).sort();

let bad = 0, total = 0;
for (const f of files) {
  process.stdout.write(f.padEnd(26));
  try {
    /* stderr مبتلَع: الاختبارات تتعمّد إثارة أخطاء لتفحص أن الكود
     * لا يسقط بها، فسجلّاتها ضجيجٌ يخفي النتيجة. */
    const out = execFileSync(process.execPath, [path.join(__dirname, f)],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const m = out.match(/(\d+)\s*(?:نجحت|نجح)/) || out.match(/نجح:\s*(\d+)/);
    console.log('✅ ' + (m ? m[1] + ' فحصاً' : 'تمّ'));
    total += m ? Number(m[1]) : 0;
  } catch (e) {
    bad++;
    console.log('❌ فشل');
    console.log((e.stdout || '').split('\n').filter(l => l.includes('❌')).join('\n'));
  }
}
console.log(bad ? `\n❌ ${bad} ملفّ فشل` : `\n✅ ${total} فحصاً — كلها خضراء`);
process.exit(bad ? 1 : 0);
