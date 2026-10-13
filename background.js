importScripts("core.js");

const { normalizeSettings, buildRules, badgeText, productForUrl, choiceForProduct, DEFAULT_SETTINGS } = self.LocalViewCore;

async function loadSettings() {
  return normalizeSettings(await chrome.storage.sync.get(DEFAULT_SETTINGS));
}

async function rebuild() {
  const settings = await loadSettings();
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: buildRules(settings)
  });
  await chrome.action.setBadgeBackgroundColor({ color: "#1a73e8" });
  await chrome.action.setBadgeText({ text: badgeText(settings) });
  // Tabs on products with their own settings have their own badge; refresh them all.
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => updateTabBadge(tab.id, tab.url, settings)));
}

// On a product with its own settings (for example Maps), the badge shows
// that product's language. tab.url is only visible for Google pages (host
// permissions). Clearing a tab's own badge text shows the main badge again.
async function updateTabBadge(tabId, url, settings) {
  if (!url) return;
  const product = productForUrl(url);
  const own = product && settings.products[product] && settings.productSettings[product];
  const text = own ? badgeText(choiceForProduct(settings, product)) : null;
  await chrome.action.setBadgeText({ tabId, text }).catch(() => {});
}

// On a new address, and again when the page has loaded (Chrome may reset a
// tab's badge while it navigates).
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete") return;
  loadSettings()
    .then((settings) => updateTabBadge(tabId, tab.url, settings))
    .catch(() => {});
});

// One rebuild at a time: the popup's message and the storage change can both
// ask at once, and two overlapping rebuilds would add the same rule IDs twice.
let queue = Promise.resolve();
function applySettings() {
  queue = queue.then(rebuild, rebuild);
  return queue;
}

function run() {
  applySettings().catch((error) => console.error("LocalView: could not apply settings", error));
}

chrome.runtime.onInstalled.addListener(run);
chrome.runtime.onStartup.addListener(run);
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "sync") run();
});

// The popup waits for the rules before it reloads the tab.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "localview:apply") return false;
  applySettings().then(
    () => sendResponse({ ok: true }),
    (error) => sendResponse({ ok: false, error: String(error) })
  );
  return true;
});
