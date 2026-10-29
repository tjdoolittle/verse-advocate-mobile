// Generate App Store / Play Store screenshots from the real web app in www/.
//
//   node scripts/screenshots.mjs <logicalW> <logicalH> <scale> <prefix>
//
// Output pixel size is logicalW*scale x logicalH*scale, which is what the
// stores actually check. Pick a logical size and scale that multiply out to
// the size App Store Connect asks for on the relevant tab, e.g.
//
//   402 874 3  ios-iphone63   -> 1206x2622  (iPhone, Dynamic Island, medium)
//   440 956 3  ios-iphone69   -> 1320x2868  (iPhone 6.9")
//   688 918 3  ios-ipad13     -> 2064x2752  (iPad 13")
//
// Files land in store-listing/ as <prefix>-1-home.png and so on, overwriting
// whatever is already there under that prefix.
//
// Needs Playwright once: npm i -D playwright && npx playwright install chromium

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Playwright may live in a global tools dir that ESM resolution does not search.
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WWW = join(ROOT, 'www');
const OUT = join(ROOT, 'store-listing');

const [w, h, scale, prefix] = process.argv.slice(2);
if (!prefix) {
  console.error('usage: node scripts/screenshots.mjs <logicalW> <logicalH> <scale> <prefix>');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json',
};

// The app fetches its verse files, so file:// will not do — serve www/.
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  // Resolve to the real file first: the content type has to come from that,
  // not from the request path, or "/" is served as a download.
  const file = path === '/' ? 'index.html' : path;
  try {
    const body = await readFile(join(WWW, file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({
  viewport: { width: +w, height: +h },
  deviceScaleFactor: +scale,
});

const shot = (name) => page.screenshot({ path: join(OUT, `${prefix}-${name}.png`) });

// The verse index loads asynchronously; touching the UI before it settles
// produces empty screenshots.
const ready = () =>
  page.waitForFunction(() => {
    const s = document.querySelector('#status');
    return s && !/load/i.test(s.textContent);
  }, { timeout: 60000 });

async function search(q) {
  await page.fill('#query', q);
  await page.click('#go');
  await page.waitForSelector('button[data-ctx]', { timeout: 30000 });
  await page.waitForTimeout(400);
}

// Put the results summary at the top of the frame so the shot is full of
// matches rather than app chrome.
async function scrollToResults() {
  await page.evaluate(() => {
    const s = document.querySelector('#status');
    if (s) window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - 8);
  });
  await page.waitForTimeout(250);
}

const QUERY = 'forgiveness is better than revenge';

await page.goto(base, { waitUntil: 'networkidle' });
await ready();
await shot('1-home');

await search(QUERY);
await scrollToResults();
await shot('2-results');

await page.click('button[data-ctx]');
await page.waitForTimeout(500);
await scrollToResults();
await shot('3-context');

await page.selectOption('#translation', 'kjv');
await page.waitForTimeout(1500);
await ready();
await search(QUERY);
await scrollToResults();
await shot('4-kjv');

await browser.close();
server.close();
console.log(`${prefix}: 4 screenshots at ${+w * +scale}x${+h * +scale} in store-listing/`);
