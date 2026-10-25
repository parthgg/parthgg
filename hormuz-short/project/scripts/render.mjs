// usage: node render.mjs <outDir> <fps> <t0> <t1> [w h] [times...]
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
let pw; try { pw = require('playwright'); } catch { pw = require('/usr/local/lib/node_modules/playwright'); }
import fs from 'fs';
const [out, fps, t0, t1, w = 1080, h = 1920, ...times] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[err]', e.message));
const PAGE = process.env.PAGE || 'index.html';
await page.goto(`http://127.0.0.1:8765/${PAGE}?w=${w}&h=${h}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
await page.evaluate(() => document.fonts.ready);
const list = times.length ? times.map(Number) : [];
if (!list.length) for (let f = Math.round(t0 * fps); f < Math.round(t1 * fps); f++) list.push(f / fps);
const st = Date.now();
for (const t of list) {
  await page.evaluate(t => window.renderAt(t), t);
  const name = times.length ? `t_${t.toFixed(2)}.png` : `f_${String(Math.round(t * fps)).padStart(5, '0')}.png`;
  await page.screenshot({ path: `${out}/${name}`, type: 'png', omitBackground: PAGE !== 'index.html' });
}
console.log('frames', list.length, 'sec/frame', ((Date.now() - st) / 1000 / list.length).toFixed(2));
await browser.close();
