// Renders the store promo videos (1920×1080, 60 fps, about 7 seconds), one per
// interface language: the LocalView demo from nour.page in a scene that fits
// that language's speakers (scripts/video/scenes.json), then an end card.
// Each frame is the animation frozen at an exact time, so the video is smooth.
//
// Usage: node scripts/store-video.mjs [lang ...]   → store-assets/<lang>/video.mp4
// Needs Google Chrome and ffmpeg. Set CHROME / FFMPEG if they are elsewhere.
import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const SCENES = JSON.parse(await readFile(join(ROOT, "scripts/video/scenes.json"), "utf8"));
const TEXT = JSON.parse(await readFile(join(ROOT, "store-assets/text.json"), "utf8"));
const CSS = await readFile(join(ROOT, "scripts/video/demo.css"), "utf8");
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES);

await import(join(ROOT, "core.js"));
const core = globalThis.LocalViewCore;

const LOCALE_DIR = { pt: "pt_BR", zh: "zh_CN" };
// The Google language code each viewer switches to.
const GOOGLE_CODE = { zh: "zh-CN", pt: "pt-BR" };
const RESULTS_CODE = { zh: "zh-CN", pt: "pt" };

// Timeline (ms). The demo's own loop is 8 s; the video uses its first part
// (pick both languages, Apply, page switches), then fades to the end card.
const FPS = 60;
const DEMO_END = 4600;
const FADE = 600;
const TOTAL = 7400;

const escape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

