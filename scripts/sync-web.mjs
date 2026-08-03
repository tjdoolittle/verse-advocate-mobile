// Pull the current web app into www/ straight from the public verse-advocate
// repo, so this repo is self-sufficient on any machine (no sibling checkout).
//
//   npm run sync:web        # refresh www/ from GitHub main
//   npm run sync            # ...then npx cap sync (both platforms)
//
// The NET Bible files are deliberately never fetched: that translation is
// licensed for non-commercial use only and is not redistributed here.

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAW = "https://raw.githubusercontent.com/tjdoolittle/verse-advocate/main";
const WWW = join(dirname(fileURLToPath(import.meta.url)), "..", "www");

// Everything the app loads at runtime. Site-only files (privacy.html,
// .nojekyll, README) are intentionally excluded from the app bundle.
const FILES = [
  "index.html",
  "manifest.json",
  "sw.js",
  "icon-192.png",
  "icon-512.png",
  "web.verses.txt",
  "web.info.json",
  "kjv.json",
  "Tyndale.verses.txt",
  "Tyndale.info.json",
];

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

await mkdir(WWW, { recursive: true });

let failed = 0;
for (const name of FILES) {
  const url = `${RAW}/${name}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(join(WWW, name), buf);
    console.log(`  ok  ${name.padEnd(22)} ${kb(buf.length)}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${name}: ${err.message}`);
  }
}

if (failed) {
  console.error(`\n${failed} file(s) failed — www/ may be incomplete.`);
  process.exit(1);
}
console.log(`\nwww/ is up to date with ${RAW}`);
console.log("Next: npx cap sync");
