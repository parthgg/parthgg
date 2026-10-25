import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const pw = require('playwright'); import fs from 'fs';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +(process.argv[3] || 1080), height: +(process.argv[4] || 1920) } });
const [w0, h0] = [+(process.argv[3] || 1080), +(process.argv[4] || 1920)];
await page.goto(`http://127.0.0.1:8765/index.html?w=${w0}&h=${h0}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
for (let f = 0; f < 996; f += 3) {
  const url = await page.evaluate(t => window.maskAt(t), f / 24);
  fs.writeFileSync(`${out}/m_${String(f).padStart(5, '0')}.png`, Buffer.from(url.split(',')[1], 'base64'));
}
await browser.close(); console.log('done');
