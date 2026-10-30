// Render a wide splash / banner graphic that matches the web app's look.
//
//   node scripts/splash-banner.mjs <width> <height>
//
// Writes store-listing/splash-<width>x<height>.png. Type and colour are taken
// from www/index.html, so the banner stays consistent with the main page.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'store-listing');

const [W, H] = process.argv.slice(2).map(Number);
if (!W || !H) {
  console.error('usage: node scripts/splash-banner.mjs <width> <height>');
  process.exit(1);
}

// Tokens copied from www/index.html.
const C = {
  bg: '#f6f2ea', ink: '#2b2620', inkSoft: '#6b6257',
  accent: '#8a3324', gold: '#b08d3e', line: '#e2d9c8',
};

// Everything scales off viewport height, so the same lockup works at 16:9 and
// at ultra-wide ratios without re-tuning.
const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; }
  body {
    background: ${C.bg};
    font-family: Georgia, 'Times New Roman', serif;
    display: flex; align-items: center; justify-content: center;
    gap: 7vh;
    -webkit-font-smoothing: antialiased;
  }
  .icon {
    width: 34vh; height: 34vh; border-radius: 22%;
    box-shadow: 0 1.2vh 4vh rgba(43, 38, 32, 0.18);
    flex: none;
  }
  .lockup { max-width: 62%; }
  h1 {
    font-size: 13vh; line-height: 1.05; font-weight: 700;
    letter-spacing: 0.3vh; color: ${C.accent}; white-space: nowrap;
  }
  h1 .amp { color: ${C.gold}; }
  .rule {
    height: 0.35vh; width: 16vh; margin: 3vh 0;
    background: ${C.gold}; opacity: 0.75; border-radius: 1vh;
  }
  p { font-size: 4.6vh; font-style: italic; color: ${C.inkSoft}; line-height: 1.35; }
  .meta {
    margin-top: 3.2vh; font-size: 2.9vh; font-style: normal;
    color: ${C.ink}; opacity: 0.62; letter-spacing: 0.15vh;
  }
</style></head>
<body>
  <img class="icon" src="/icon.png" alt="">
  <div class="lockup">
    <h1>Verse <span class="amp">&amp;</span> Advocate</h1>
    <div class="rule"></div>
    <p>Say what's on your mind — find the verses that speak to it.</p>
    <p class="meta">WEB · King James · Tyndale — entirely offline</p>
  </div>
</body></html>`;

const server = createServer(async (req, res) => {
  if (req.url.startsWith('/icon.png')) {
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end(await readFile(join(ROOT, 'assets', 'icon.png')));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(html);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
await page.screenshot({ path: join(OUT, `splash-${W}x${H}.png`) });
await browser.close();
server.close();
console.log(`store-listing/splash-${W}x${H}.png`);
