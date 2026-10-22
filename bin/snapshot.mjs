#!/usr/bin/env node
// Screenshots a built flow-paths page so it can be looked at before it is shared.
//
//   node bin/snapshot.mjs <page.html> <out-dir>
//
// Writes one PNG per tab (All, then each path) in light and dark, and reports whether the page
// scrolls sideways at desktop or phone width. Needs Google Chrome or Chromium installed.

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    try { return execFileSync("which", [name], { encoding: "utf8" }).trim(); } catch (_) {}
  }
  return null;
}

// The spec sits on one line of the page as `const spec = {...};`.
function readSpec(page) {
  const m = page.match(/const spec = (\{.*\});\n/);
  if (!m) throw new Error("this does not look like a page built by flow-paths");
  return JSON.parse(m[1]);
}

// Blink's preferredColorScheme: 0 is dark, 1 is light.
const chrome = (bin, args) => execFileSync(bin, ["--headless=new", "--disable-gpu", "--hide-scrollbars", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 60000 });

function main(argv) {
  if (argv.length !== 2) {
    console.error("usage: node bin/snapshot.mjs <page.html> <out-dir>");
    return 2;
  }
  const [pagePath, outDir] = argv.map(p => resolve(p));
  const bin = findChrome();
  if (!bin) {
    console.error("Chrome or Chromium was not found. Install one, or set CHROME_PATH.");
    return 1;
  }
  const page = readFileSync(pagePath, "utf8");
  const spec = readSpec(page);
  mkdirSync(outDir, { recursive: true });
  const url = pathToFileURL(pagePath).href;
  const tabs = ["all", ...spec.paths.map(p => p.id)];

  for (const tab of tabs) for (const [theme, scheme] of [["light", 1], ["dark", 0]]) {
    const file = join(outDir, `${tab}-${theme}.png`);
    chrome(bin, [`--blink-settings=preferredColorScheme=${scheme}`, "--window-size=1360,1250", "--virtual-time-budget=2600", `--screenshot=${file}`, tab === "all" ? url : `${url}#${tab}`]);
    console.log(`Wrote ${file}`);
  }

  // A copy that writes its own scroll width into the title, read back from the DOM dump.
  const probe = join(outDir, `.probe-${basename(pagePath)}`);
  const measure = "<script>setTimeout(()=>{document.title='W'+document.documentElement.scrollWidth+'/'+innerWidth},300)</script>";
  writeFileSync(probe, page.includes("</body>") ? page.replace("</body>", `${measure}</body>`) : page + measure);
  let ok = true;
  for (const width of [1360, 500]) {
    const dom = chrome(bin, [`--window-size=${width},900`, "--virtual-time-budget=1500", "--dump-dom", pathToFileURL(probe).href]);
    const m = dom.match(/<title>W(\d+)\/(\d+)<\/title>/);
    if (!m) { console.log(`width ${width}: could not measure`); ok = false; continue; }
    const [scroll, inner] = [Number(m[1]), Number(m[2])];
    const fits = scroll <= inner;
    ok = ok && fits;
    console.log(`width ${inner}: ${fits ? "no sideways scroll" : `scrolls sideways (${scroll}px of content)`}`);
  }
  rmSync(probe, { force: true });
  return ok ? 0 : 1;
}

process.exit(main(process.argv.slice(2)));
