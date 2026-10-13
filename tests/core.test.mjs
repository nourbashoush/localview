import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

await import("../core.js");
const core = globalThis.LocalViewCore;

const settings = (overrides = {}) => core.normalizeSettings({
  interfaceLanguage: "ja",
  resultsLanguage: "en",
  region: "us",
  ...overrides
});

test("normalizeSettings rejects unknown values and keeps products on by default", () => {
  const s = core.normalizeSettings({ interfaceLanguage: "xx", region: "JP", products: { maps: false } });
  assert.equal(s.interfaceLanguage, "default");
  assert.equal(s.region, "jp");
  assert.equal(s.products.maps, false);
  assert.equal(s.products.search, true);
  assert.deepEqual(s.presets, []);
});

test("productForUrl identifies the nine products", () => {
  const cases = {
    "https://www.google.com/search?q=a": "search",
    "https://www.google.co.jp/search?q=a&tbm=isch": "images",
    "https://www.google.com/search?tbm=nws&q=a": "news",
    "https://www.google.com/search?q=a&tbm=shop": "shopping",
    "https://www.google.com/search?q=a&tbm=vid": "videos",
    "https://www.google.com/search?q=a&tbm=bks": "books",
    "https://www.google.com/maps/place/x": "maps",
    "https://maps.google.de/": "maps",
    "https://news.google.com/home": "news",
    "https://books.google.fr/books?id=1": "books",
    "https://images.google.com/": "images",
    "https://www.google.com/travel/flights": "flights",
    "https://www.google.com/travel/hotels/x": "hotels",
    "https://shopping.google.com/": "shopping"
  };
  for (const [url, product] of Object.entries(cases)) {
    assert.equal(core.productForUrl(url), product, url);
  }
  assert.equal(core.productForUrl("https://www.google.com/"), null);
  assert.equal(core.productForUrl("https://www.google.com/search"), null);
  assert.equal(core.productForUrl("https://example.com/search?q=a"), null);
  assert.equal(core.productForUrl("https://google.com.evil.net/search?q=a"), null);
  assert.equal(core.productForUrl("https://mail.google.com/mail"), null);
});

test("normalizeUrl sets hl, lr and gl on search", () => {
  const out = new URL(core.normalizeUrl("https://www.google.com/search?q=a", settings()));
  assert.equal(out.searchParams.get("hl"), "ja");
  assert.equal(out.searchParams.get("lr"), "lang_en");
  assert.equal(out.searchParams.get("gl"), "us");
});

test("normalizeUrl is idempotent", () => {
  const s = settings();
  const once = core.normalizeUrl("https://www.google.com/search?q=a&hl=fr", s);
  assert.equal(core.normalizeUrl(once, s), null);
});

test("a value at Google default is left alone, so Google's own filters stay", () => {
  const out = core.normalizeUrl("https://www.google.com/search?q=a&gl=fr&hl=de", settings({ region: "default" }));
  const url = new URL(out);
  assert.equal(url.searchParams.get("gl"), "fr");
  assert.equal(url.searchParams.get("hl"), "ja");
  const rules = core.buildRules(settings({ region: "default" }));
  assert.ok(rules.every((r) => !r.action.redirect?.transform.queryTransform.removeParams));
});

test("udm search tabs count as Images and Videos", () => {
  assert.equal(core.productForUrl("https://www.google.com/search?q=a&udm=2"), "images");
  assert.equal(core.productForUrl("https://www.google.com/search?udm=7&q=a"), "videos");
  assert.equal(core.productForUrl("https://www.google.com/search?q=a&udm=14"), "search");
  const rules = core.buildRules(settings({ products: { images: false } }));
  const images = rules.find((r) => r.condition.regexFilter.includes("udm=2"));
  assert.equal(images.action.type, "allow");
  assert.ok(new RegExp(images.condition.regexFilter).test("https://www.google.com/search?q=a&udm=2"));
  assert.ok(!new RegExp(images.condition.regexFilter).test("https://www.google.com/search?q=a&udm=21"));
});

