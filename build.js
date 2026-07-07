/* =========================================================
   CoreStorm Global — build.js
   Packages the site into ONE self-contained index.html for
   hosting as a static artifact under a strict CSP
   (no external requests permitted).

   Assets are already local (see scripts/fetch-assets.js, which
   downloads the stock images + fonts into assets/). This build:

     1. Embeds every assets/img/*.jpg referenced by the page
        as a base64 JPEG data URI.
     2. Embeds Playfair Display (600 normal + italic, latin)
        as woff2 data URIs. Body text falls back to a
        system-ui stack — Inter is NOT embedded, to keep the
        artifact lean.
     3. Inlines css/styles.css and js/main.js.
     4. Asserts ZERO remaining external asset URLs.

   Usage:  node build.js       (no network required)
   Output: build/index.html
   ========================================================= */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, "build");
const FONT_DIR = path.join(ROOT, "assets", "fonts");

const log = (...a) => console.log(...a);

/* =========================================================
   1. IMAGES  →  base64 data URIs from local files
   ========================================================= */
function inlineImages(html) {
  const refs = [...new Set(
    [...html.matchAll(/assets\/img\/[\w.-]+\.jpg/g)].map((m) => m[0])
  )];
  log(`\n🖼  Inlining ${refs.length} local images…`);

  let out = html;
  let total = 0;
  for (const ref of refs) {
    const file = path.join(ROOT, ref);
    if (!fs.existsSync(file)) throw new Error(`Missing image: ${ref}`);
    const buf = fs.readFileSync(file);
    total += buf.length;
    const dataUri = `data:image/jpeg;base64,${buf.toString("base64")}`;
    // Replace attribute-quoted references only.
    out = out.split(`"${ref}"`).join(`"${dataUri}"`);
    log(`   ✓ ${ref.padEnd(38)} ${(buf.length / 1024) | 0}KB`);
  }
  log(`   Σ ${(total / 1024) | 0}KB of imagery embedded`);
  return out;
}

/* =========================================================
   2. FONTS  →  Playfair Display woff2 data URIs
      (from assets/fonts/fonts.css; Inter is skipped — body
       falls back to system-ui in the artifact)
   ========================================================= */
function buildFontCss() {
  log(`\n🔤 Embedding Playfair Display (600 normal + italic)…`);
  const cssPath = path.join(FONT_DIR, "fonts.css");
  const css = fs.readFileSync(cssPath, "utf8");

  // Keep only Playfair @font-face blocks.
  const blocks = css.split("/*").map((b) => "/*" + b);
  const playfair = blocks.filter((b) => b.includes("Playfair"));
  if (!playfair.length) throw new Error("No Playfair blocks in fonts.css");

  let combined = playfair.join("\n");
  for (const [, fname] of combined.matchAll(/url\(([\w.-]+\.woff2)\)/g)) {
    const buf = fs.readFileSync(path.join(FONT_DIR, fname));
    const dataUri = `data:font/woff2;base64,${buf.toString("base64")}`;
    combined = combined.split(fname).join(dataUri);
    log(`   ✓ ${fname}  ${(buf.length / 1024) | 0}KB`);
  }
  return combined;
}

/* =========================================================
   MAIN
   ========================================================= */
try {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "css", "styles.css"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "js", "main.js"), "utf8");

  const fontCss = buildFontCss();
  html = inlineImages(html);

  // ---- swap the two stylesheet links for one inline block ----
  const bodyFontOverride =
    ":root{--font-body:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}";
  const styleBlock = `<style>\n${fontCss}\n${bodyFontOverride}\n${css}\n</style>`;
  html = html.replace(/\s*<link rel="stylesheet" href="assets\/fonts\/fonts\.css">/, "");
  html = html.replace(
    /<link rel="stylesheet" href="css\/styles\.css">/,
    styleBlock
  );

  // ---- inline script ----
  html = html.replace(
    /<script src="js\/main\.js" defer><\/script>/,
    `<script>\n${js}\n</script>`
  );

  // ---- write ----
  const outFile = path.join(OUT_DIR, "index.html");
  fs.writeFileSync(outFile, html);

  /* ---- verify: zero remaining external or file asset references ---- */
  const badPatterns = [
    /https?:\/\/images\.unsplash\.com/g,
    /https?:\/\/fonts\.googleapis\.com/g,
    /https?:\/\/fonts\.gstatic\.com/g,
    /url\(\s*https?:/g,
    /<link[^>]*rel="stylesheet"[^>]*href="(?!data:)[^"]/g,
    /<script[^>]+src=/g,
    /<img[^>]+src="(?!data:)/g,
    /src="assets\//g,
  ];
  let offenders = 0;
  for (const p of badPatterns) {
    const hits = html.match(p);
    if (hits) {
      offenders += hits.length;
      log(`   ✗ ${hits.length}× ${p}`);
    }
  }

  const kb = (fs.statSync(outFile).size / 1024) | 0;
  log(`\n📦 Wrote ${path.relative(ROOT, outFile)}  (${kb} KB)`);

  const remaining = [...new Set(
    [...html.matchAll(/https?:\/\/[^"'\s)]+/g)].map((x) => x[0])
  )];
  log(`\nℹ  ${remaining.length} non-asset URL(s) remain (metadata only):`);
  remaining.forEach((u) => log(`   · ${u}`));

  if (offenders === 0) {
    log(`\n✅ SUCCESS — zero external asset requests. Artifact is CSP-safe.`);
  } else {
    log(`\n❌ FAILED — ${offenders} external asset reference(s) still present.`);
    process.exit(1);
  }
} catch (err) {
  console.error("\n💥 Build failed:", err.message);
  process.exit(1);
}
