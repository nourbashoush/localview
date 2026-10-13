(function () {
  "use strict";

  const core = globalThis.LocalViewCore;
  const msg = (key, subs) => chrome.i18n.getMessage(key, subs);
  const $ = (id) => document.getElementById(id);

  let settings = core.normalizeSettings({});

  // Messages show briefly as a small pill in the corner of the section they
  // belong to ("products" or "presets"), over the card, so nothing moves.
  const toastTimers = new Map();
  // (Made when the page opens: screen readers only announce a live region
  // that was already there before its text changed.)
  function toastFor(where) {
    const section = $(where).closest("section");
    let toast = section.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("p");
      toast.className = "toast";
      toast.setAttribute("role", "status");
      section.append(toast);
    }
    return toast;
  }

  function setStatus(text, where, isError = false) {
    const toast = toastFor(where);
    toast.textContent = text;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");
    restart(toast, "bump");
    clearTimeout(toastTimers.get(toast));
    toastTimers.set(toast, setTimeout(() => toast.classList.remove("show"), isError ? 3200 : 2200));
  }

  const CHECK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5"/></svg>';

  async function load() {
    settings = core.normalizeSettings(await chrome.storage.sync.get(core.DEFAULT_SETTINGS));
  }

  function renderProducts() {
    const box = $("products");
    box.textContent = "";
    for (const product of core.PRODUCTS) {
      const label = document.createElement("label");
      label.className = "check-row";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = settings.products[product];
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = msg(`product_${product}`) || product;
      const check = document.createElement("span");
      check.className = "check";
      check.innerHTML = CHECK_SVG;
      input.addEventListener("change", async () => {
        settings.products[product] = input.checked;
        if (input.checked) restart(check, "pop");
        try {
          await chrome.storage.sync.set({ products: settings.products });
          setStatus(msg("status_saved") || "Saved.", "products");
        } catch (_error) {
          setStatus(msg("status_failed"), "products", true);
        }
      });
      label.append(input, name, check);
      box.append(label);
    }
  }

  function renderPresets() {
    const list = $("presets");
    list.textContent = "";
    showEmpty(settings.presets.length === 0, false);
    for (const preset of settings.presets) {
      const item = document.createElement("li");
      const collapse = document.createElement("div");
      collapse.className = "collapse";
      const row = document.createElement("div");
      row.className = "preset-row";
      const text = document.createElement("div");
      text.className = "text";
      const name = document.createElement("span");
      name.className = "title";
      name.textContent = preset.name;
      const summary = document.createElement("span");
      summary.className = "sub";
      summary.textContent = core.choiceSummary(preset, msg, chrome.i18n.getUILanguage());
      text.append(name, summary);

      const rename = document.createElement("button");
      rename.className = "pill small";
      rename.textContent = msg("button_rename") || "Rename";
      rename.addEventListener("click", () => startRename(preset, name, rename));

      const remove = document.createElement("button");
      remove.className = "pill small danger";
      remove.textContent = msg("button_delete") || "Delete";
      remove.addEventListener("click", () => {
        // Save at once (so quick deletes never undo each other), then let the
        // row collapse and remove it when the collapse has finished. When it is
        // the last row, the empty note opens while the row closes, so the card
        // changes height in one smooth movement.
        remove.disabled = true;
        const presets = settings.presets.filter((p) => p !== preset);
        savePresets(presets, msg("status_preset_deleted"), false);
        item.classList.add("gone");
        if (presets.length === 0) showEmpty(true, true);
        // (A timer as well, in case the transition is skipped, e.g. reduced motion.)
        item.addEventListener("transitionend", () => item.remove(), { once: true });
        setTimeout(() => item.remove(), 400);
      });

      row.append(text, rename, remove);
      collapse.append(row);
      item.append(collapse);
      list.append(item);
    }
  }

  // Products with their own settings: name, summary, Remove. The section is
  // hidden while there are none.
  function renderOwn() {
    const list = $("own-list");
    list.textContent = "";
    const own = Object.keys(settings.productSettings);
    $("own-section").hidden = own.length === 0;
    for (const product of own) {
      const name = core.productLabel(product, msg);
      const item = document.createElement("li");
      const collapse = document.createElement("div");
      collapse.className = "collapse";
      const row = document.createElement("div");
      row.className = "preset-row";
      const text = document.createElement("div");
      text.className = "text";
      const title = document.createElement("span");
      title.className = "title";
      title.textContent = name;
      const summary = document.createElement("span");
      summary.className = "sub";
      summary.textContent = core.choiceSummary(core.choiceForProduct(settings, product), msg, chrome.i18n.getUILanguage());
      text.append(title, summary);

      const remove = document.createElement("button");
      remove.className = "pill small danger";
      remove.textContent = msg("button_remove") || "Remove";
      remove.addEventListener("click", async () => {
        // Save at once; the row collapses, and the section folds away with it
        // when it was the last one.
        remove.disabled = true;
        const productSettings = { ...settings.productSettings };
        delete productSettings[product];
        settings.productSettings = productSettings;
        item.classList.add("gone");
        if (!Object.keys(productSettings).length) $("own-section").classList.add("closing");
        setTimeout(() => renderOwn(), 320);
        try {
          await chrome.storage.sync.set({ productSettings });
          // (The last one: the section is folding away, so say it in Products.)
          const where = Object.keys(productSettings).length ? "own-list" : "products";
          setStatus(msg("status_same_again", [name]), where);
        } catch (_error) {
          setStatus(msg("status_failed"), "own-list", true);
        }
      });

      row.append(text, remove);
      collapse.append(row);
      item.append(collapse);
      list.append(item);
    }
    $("own-section").classList.remove("closing");
  }

  // The name turns into a text box. Enter or leaving the box saves; Escape cancels.
  function startRename(preset, nameEl, button) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "pill-input rename-input";
    input.setAttribute("aria-label", msg("label_preset_name") || "Choice name");
    input.maxLength = 40;
    input.value = preset.name;
    nameEl.replaceWith(input);
    button.disabled = true;
    input.focus();
    input.select();

    let done = false;
    const finish = (commit, fromBlur = false) => {
      if (done) return;
      const newName = input.value.trim();
      if (commit && newName && newName !== preset.name) {
        const taken = settings.presets.some((p) => p !== preset && p.name.toLowerCase() === newName.toLowerCase());
        if (taken) {
          setStatus(msg("validation_preset_name_duplicate", [newName]), "presets", true);
          // Leaving the box gives up the rename; Enter keeps you there to fix it.
          if (fromBlur) {
            done = true;
            renderPresets();
            return;
          }
          restart(input, "shake");
          input.focus();
          return;
        }
        done = true;
        const presets = settings.presets.map((p) => (p === preset ? { ...p, name: newName } : p));
        savePresets(presets, msg("status_saved"));
        return;
      }
      done = true;
      renderPresets();
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") finish(true);
      if (event.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true, true));
  }

  // The empty note opens and closes like a row (grid 0fr <-> 1fr).
  function showEmpty(show, animated) {
    const wrap = $("presets-empty");
    if (!animated) wrap.classList.add("still");
    wrap.classList.toggle("open", show);
    if (!animated) {
      void wrap.offsetWidth;
      wrap.classList.remove("still");
    }
  }

  const restart = core.restart;

  // settings is updated before the write, so the storage change event sees
  // nothing new and does not redraw the list in the middle of an animation.
  async function savePresets(presets, doneText, redraw = true) {
    settings.presets = presets;
    if (redraw) renderPresets();
    try {
      await chrome.storage.sync.set({ presets });
      setStatus(doneText, "presets");
    } catch (_error) {
      setStatus(msg("status_failed"), "presets", true);
    }
  }

  // Keep the page current when the popup changes the settings.
  // Redraw only for changes made elsewhere, so this page's own animations run.
  chrome.storage.onChanged.addListener(async (_changes, area) => {
    if (area !== "sync") return;
    // Same data: keep the current objects, which open rows still refer to.
    const next = core.normalizeSettings(await chrome.storage.sync.get(core.DEFAULT_SETTINGS));
    if (JSON.stringify(next) === JSON.stringify(settings)) return;
    settings = next;
    renderProducts();
    renderOwn();
    renderPresets();
  });

  async function init() {
    core.localizePage(document, msg);
    document.title = msg("ext_name") || document.title;
    $("version").textContent = msg("options_version", [chrome.runtime.getManifest().version]);
    toastFor("products");
    toastFor("own-list");
    toastFor("presets");
    await load();
    renderProducts();
    renderOwn();
    renderPresets();
    document.body.classList.remove("loading");
  }

  init();
})();