test("normalizeUrl does nothing when every value is Google default", () => {
  const s = core.normalizeSettings({});
  assert.equal(core.normalizeUrl("https://www.google.com/search?q=a&hl=fr", s), null);
});

test("surface pages use the results language for hl and never get lr", () => {
  const s = settings({ interfaceLanguage: "default" });
  const url = new URL(core.normalizeUrl("https://www.google.com/maps", s));
  assert.equal(url.searchParams.get("hl"), "en");
  assert.equal(url.searchParams.get("gl"), "us");
  assert.equal(url.searchParams.has("lr"), false);
});

test("disabled products are left alone", () => {
  const s = settings({ products: { images: false } });
  assert.equal(core.normalizeUrl("https://www.google.com/search?q=a&tbm=isch", s), null);
  assert.notEqual(core.normalizeUrl("https://www.google.com/search?q=a", s), null);
});

test("buildRules returns no rules for Google default", () => {
  assert.deepEqual(core.buildRules(core.normalizeSettings({})), []);
});

test("buildRules makes valid, unique main-frame redirect rules", () => {
  const rules = core.buildRules(settings());
  const ids = rules.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const rule of rules) {
    assert.ok(Number.isInteger(rule.id) && rule.id > 0);
    assert.deepEqual(rule.condition.resourceTypes, ["main_frame"]);
    assert.deepEqual(rule.condition.requestDomains, [...core.GOOGLE_DOMAINS]);
    assert.ok(rule.condition.regexFilter.length < 200, "regex stays small");
    new RegExp(rule.condition.regexFilter);
  }
  const search = rules.find((r) => r.condition.regexFilter.includes("/search") && r.priority === 1);
  assert.deepEqual(search.action.redirect.transform.queryTransform.addOrReplaceParams, [
    { key: "hl", value: "ja" },
    { key: "lr", value: "lang_en" },
    { key: "gl", value: "us" }
  ]);
});

test("rule regexes match the same URLs as productForUrl", () => {
  const rules = core.buildRules(settings());
  const urls = [
    "https://www.google.com/search?q=a",
    "https://www.google.co.uk/search?hl=en&q=a",
    "https://www.google.com/search?q=a&tbm=isch",
    "https://maps.google.com/",
    "https://www.google.com/maps/@1,2,3z",
    "https://news.google.com/",
    "https://www.google.com/travel/flights?x=1",
    "https://www.google.com/imghp"
  ];
  for (const url of urls) {
    assert.ok(rules.some((r) => new RegExp(r.condition.regexFilter, "i").test(url)), url);
  }
  for (const url of ["https://www.google.com/", "https://www.google.com/searchx?q=a", "https://www.google.com/mapsx"]) {
    assert.ok(!rules.some((r) => new RegExp(r.condition.regexFilter, "i").test(url)), url);
  }
});

test("a disabled tbm vertical gets a higher-priority allow rule", () => {
  const rules = core.buildRules(settings({ products: { news: false } }));
  const news = rules.find((r) => r.condition.regexFilter.includes("tbm=nws"));
  assert.equal(news.action.type, "allow");
  assert.equal(news.priority, 2);
});

test("a disabled product gets no redirect rule", () => {
  const rules = core.buildRules(settings({ products: { maps: false } }));
  assert.ok(!rules.some((r) => r.condition.regexFilter.includes("maps")));
});

test("badgeText shows the active language code", () => {
  assert.equal(core.badgeText(settings()), "JA");
  assert.equal(core.badgeText(settings({ interfaceLanguage: "default" })), "EN");
  assert.equal(core.badgeText(core.normalizeSettings({})), "");
});

test("isGoogleHostname accepts only listed domains", () => {
  assert.ok(core.isGoogleHostname("www.google.co.jp"));
  assert.ok(core.isGoogleHostname("google.com"));
  assert.ok(!core.isGoogleHostname("notgoogle.com"));
  assert.ok(!core.isGoogleHostname("google.com.example.org"));
});

