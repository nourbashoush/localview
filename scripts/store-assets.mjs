// Renders the Chrome Web Store screenshots (1280×800) for every interface
// language, plus the promo tile (440×280), from the real popup and options
// page. Text comes from _locales and store-assets/text.json.
//
// Usage: node scripts/store-assets.mjs [lang ...]
// Needs Google Chrome; set CHROME to its path if it is not in the usual place.
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "store-assets");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TEXT = JSON.parse(await readFile(join(OUT, "text.json"), "utf8"));
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TEXT);
const COLOURS = ["#3B7CEC", "#E33E2A", "#F1B500", "#2BA24C"];
// _locales folders use Chrome's locale codes.
const LOCALE_DIR = { pt: "pt_BR", zh: "zh_CN" };

const work = await mkdtemp(join(tmpdir(), "localview-store-"));
const css = await readFile(join(ROOT, "style.css"), "utf8");
// The light theme, forced: screenshots should not follow this computer's theme.
const lightVars = css.match(/:root \{([\s\S]*?)\n\}/)[1].replace(/;/g, " !important;");

function escape(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

// The popup or options page with a fake chrome API holding sample settings.
async function extensionPage(file, lang, store, tabUrl) {
  const messages = await readFile(join(ROOT, "_locales", LOCALE_DIR[lang] || lang, "messages.json"), "utf8");
  const stub = `<script>
const M = ${messages};
const special = { "@@ui_locale": "${lang}", "@@bidi_dir": "${lang === "ar" ? "rtl" : "ltr"}" };
let store = ${JSON.stringify(store)};
window.chrome = {
  i18n: {
    getMessage(key, subs) {
      if (key in special) return special[key];
      const entry = M[key];
      if (!entry) return "";
      let text = entry.message;
      for (const [name, p] of Object.entries(entry.placeholders || {})) text = text.split("$" + name.toUpperCase() + "$").join(p.content);
      (subs || []).forEach((v, i) => { text = text.split("$" + (i + 1)).join(v); });
      return text;
    },
    getUILanguage: () => "${lang}"
  },
  storage: { sync: { get: async () => JSON.parse(JSON.stringify(store)), set: async (v) => Object.assign(store, v) }, onChanged: { addListener() {} } },
  runtime: { sendMessage: async () => ({ ok: true }), openOptionsPage() {}, getManifest: () => ({ version: "1.0.0" }) },
  tabs: { query: async () => [{ id: 1, url: "${tabUrl}" }], reload: async () => {} }
};
Object.defineProperty(navigator, "languages", { get: () => ["${lang}", "en"] });
</script><style>:root {${lightVars}} body.popup { width: auto !important; }</style>`;
  const html = (await readFile(join(ROOT, file), "utf8"))
    .replace("<head>", `<head><base href="file://${ROOT}/">${stub}`);
  const path = join(work, `${file.replace(".html", "")}-${lang}-${Math.random().toString(36).slice(2)}.html`);
  await writeFile(path, html);
  return path;
}

// A screenshot: headline on one side, the framed page on the other.
async function shotPage(lang, [title, sub], framePath, frame) {
  const rtl = lang === "ar";
  const bar = COLOURS.map((c) => `<span style="background:${c}"></span>`).join("");
  const html = `<!doctype html><html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><style>
@font-face { font-family: "Baloo UI"; src: url("file://${ROOT}/fonts/BalooBhaijaan2.woff2"); font-weight: 400 800; }
body { margin: 0; width: 1280px; height: 800px; overflow: hidden; box-sizing: border-box; padding: 0 90px;
  display: flex; align-items: center; gap: 56px; background: linear-gradient(135deg, #eaf0fb, #f6f8fc 60%, #eef3fd);
  font-family: "Baloo UI", ui-rounded, -apple-system, system-ui, "Hiragino Sans", "Apple SD Gothic Neo", "PingFang SC", "Geeza Pro", sans-serif; }
.text { flex: 1; min-width: 0; }
.bar { display: flex; gap: 6px; width: 220px; margin-bottom: 34px; }
.bar span { flex: 1; height: 7px; border-radius: 9px; }
h1 { font-size: 52px; line-height: 1.15; margin: 0 0 18px; color: #2f3136; font-weight: 700; text-wrap: balance; word-break: auto-phrase; overflow-wrap: break-word; hyphens: auto; }
p { font-size: 24px; line-height: 1.45; margin: 0; color: #62666e; text-wrap: pretty; word-break: auto-phrase; }
.frame { flex: none; width: ${BOX.width}px; height: ${BOX.height}px; border-radius: 22px; overflow: hidden;
  background: #eaf0fb; box-shadow: 0 2px 6px rgba(0,0,0,.06), 0 24px 60px rgba(30,50,90,.16); }
iframe { width: ${frame.w}px; height: ${frame.h}px; border: 0; transform: scale(${frame.scale}); transform-origin: 0 0; }
[dir="rtl"] iframe { transform-origin: 100% 0; }
</style></head><body>
<div class="text"><div class="bar">${bar}</div><h1>${escape(title)}</h1><p>${escape(sub)}</p></div>
<div class="frame"><iframe src="file://${framePath}"></iframe></div>
</body></html>`;
  const path = join(work, `shot-${lang}-${Math.random().toString(36).slice(2)}.html`);
  await writeFile(path, html);
  return path;
}

function render(htmlPath, pngPath, width, height) {
  return new Promise((resolve, reject) => {
    execFile(CHROME, [
      "--headless=new", "--hide-scrollbars", "--force-prefers-reduced-motion", "--allow-file-access-from-files",
      `--user-data-dir=${join(work, "profile-" + Math.random().toString(36).slice(2))}`,
      "--virtual-time-budget=4000", `--window-size=${width},${height}`, `--screenshot=${pngPath}`, `file://${htmlPath}`
    ], { timeout: 60000 }, (error) => (error ? reject(error) : resolve()));
  });
}

function presets(names) {
  return [
    { name: names[0], interfaceLanguage: "ja", resultsLanguage: "ja", region: "jp" },
    { name: names[1], interfaceLanguage: "en", resultsLanguage: "en", region: "us" },
    { name: names[2], interfaceLanguage: "de", resultsLanguage: "de", region: "de" }
  ];
}

const SEARCH = "https://www.google.com/search?q=coffee";
const MAPS = "https://www.google.com/maps/place/Tokyo";
// Every screenshot shows its page in the same box, at the same place, so the
// four line up when the store shows them side by side. The page is rendered
// a little wider than in Chrome (popup 400 px, options 600 px) and scaled to
// fill the box.
const BOX = { width: 480, height: 720 };
const POPUP = 400;
const OPTIONS = 600;
function frameFor(pageWidth) {
  const scale = BOX.width / pageWidth;
  return { w: pageWidth, h: Math.ceil(BOX.height / scale), scale };
}

async function buildLanguage(lang) {
  const text = TEXT[lang];
  const base = { presets: presets(text.presets), productSettings: {} };
  // Screenshot 3 shows the popup in another language: the interface speaks 12.
  const other = lang === "ja" ? "de" : "ja";
  const jobs = [
    [await extensionPage("popup.html", lang, { ...base, interfaceLanguage: "ja", resultsLanguage: "ja", region: "jp" }, SEARCH), frameFor(POPUP)],
    [await extensionPage("popup.html", lang, {
      ...base, interfaceLanguage: "en", resultsLanguage: "en", region: "us",
      productSettings: { maps: { interfaceLanguage: "ja", region: "jp" } }
    }, MAPS), frameFor(POPUP)],
    [await extensionPage("popup.html", other, {
      ...base, presets: presets(TEXT[other].presets), interfaceLanguage: "de", resultsLanguage: "de", region: "de"
    }, SEARCH), frameFor(POPUP)],
    [await extensionPage("options.html", lang, {
      ...base, interfaceLanguage: "ja", resultsLanguage: "ja", region: "jp",
      products: { books: false }, productSettings: { maps: { interfaceLanguage: "ja", region: "jp" } }
    }, SEARCH), frameFor(OPTIONS)]
  ];
  const dir = join(OUT, lang);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "description.txt"), `${text.description}\n`);
  await Promise.all(jobs.map(async ([page, frame], i) => {
    const shot = await shotPage(lang, text.shots[i], page, frame);
    await render(shot, join(dir, `screenshot-${i + 1}.png`), 1280, 800);
  }));
  console.log(`${lang}: 4 screenshots`);
}

