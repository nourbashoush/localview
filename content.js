// Runs on Google pages. The redirect rules set the language and region as
// pages load; this corrects a page Chrome loaded without them (for example
// a tab restored at startup before the rules were ready).
(function () {
  "use strict";

  const { normalizeSettings, normalizeUrl, DEFAULT_SETTINGS } = globalThis.LocalViewCore;

  // If Google drops a parameter again right after a redirect, do not try
  // twice (but a later visit to the same address is corrected again).
  function checkUrl(settings) {
    const target = normalizeUrl(location.href, settings);
    if (!target || target === location.href) return;
    const key = "localview:lastRedirect";
    const last = JSON.parse(sessionStorage.getItem(key) || "{}");
    if (last.target === target && Date.now() - last.time < 10000) return;
    sessionStorage.setItem(key, JSON.stringify({ target, time: Date.now() }));
    location.replace(target);
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS)
    .then((stored) => checkUrl(normalizeSettings(stored)))
    .catch(() => {});
})();