test("manifest permissions stay minimal and match the domain list", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.permissions, ["storage", "declarativeNetRequestWithHostAccess"]);
  const subs = ["", "www.", "maps.", "news.", "books.", "images.", "shopping."];
  const expected = core.GOOGLE_DOMAINS.flatMap((d) => subs.map((s) => `*://${s}${d}/*`));
  assert.deepEqual(manifest.host_permissions, expected);
  assert.deepEqual(manifest.content_scripts[0].matches, expected);
});

test("every locale has the same keys and the new name", async () => {
  // Folder names must be Chrome locale codes: Chinese is zh_CN, Portuguese pt_BR.
  const langs = ["ar", "de", "en", "es", "fr", "it", "ja", "ko", "nl", "pt_BR", "ru", "zh_CN"];
  const load = async (l) => JSON.parse(await readFile(new URL(`../_locales/${l}/messages.json`, import.meta.url), "utf8"));
  const en = await load("en");
  for (const lang of langs) {
    const catalog = await load(lang);
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(en).sort(), lang);
    assert.equal(catalog.ext_name.message, "LocalView for Google™");
    assert.ok(!JSON.stringify(catalog).includes("Locale Switch"), lang);
  }
});

test("codes keep Google's spelling whatever the case", () => {
  const c = core.normalizeChoice({ interfaceLanguage: "ZH-cn", resultsLanguage: "zh-tw", region: "BR" });
  assert.equal(c.interfaceLanguage, "zh-CN");
  assert.equal(c.resultsLanguage, "zh-TW");
  assert.equal(c.region, "br");
  assert.equal(core.searchParams(c).lr, "lang_zh-TW");
});

test("results language accepts only languages Google can filter by", () => {
  assert.equal(core.normalizeChoice({ resultsLanguage: "sw" }).resultsLanguage, "default");
  assert.equal(core.normalizeChoice({ interfaceLanguage: "sw" }).interfaceLanguage, "sw");
});

test("lists have no duplicates and cover many countries", () => {
  for (const list of [core.DISPLAY_LANGUAGES, core.RESULT_LANGUAGES, core.REGIONS]) {
    assert.equal(new Set(list).size, list.length);
  }
  assert.ok(core.REGIONS.length > 200);
  assert.ok(core.DISPLAY_LANGUAGES.length > 70);
});

test("every option has a real name, not just its code", () => {
  for (const field of ["interfaceLanguage", "resultsLanguage", "region"]) {
    for (const o of core.choiceOptions(field, () => "", "en").slice(1)) {
      assert.notEqual(o.label.toLowerCase(), o.value.toLowerCase(), `${field} ${o.value}`);
    }
  }
});

test("browser languages are suggested first", () => {
  const entries = core.choiceOptions("interfaceLanguage", () => "", "en", ["ja-JP", "zh-TW", "en-US"]);
  assert.deepEqual(entries[1].options.map((o) => o.value), ["ja", "zh-TW", "en"]);
  const regions = core.choiceOptions("region", () => "", "en", ["ja-JP", "en-US"]);
  assert.deepEqual(regions[1].options.map((o) => o.value), ["jp", "us"]);
});

test("badge shows only the language part", () => {
  assert.equal(core.badgeText(core.normalizeChoice({ interfaceLanguage: "pt-BR" })), "PT");
});

test("product settings keep only real values", () => {
  const s = core.normalizeSettings({
    productSettings: { maps: { interfaceLanguage: "ja" }, news: {}, nope: { region: "jp" } }
  });
  assert.deepEqual(Object.keys(s.productSettings), ["maps"]);
  assert.equal(s.productSettings.maps.region, "default");
});

