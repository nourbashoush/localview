// Shared logic for LocalView. Loaded by the service worker (importScripts),
// the content script, the popup, the options page and the Node tests.
(function (root) {
  "use strict";

  // Main Google country domains for v1. Run scripts/build-hosts.mjs after
  // changing this list to update manifest.json.
  const GOOGLE_DOMAINS = Object.freeze([
    "google.com", "google.ae", "google.at", "google.be", "google.ca",
    "google.ch", "google.cl", "google.cn", "google.co.id", "google.co.in",
    "google.co.jp", "google.co.kr", "google.co.nz", "google.co.th", "google.co.uk",
    "google.co.za", "google.com.ar", "google.com.au", "google.com.br", "google.com.co",
    "google.com.eg", "google.com.hk", "google.com.mx", "google.com.my", "google.com.ph",
    "google.com.sa", "google.com.sg", "google.com.tr", "google.com.tw", "google.com.ua",
    "google.com.vn", "google.cz", "google.de", "google.dk", "google.es",
    "google.fi", "google.fr", "google.gr", "google.hu", "google.ie",
    "google.it", "google.nl", "google.no", "google.pl", "google.pt",
    "google.ro", "google.ru", "google.se"
  ]);

  // Google interface languages (hl). Google still uses "iw" for Hebrew.
  const DISPLAY_LANGUAGES = Object.freeze([
    "af", "am", "ar", "az", "be", "bg", "bn", "bs", "ca", "cs", "cy", "da", "de", "el", "en",
    "en-GB", "es", "es-419", "et", "eu", "fa", "fi", "fil", "fr", "ga", "gl", "gu", "hi", "hr", "hu",
    "hy", "id", "is", "it", "iw", "ja", "ka", "kk", "km", "kn", "ko", "ky", "lo", "lt", "lv",
    "mk", "ml", "mn", "mr", "ms", "my", "ne", "nl", "no", "pa", "pl", "pt-BR", "pt-PT", "ro", "ru",
    "si", "sk", "sl", "sq", "sr", "sv", "sw", "ta", "te", "th", "tr", "uk", "ur", "uz", "vi",
    "zh-CN", "zh-TW", "zu"
  ]);
  // Languages Google can filter results by (lr=lang_xx). A shorter list than hl.
  const RESULT_LANGUAGES = Object.freeze([
    "ar", "bg", "ca", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "hr", "hu", "id",
    "is", "it", "iw", "ja", "ko", "lt", "lv", "nl", "no", "pl", "pt", "ro", "ru", "sk", "sl",
    "sr", "sv", "tr", "zh-CN", "zh-TW"
  ]);
  // Countries and territories for gl (ISO 3166-1 alpha-2).
  const REGIONS = Object.freeze([
    "ad", "ae", "af", "ag", "ai", "al", "am", "ao", "ar", "as", "at", "au", "aw", "ax", "az", "ba", "bb", "bd", "be", "bf",
    "bg", "bh", "bi", "bj", "bl", "bm", "bn", "bo", "bq", "br", "bs", "bt", "bw", "by", "bz", "ca", "cc", "cd", "cf", "cg",
    "ch", "ci", "ck", "cl", "cm", "cn", "co", "cr", "cu", "cv", "cw", "cx", "cy", "cz", "de", "dj", "dk", "dm", "do", "dz",
    "ec", "ee", "eg", "eh", "er", "es", "et", "fi", "fj", "fk", "fm", "fo", "fr", "ga", "gb", "gd", "ge", "gf", "gg", "gh",
    "gi", "gl", "gm", "gn", "gp", "gq", "gr", "gs", "gt", "gu", "gw", "gy", "hk", "hn", "hr", "ht", "hu", "id", "ie", "il",
    "im", "in", "io", "iq", "ir", "is", "it", "je", "jm", "jo", "jp", "ke", "kg", "kh", "ki", "km", "kn", "kp", "kr", "kw",
    "ky", "kz", "la", "lb", "lc", "li", "lk", "lr", "ls", "lt", "lu", "lv", "ly", "ma", "mc", "md", "me", "mf", "mg", "mh",
    "mk", "ml", "mm", "mn", "mo", "mp", "mq", "mr", "ms", "mt", "mu", "mv", "mw", "mx", "my", "mz", "na", "nc", "ne", "nf",
    "ng", "ni", "nl", "no", "np", "nr", "nu", "nz", "om", "pa", "pe", "pf", "pg", "ph", "pk", "pl", "pm", "pn", "pr", "ps",
    "pt", "pw", "py", "qa", "re", "ro", "rs", "ru", "rw", "sa", "sb", "sc", "sd", "se", "sg", "sh", "si", "sj", "sk", "sl",
    "sm", "sn", "so", "sr", "ss", "st", "sv", "sx", "sy", "sz", "tc", "td", "tf", "tg", "th", "tj", "tk", "tl", "tm", "tn",
    "to", "tr", "tt", "tv", "tw", "tz", "ua", "ug", "us", "uy", "uz", "va", "vc", "ve", "vg", "vi", "vn", "vu", "wf", "ws",
    "ye", "yt", "za", "zm", "zw"
  ]);
  // Codes whose Google form is not the standard name for Intl.DisplayNames.
  const NAME_CODE = Object.freeze({ iw: "he", "zh-CN": "zh-Hans", "zh-TW": "zh-Hant" });

  const FIELDS = Object.freeze(["interfaceLanguage", "resultsLanguage", "region"]);
  const PRODUCTS = Object.freeze(["search", "maps", "images", "news", "shopping", "videos", "books", "flights", "hotels"]);
  // Search verticals that live on /search?tbm=...
  const TBM_BY_PRODUCT = Object.freeze({ images: "isch", news: "nws", shopping: "shop", videos: "vid", books: "bks" });
  // Newer Google search tabs use udm= instead of tbm= for some verticals.
  const UDM_BY_PRODUCT = Object.freeze({ images: "2", videos: "7", shopping: "28" });

  const DEFAULT = "default";
  const DEFAULT_SETTINGS = Object.freeze({
    interfaceLanguage: DEFAULT,
    resultsLanguage: DEFAULT,
    region: DEFAULT,
    products: Object.freeze(Object.fromEntries(PRODUCTS.map((p) => [p, true]))),
    presets: Object.freeze([]),
    productSettings: Object.freeze({})
  });

  // Matches without regard to case and returns Google's own spelling ("zh-CN").
  function pick(value, allowed) {
    const v = String(value || "").trim().toLowerCase();
    return allowed.find((code) => code.toLowerCase() === v) || DEFAULT;
  }

  function normalizeChoice(input) {
    const s = input || {};
    return {
      interfaceLanguage: pick(s.interfaceLanguage, DISPLAY_LANGUAGES),
      resultsLanguage: pick(s.resultsLanguage, RESULT_LANGUAGES),
      region: pick(s.region, REGIONS)
    };
  }

  function normalizeSettings(input) {
    const s = input || {};
    const products = {};
    for (const p of PRODUCTS) products[p] = s.products?.[p] !== false;
    const presets = Array.isArray(s.presets)
      ? s.presets
          .filter((p) => p && typeof p.name === "string" && p.name.trim())
          .map((p) => ({ name: p.name.trim(), ...normalizeChoice(p) }))
      : [];
    // productSettings: a product's own choice, for example Maps in Japanese.
    // A value left at "default" follows the main settings ("Everywhere").
    const productSettings = {};
    for (const product of PRODUCTS) {
      const own = normalizeChoice(s.productSettings?.[product]);
      if (!isDefaultChoice(own)) productSettings[product] = own;
    }
    return { ...normalizeChoice(s), products, presets, productSettings };
  }

  function isDefault(value) {
    return value === DEFAULT;
  }

  function isDefaultChoice(choice) {
    return isDefault(choice.interfaceLanguage) && isDefault(choice.resultsLanguage) && isDefault(choice.region);
  }

  // Parameters for Google Search and its tbm verticals.
  function searchParams(choice) {
    return {
      hl: isDefault(choice.interfaceLanguage) ? null : choice.interfaceLanguage,
      lr: isDefault(choice.resultsLanguage) ? null : `lang_${choice.resultsLanguage}`,
      gl: isDefault(choice.region) ? null : choice.region
    };
  }

  // Parameters for Maps, News, Books, travel and other non-search pages.
  // These have no lr, so the results language is used for hl as a fallback.
  function surfaceParams(choice) {
    let hl = null;
    if (!isDefault(choice.interfaceLanguage)) hl = choice.interfaceLanguage;
    else if (!isDefault(choice.resultsLanguage)) hl = choice.resultsLanguage;
    return { hl, gl: isDefault(choice.region) ? null : choice.region };
  }

  function isGoogleHostname(hostname) {
    const host = String(hostname).toLowerCase();
    return GOOGLE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  }

  function subdomainOf(hostname) {
    const host = hostname.toLowerCase();
    const base = GOOGLE_DOMAINS.find((d) => host === d || host.endsWith(`.${d}`));
    return base ? host.slice(0, host.length - base.length).replace(/\.$/, "") : null;
  }

  // The choice that applies on a product: each of its own values, or the
  // main value where it has none.
  function choiceForProduct(settings, product) {
    const main = normalizeChoice(settings);
    const own = product && settings.productSettings?.[product];
    if (!own) return main;
    const merged = {};
    for (const field of FIELDS) merged[field] = isDefault(own[field]) ? main[field] : own[field];
    return merged;
  }

  function pathIs(pathname, base) {
    return pathname === base || pathname.startsWith(`${base}/`);
  }

  // Returns the product for a URL, or null if LocalView does not handle it.
  function productForUrl(urlString) {
    let url;
    try {
      url = new URL(urlString);
    } catch (_e) {
      return null;
    }
    if (!/^https?:$/.test(url.protocol)) return null;
    const sub = subdomainOf(url.hostname);
    if (sub === null) return null;
    const path = url.pathname;

    if (sub === "maps" || pathIs(path, "/maps")) return "maps";
    if (sub === "news") return "news";
    if (sub === "books") return "books";
    if (sub === "images" || path === "/imghp") return "images";
    if (sub === "shopping" || pathIs(path, "/shopping")) return "shopping";
    if (pathIs(path, "/travel/flights")) return "flights";
    if (pathIs(path, "/travel/hotels")) return "hotels";
    if ((sub === "" || sub === "www") && path === "/search" && url.searchParams.has("q")) {
      const tbm = (url.searchParams.get("tbm") || "").toLowerCase();
      const udm = url.searchParams.get("udm") || "";
      const vertical = Object.keys(TBM_BY_PRODUCT).find((p) => TBM_BY_PRODUCT[p] === tbm) ||
        Object.keys(UDM_BY_PRODUCT).find((p) => UDM_BY_PRODUCT[p] === udm);
      return vertical || "search";
    }
    return null;
  }

  // The product a Google page belongs to, counting the home page as Search
  // (for the popup, which offers settings for the page you are on).
  function pageProduct(urlString) {
    const product = productForUrl(urlString);
    if (product) return product;
    try {
      const url = new URL(urlString);
      const sub = subdomainOf(url.hostname);
      if ((sub === "" || sub === "www") && ["/", "/webhp", "/search"].includes(url.pathname)) return "search";
    } catch (_e) {
      // not a URL
    }
    return null;
  }

  // Results pages (/search) take hl, lr and gl. Other pages (Maps, the News
  // and Books sites, image and shopping home pages, travel) take hl and gl.
  function paramsForPath(pathname, choice) {
    return pathname === "/search" ? searchParams(choice) : surfaceParams(choice);
  }

  // Returns the URL with LocalView's parameters applied, or null if no change
  // is needed. The DNR rules do the same; this is the fallback for pages that
  // DNR did not see (for example a tab restored before the rules were ready).
  function normalizeUrl(urlString, settings) {
    const product = productForUrl(urlString);
    if (!product || !settings.products[product]) return null;
    const choice = choiceForProduct(settings, product);
    if (isDefaultChoice(choice)) return null;
    const url = new URL(urlString);
    // News only accepts real editions and redirects anything else to its own
    // form (with ceid), so only its plain addresses are set; see productRegex.
    if (product === "news" && url.pathname !== "/search" && url.search) return null;
    const params = paramsForPath(url.pathname, choice);
    let changed = false;
    for (const [name, value] of Object.entries(params)) {
      if (value !== null && url.searchParams.get(name) !== value) {
        url.searchParams.set(name, value);
        changed = true;
      }
    }
    return changed ? url.toString() : null;
  }

  // URL regexes per product, for DNR regexFilter (RE2 syntax). The host is
  // limited to Google domains by the rule's requestDomains condition, which
  // keeps each regex small enough for Chrome's regex memory limit.
  function productRegex(product) {
    const any = "https?://[^/]+";
    const web = "https?://(?:www\\.)?google\\.[^/]+";
    const sub = (name) => `https?://${name}\\.google\\.[^/]+/`;
    switch (product) {
      case "search":
        return `^${web}/search\\?(?:.*&)?q=`;
      case "maps":
        return `^(?:${sub("maps")}|${any}/maps(?:[/?#]|$))`;
      case "news":
        // Only addresses without a query: News then picks the matching
        // edition itself. Its edition URLs are left alone, or it would loop.
        return `^https?://news\\.google\\.[^/]+/[^?#]*$`;
      case "books":
        return `^${sub("books")}`;
      case "images":
        return `^(?:${sub("images")}|${web}/imghp(?:[?#]|$))`;
      case "shopping":
        return `^(?:${sub("shopping")}|${web}/shopping(?:[/?#]|$))`;
      case "flights":
        return `^${web}/travel/flights(?:[/?#]|$)`;
      case "hotels":
        return `^${web}/travel/hotels(?:[/?#]|$)`;
      default:
        return null;
    }
  }

  function verticalRegex(product) {
    const udm = UDM_BY_PRODUCT[product];
    const param = udm ? `(?:tbm=${TBM_BY_PRODUCT[product]}|udm=${udm})` : `tbm=${TBM_BY_PRODUCT[product]}`;
    return `^https?://(?:www\\.)?google\\.[^/]+/search\\?(?:.*&)?${param}(?:&|#|$)`;
  }

  function redirectAction(params) {
    const add = [];
    // Only values the user chose are set. A value at "Google default" is left
    // alone, so filters picked on Google itself (Tools › Any language) stay.
    for (const [key, value] of Object.entries(params)) {
      if (value !== null) add.push({ key, value });
    }
    return { type: "redirect", redirect: { transform: { queryTransform: { addOrReplaceParams: add } } } };
  }

  // Builds the dynamic declarativeNetRequest rules for the settings.
  // Chrome skips a redirect whose result equals the request URL, so a page
  // that already has the right parameters is not redirected again.
  // Each product redirects with its own choice: its own settings, else the
  // main settings. Products at "Google default" get no rule.
  function buildRules(settings) {
    const condition = (regexFilter) => ({
      regexFilter,
      isUrlFilterCaseSensitive: false,
      requestDomains: [...GOOGLE_DOMAINS],
      resourceTypes: ["main_frame"]
    });
    const active = (product) =>
      settings.products[product] && !isDefaultChoice(choiceForProduct(settings, product));

    const rules = [];
    let id = 1;
    for (const product of PRODUCTS) {
      const regex = productRegex(product);
      if (!regex || !active(product)) continue;
      rules.push({
        id: id++,
        priority: 1,
        action: redirectAction(product === "search"
          ? searchParams(choiceForProduct(settings, product))
          : surfaceParams(choiceForProduct(settings, product))),
        condition: condition(regex)
      });
    }
    // With nothing to change we leave Google alone. Removing hl/gl from every
    // URL would override choices made on Google itself.
    // (Videos has no page of its own, only its /search rule below.)
    if (!PRODUCTS.some(active)) return rules;

    // /search?tbm=... belongs to a vertical, not to Search. Its own rule has a
    // higher priority: its choice, or "allow" when it is off or at default.
    for (const product of Object.keys(TBM_BY_PRODUCT)) {
      rules.push({
        id: id++,
        priority: 2,
        action: active(product)
          ? redirectAction(searchParams(choiceForProduct(settings, product)))
          : { type: "allow" },
        condition: condition(verticalRegex(product))
      });
    }
    return rules;
  }

  // Short code for the toolbar badge, for example "JA".
  // Only the language part fits: "pt-BR" shows as "PT".
  function badgeText(choice) {
    const short = (code) => code.split("-")[0].toUpperCase();
    if (!isDefault(choice.interfaceLanguage)) return short(choice.interfaceLanguage);
    if (!isDefault(choice.resultsLanguage)) return short(choice.resultsLanguage);
    if (!isDefault(choice.region)) return choice.region.toUpperCase();
    return "";
  }

  function sameChoice(a, b) {
    return a.interfaceLanguage === b.interfaceLanguage &&
      a.resultsLanguage === b.resultsLanguage &&
      a.region === b.region;
  }

  // Names come from the browser (Intl.DisplayNames) in the interface language,
  // with the language's own name after it: "Japanese (日本語)".
  function nameOf(field, code, uiLanguage) {
    try {
      if (field === "region") {
        return new Intl.DisplayNames([uiLanguage], { type: "region" }).of(code.toUpperCase());
      }
      const nameCode = NAME_CODE[code] || code;
      const local = new Intl.DisplayNames([uiLanguage], { type: "language" }).of(nameCode);
      const native = new Intl.DisplayNames([nameCode], { type: "language" }).of(nameCode);
      return local.toLowerCase() === native.toLowerCase() ? local : `${local} (${native})`;
    } catch (_e) {
      return code;
    }
  }

  function codesFor(field) {
    if (field === "region") return REGIONS;
    return field === "resultsLanguage" ? RESULT_LANGUAGES : DISPLAY_LANGUAGES;
  }

  // Codes from the browser's own languages (navigator.languages) that are in
  // the list for this field, so they can be shown first.
  function suggestedCodes(field, browserLanguages) {
    const codes = codesFor(field);
    const found = [];
    for (const tag of browserLanguages || []) {
      const [lang, region] = tag.split("-");
      const candidates = field === "region"
        ? [region]
        : [tag, lang === "zh" ? (region === "TW" || region === "HK" ? "zh-TW" : "zh-CN") : lang,
            lang === "pt" ? "pt-BR" : null, lang === "he" ? "iw" : null];
      for (const candidate of candidates) {
        if (!candidate) continue;
        const code = pick(candidate, codes);
        if (code !== DEFAULT && !found.includes(code)) {
          found.push(code);
          break;
        }
      }
    }
    return found;
  }

  // Dropdown entries: "Google default", then the browser's languages, then
  // every option sorted by name. Groups are { group, options }.
  function choiceOptions(field, getMessage, uiLanguage = "en", browserLanguages = []) {
    const entry = (code) => ({ value: code, label: nameOf(field, code, uiLanguage) });
    const collator = new Intl.Collator(uiLanguage);
    const all = codesFor(field).map(entry).sort((a, b) => collator.compare(a.label, b.label));
    const suggested = suggestedCodes(field, browserLanguages).map(entry);
    const entries = [{ value: DEFAULT, label: getMessage("option_default") || "Google default" }];
    if (!suggested.length) return [...entries, ...all];
    return [
      ...entries,
      { group: getMessage("group_suggested") || "Suggested", options: suggested },
      { group: getMessage("group_all") || "All", options: all }
    ];
  }

  function labelFor(field, code, getMessage, uiLanguage = "en") {
    return isDefault(code) ? getMessage("option_default") || "Google default" : nameOf(field, code, uiLanguage);
  }

  function choiceSummary(choice, getMessage, uiLanguage = "en") {
    return ["interfaceLanguage", "resultsLanguage", "region"]
      .map((field) => labelFor(field, choice[field], getMessage, uiLanguage))
      .join(" · ");
  }

  // Fills elements that have data-i18n with the matching message.
  function localizePage(doc, getMessage) {
    // Language and direction of the interface (Arabic reads right to left).
    doc.documentElement.lang = getMessage("@@ui_locale").replace("_", "-") || "en";
    doc.documentElement.dir = getMessage("@@bidi_dir") || "ltr";
    for (const el of doc.querySelectorAll("[data-i18n]")) {
      const text = getMessage(el.dataset.i18n);
      if (text) el.textContent = text;
    }
    for (const el of doc.querySelectorAll("[data-i18n-label]")) {
      const text = getMessage(el.dataset.i18nLabel);
      if (text) el.setAttribute("aria-label", text);
    }
    for (const el of doc.querySelectorAll("[data-i18n-placeholder]")) {
      const text = getMessage(el.dataset.i18nPlaceholder);
      if (text) el.placeholder = text;
    }
  }

  // Plays a one-off animation again from the start, and removes its class when
  // done, so it never replays by itself when the element is shown again.
  function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    el.addEventListener("animationend", () => el.classList.remove(cls), { once: true });
  }

  // A message with its $1/$2 values in bold, as DOM nodes (never as HTML).
  function boldMessage(doc, getMessage, key, values) {
    const marks = values.map((_v, i) => String.fromCharCode(0xe000 + i));
    const text = getMessage(key, marks) || values.join(" ");
    const fragment = doc.createDocumentFragment();
    for (const part of text.split(/([\ue000-\ue008])/)) {
      const index = marks.indexOf(part);
      if (index === -1) {
        if (part) fragment.append(part);
      } else {
        const strong = doc.createElement("strong");
        strong.textContent = values[index];
        fragment.append(strong);
      }
    }
    return fragment;
  }

  // "Google Maps" -> "Maps", for small tags.
  function productLabel(product, getMessage) {
    const name = getMessage(`product_${product}`) || product;
    return name.replace(/^Google\s*/, "") || name;
  }

  function fillSelect(select, entries) {
    select.textContent = "";
    for (const entry of entries) {
      if (entry.group) {
        const group = document.createElement("optgroup");
        group.label = entry.group;
        for (const option of entry.options) group.append(new Option(option.label, option.value));
        select.append(group);
      } else {
        select.add(new Option(entry.label, entry.value));
      }
    }
  }

  root.LocalViewCore = Object.freeze({
    GOOGLE_DOMAINS,
    DISPLAY_LANGUAGES,
    RESULT_LANGUAGES,
    REGIONS,
    PRODUCTS,
    FIELDS,
    DEFAULT_SETTINGS,
    normalizeChoice,
    normalizeSettings,
    isDefaultChoice,
    searchParams,
    isGoogleHostname,
    choiceForProduct,
    productForUrl,
    pageProduct,
    normalizeUrl,
    buildRules,
    badgeText,
    sameChoice,
    choiceOptions,
    choiceSummary,
    labelFor,
    localizePage,
    fillSelect,
    boldMessage,
    restart,
    productLabel
  });
})(globalThis);