async function scenePage(lang) {
  const scene = SCENES[lang];
  const messages = JSON.parse(await readFile(join(ROOT, "_locales", LOCALE_DIR[lang] || lang, "messages.json"), "utf8"));
  const msg = (key) => messages[key]?.message || "";
  const ui = lang === "zh" ? "zh-CN" : lang === "pt" ? "pt-BR" : lang;
  const label = (field, code) => core.labelFor(field, code, msg, ui);
  const rtl = lang === "ar";
  const toDir = rtl ? ' dir="rtl"' : "";
  const fromDir = scene.from === "ar" ? ' dir="rtl"' : "";
  const tabs = (list) => list.map((t, i) => `<b${i === 0 ? ' class="on"' : ""}>${escape(t)}</b>`).join("");
  const results = (side) => scene.results.map((r, i) =>
    `<li${side === "to" ? ` style="--n: ${i}"` : ""}><small>${escape(r[side][0])}</small><b>${escape(r[side][1])}</b><span>${escape(r[side][2])}</span></li>`).join("");
  const icon = `file://${ROOT}/assets/icon.svg`;
  const tagline = TEXT[lang].description.split("\n")[0];
  const bar = "<span></span><span></span><span></span><span></span>";

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
/* As in the extension: Baloo with its vertical space balanced, so text sits centred in pills. */
@font-face { font-family: "Baloo UI"; src: url("file://${ROOT}/fonts/BalooBhaijaan2.woff2"); font-weight: 400 800; ascent-override: 95%; descent-override: 35%; line-gap-override: 0%; }
@font-face { font-family: "Nunito Cyrillic"; src: url("file://${ROOT}/fonts/Nunito-Cyrillic.woff2"); font-weight: 400 800; unicode-range: U+0400-052F; }
html, body { margin: 0; width: 960px; height: 540px; overflow: hidden; }
body { background: linear-gradient(135deg, #eaf0fb, #f6f8fc 60%, #eef3fd); font-family: "Baloo UI", system-ui, sans-serif; }
.scene { position: absolute; inset: 0; display: grid; place-items: center; }
.demo { width: 880px; margin: 0 !important; }
.stage { font-size: 13px !important; }
.popup { font-family: "Baloo UI", "Nunito Cyrillic", ui-rounded, system-ui, "Hiragino Sans", "Apple SD Gothic Neo", "PingFang SC", "Geeza Pro", sans-serif !important; }
.browser { font-family: Arial, Helvetica, "Hiragino Sans", "Apple SD Gothic Neo", "PingFang SC", "Geeza Pro", sans-serif !important; }
.end { opacity: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; text-align: center; }
.end img { width: 120px; height: 120px; }
.end .name { font-size: 56px; font-weight: 700; color: #2f3136; line-height: 1; }
.end .tag { font-size: 24px; color: #62666e; max-width: 640px; font-family: "Baloo UI", "Nunito Cyrillic", system-ui, "Hiragino Sans", "Apple SD Gothic Neo", "PingFang SC", "Geeza Pro", sans-serif; }
.end .bar { display: flex; gap: 6px; width: 200px; direction: ltr; } .end .bar span { flex: 1; height: 7px; border-radius: 9px; }
.end .bar span:nth-child(1) { background: #3b7cec; } .end .bar span:nth-child(2) { background: #e33e2a; }
.end .bar span:nth-child(3) { background: #f1b500; } .end .bar span:nth-child(4) { background: #2ba24c; }
${CSS}
</style></head><body>
<div class="scene" id="demo-scene"><figure class="demo playing" data-demo>
  <div class="stage">
    <div class="browser">
      <div class="toolbar"><span class="dots"><i></i><i></i><i></i></span>
        <span class="address">google.com/search?q=${escape(scene.query.replace(/ /g, "+"))}</span>
        <img class="extension" src="${icon}" alt="" width="16" height="16"></div>
      <span class="loading"></span>
      <div class="page">
        <span class="search">${escape(scene.query)}<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg></span>
        <div class="swap tabs"><span class="out"${fromDir}>${tabs(scene.tabs.from)}</span><span class="in"${toDir}>${tabs(scene.tabs.to)}</span></div>
        <div class="swap count"><span class="out"${fromDir}>${escape(scene.count.from)}</span><span class="in"${toDir}>${escape(scene.count.to)}</span></div>
        <div class="swap results"><ol class="out"${fromDir}>${results("from")}</ol><ol class="in"${toDir}>${results("to")}</ol></div>
      </div>
    </div>
    <div class="popup"${rtl ? ' dir="rtl"' : ""}>
      <div class="stripe">${bar}</div>
      <p class="brand"><img src="${icon}" alt="" width="22" height="22">LocalView</p>
      <div class="row"><span class="label"><svg class="blue" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="3.5"/><path d="M3.5 9h17"/></svg>${escape(msg("label_interface_language"))}</span>
        <span class="select swap first"><span class="out">${escape(label("interfaceLanguage", scene.from))}</span><span class="in">${escape(label("interfaceLanguage", GOOGLE_CODE[lang] || lang))}</span></span></div>
      <div class="row"><span class="label"><svg class="red" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>${escape(msg("label_results_language"))}</span>
        <span class="select swap second"><span class="out">${escape(label("resultsLanguage", scene.from))}</span><span class="in">${escape(label("resultsLanguage", RESULTS_CODE[lang] || lang))}</span></span></div>
      <div class="row"><span class="label"><svg class="green" viewBox="0 0 24 24"><path d="M12 20.5s6.5-5.6 6.5-10.5a6.5 6.5 0 0 0-13 0c0 4.9 6.5 10.5 6.5 10.5z"/><circle cx="12" cy="10" r="2.3"/></svg>${escape(msg("label_region"))}</span>
        <span class="select">${escape(label("region", scene.region))}</span></div>
      <div class="actions"><span class="pill primary">${escape(msg("button_apply"))}</span><span class="pill reset">${escape(msg("button_reset"))}</span></div>
      <span class="cursor"><svg viewBox="0 0 24 24"><path d="M5 2.5v16.2l4.1-3.9 2.8 6.3 2.9-1.3-2.8-6.2h5.8z"/></svg></span>
    </div>
  </div>
</figure></div>
<div class="scene end" id="end"${rtl ? ' dir="rtl"' : ""}>
  <img src="${icon}" alt=""><div class="name">LocalView</div><div class="tag">${escape(tagline)}</div><div class="bar">${bar}</div>
</div>
<script>
  // The pointer's stops, measured from the popup as laid out (as on nour.page).
  const popup = document.querySelector(".popup");
  const box = popup.getBoundingClientRect();
  const at = (el, x, y) => { const r = el.getBoundingClientRect(); return [r.left - box.left + r.width * x, r.top - box.top + r.height * y]; };
  const [s1, s2] = popup.querySelectorAll(".select.swap");
  const stops = [[box.width * 0.88, box.height - 12], at(s1, 0.62, 0.6), at(s2, 0.62, 0.6), at(popup.querySelector(".primary"), 0.58, 0.6), at(popup.querySelector(".reset"), 0.5, 0.6)];
  stops.forEach(([x, y], i) => { popup.style.setProperty("--x" + i, Math.round(x) + "px"); popup.style.setProperty("--y" + i, Math.round(y) + "px"); });
  // Freezes everything at time t (ms): the demo's animations, and the fade to the end card.
  window.frameAt = (t) => {
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = Math.min(t, ${DEMO_END}); }
    const f = Math.max(0, Math.min(1, (t - ${DEMO_END}) / ${FADE}));
    const ease = f * f * (3 - 2 * f);
    document.getElementById("demo-scene").style.opacity = 1 - ease;
    document.getElementById("demo-scene").style.transform = "scale(" + (1 - 0.03 * ease) + ")";
    const end = document.getElementById("end");
    end.style.opacity = ease;
    end.style.transform = "translateY(" + (10 * (1 - ease)) + "px)";
  };
</script>
</body></html>`;
}

// A minimal Chrome DevTools Protocol client over WebSocket.
async function openChrome(work) {
  const port = 9500 + Math.floor(Math.random() * 400);
  const chrome = spawn(CHROME, [
    "--headless=new", "--hide-scrollbars", "--allow-file-access-from-files", "--force-prefers-reduced-motion=0",
    `--user-data-dir=${join(work, "profile")}`, `--remote-debugging-port=${port}`, "about:blank"
  ], { stdio: "ignore" });
  let info;
  for (let i = 0; i < 100 && !info; i++) {
    await new Promise((r) => setTimeout(r, 100));
    info = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => null);
  }
  const page = info.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (data) => (data.error ? reject(new Error(data.error.message)) : resolve(data.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  return { send, close: () => { ws.close(); chrome.kill(); } };
}

function run(cmd, args) {
  return new Promise((resolve, reject) => execFile(cmd, args, { maxBuffer: 1 << 26 }, (e, _o, err) => (e ? reject(new Error(err || e.message)) : resolve())));
}

async function render(lang, work) {
  const html = join(work, `${lang}.html`);
  await writeFile(html, await scenePage(lang));
  const frames = join(work, `frames-${lang}`);
  await mkdir(frames, { recursive: true });
  const chrome = await openChrome(join(work, lang));
  try {
    await chrome.send("Emulation.setDeviceMetricsOverride", { width: 960, height: 540, deviceScaleFactor: 2, mobile: false });
    // The animation must play even if this Mac has "Reduce motion" turned on.
    await chrome.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
    await chrome.send("Page.enable");
    await chrome.send("Page.navigate", { url: `file://${html}` });
    await new Promise((r) => setTimeout(r, 1500)); // fonts and layout
    await chrome.send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
    const count = Math.round((TOTAL / 1000) * FPS);
    for (let i = 0; i < count; i++) {
      const t = (i * 1000) / FPS;
      await chrome.send("Runtime.evaluate", { expression: `frameAt(${t})` });
      const { data } = await chrome.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      await writeFile(join(frames, `${String(i).padStart(4, "0")}.png`), Buffer.from(data, "base64"));
    }
  } finally {
    chrome.close();
  }
  const out = join(ROOT, "store-assets", lang, "video.mp4");
  await run(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(frames, "%04d.png"),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", out]);
  console.log(`${lang}: ${out.replace(ROOT, "")}`);
}

const work = await mkdtemp(join(tmpdir(), "localview-video-"));
try {
  for (const lang of LANGS) await render(lang, work);
} finally {
  await rm(work, { recursive: true, force: true });
}