test("a product's own values win; its defaults follow Everywhere", () => {
  const s = core.normalizeSettings({
    interfaceLanguage: "en",
    region: "us",
    productSettings: { maps: { interfaceLanguage: "ja" } }
  });
  assert.deepEqual(core.choiceForProduct(s, "maps"), { interfaceLanguage: "ja", resultsLanguage: "default", region: "us" });
  const maps = new URL(core.normalizeUrl("https://www.google.com/maps/place/x", s));
  assert.equal(maps.searchParams.get("hl"), "ja");
  assert.equal(maps.searchParams.get("gl"), "us");
  const search = new URL(core.normalizeUrl("https://www.google.com/search?q=a", s));
  assert.equal(search.searchParams.get("hl"), "en");
});

test("rules use each product's own choice", () => {
  const s = core.normalizeSettings({
    interfaceLanguage: "en",
    productSettings: { maps: { interfaceLanguage: "ja" }, news: { interfaceLanguage: "ja" } }
  });
  const rules = core.buildRules(s);
  const ids = rules.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  const hl = (r) => r.action.redirect?.transform.queryTransform.addOrReplaceParams?.find((p) => p.key === "hl")?.value;
  assert.equal(hl(rules.find((r) => r.condition.regexFilter.includes("maps"))), "ja");
  assert.equal(hl(rules.find((r) => r.condition.regexFilter.includes("tbm=nws"))), "ja");
  assert.equal(hl(rules.find((r) => r.priority === 1 && r.condition.regexFilter.includes("/search"))), "en");
});

test("a product's own settings work when Everywhere is Google default", () => {
  const s = core.normalizeSettings({ productSettings: { maps: { interfaceLanguage: "ja" } } });
  const rules = core.buildRules(s);
  assert.equal(rules.filter((r) => r.action.type === "redirect").length, 1);
  assert.equal(core.normalizeUrl("https://www.google.com/search?q=a", s), null);
  assert.notEqual(core.normalizeUrl("https://www.google.com/maps", s), null);
});

test("pageProduct counts the home page as Search", () => {
  assert.equal(core.pageProduct("https://www.google.com/"), "search");
  assert.equal(core.pageProduct("https://www.google.com/maps/@1,2,3z"), "maps");
  assert.equal(core.pageProduct("https://mail.google.com/"), null);
});

test("Google News: only plain addresses get settings, edition URLs are left alone", () => {
  const s = settings();
  const rules = core.buildRules(s);
  const news = rules.find((r) => r.priority === 1 && r.condition.regexFilter.includes("news"));
  const re = new RegExp(news.condition.regexFilter, "i");
  assert.ok(re.test("https://news.google.com/"));
  assert.ok(re.test("https://news.google.com/home"));
  assert.ok(!re.test("https://news.google.com/home?hl=ja&gl=JP&ceid=JP:ja"));
  assert.ok(!news.action.redirect.transform.queryTransform.addOrReplaceParams.some((p) => p.key === "lr"));
  assert.equal(core.normalizeUrl("https://news.google.com/home?hl=en-US&gl=US&ceid=US:en", s), null);
  assert.equal(new URL(core.normalizeUrl("https://news.google.com/", s)).searchParams.get("hl"), "ja");
});

test("a Videos-only setting still creates its rule", () => {
  const s = core.normalizeSettings({ productSettings: { videos: { interfaceLanguage: "ja" } } });
  const rules = core.buildRules(s);
  const videos = rules.find((r) => r.condition.regexFilter.includes("udm=7"));
  assert.equal(videos.action.type, "redirect");
});

test("udm=28 is Shopping, and pages outside /search get no lr", () => {
  assert.equal(core.productForUrl("https://www.google.com/search?q=tv&udm=28"), "shopping");
  const s = settings();
  for (const url of ["https://images.google.com/", "https://books.google.com/books?id=1", "https://www.google.com/shopping"]) {
    assert.equal(new URL(core.normalizeUrl(url, s)).searchParams.has("lr"), false, url);
  }
  assert.equal(new URL(core.normalizeUrl("https://www.google.com/search?q=a&tbm=isch", s)).searchParams.get("lr"), "lang_en");
});