async function buildTile() {
  const bar = COLOURS.map((c) => `<span style="background:${c}"></span>`).join("");
  const path = join(work, "tile.html");
  await writeFile(path, `<!doctype html><html><head><style>
@font-face { font-family: "Baloo UI"; src: url("file://${ROOT}/fonts/BalooBhaijaan2.woff2"); font-weight: 400 800; }
body { margin: 0; width: 440px; height: 280px; overflow: hidden; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 14px; background: linear-gradient(135deg, #eaf0fb, #f6f8fc); font-family: "Baloo UI", sans-serif; }
img { width: 112px; height: 112px; }
.name { font-size: 38px; font-weight: 700; color: #2f3136; }
.bar { display: flex; gap: 5px; width: 150px; } .bar span { flex: 1; height: 6px; border-radius: 9px; }
</style></head><body><img src="file://${ROOT}/assets/icon.svg"><div class="name">LocalView</div><div class="bar">${bar}</div></body></html>`);
  await render(path, join(OUT, "promo-tile-440x280.png"), 440, 280);
}

try {
  await buildTile();
  // A few languages at a time, to keep the machine responsive.
  for (let i = 0; i < LANGS.length; i += 3) {
    await Promise.all(LANGS.slice(i, i + 3).map(buildLanguage));
  }
} finally {
  await rm(work, { recursive: true, force: true });
}
