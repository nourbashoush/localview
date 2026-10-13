(function () {
  "use strict";

  const core = globalThis.LocalViewCore;
  const msg = (key, subs) => chrome.i18n.getMessage(key, subs);
  const FIELDS = core.FIELDS;
  const $ = (id) => document.getElementById(id);
  const UI = chrome.i18n.getUILanguage();

  let settings = core.normalizeSettings({});
  // The product of the Google page the popup was opened on (null elsewhere),
  // and what the dropdowns edit: "all" (Everywhere) or that product.
  let pageProduct = null;
  let scope = "all";

  const productName = (product) => core.productLabel(product, msg);

  function readChoice() {
    return core.normalizeChoice(Object.fromEntries(FIELDS.map((f) => [f, $(f).value])));
  }

  // The values the dropdowns show in the current scope. A product's own
  // settings keep "default" where they follow Everywhere.
  function scopeChoice() {
    if (scope === "all") return core.normalizeChoice(settings);
    return core.normalizeChoice(settings.productSettings[scope]);
  }

  function showChoice(choice) {
    for (const f of FIELDS) $(f).value = choice[f];
    refresh();
  }

  const restart = core.restart;

  // Messages fade out after a moment; "Reloading…" stays until the popup closes.
  let statusTimer;
  function setStatus(text, stay = false) {
    $("status").textContent = text;
    restart($("status"), "show");
    $("status").classList.remove("gone");
    clearTimeout(statusTimer);
    if (!stay) statusTimer = setTimeout(() => $("status").classList.add("gone"), 2500);
  }

  // ---------- Scope: Everywhere | Just Maps ----------

  function canScope() {
    return pageProduct && pageProduct !== "search" && settings.products[pageProduct];
  }

  // The first entry of each dropdown: "Google default" for Everywhere; for a
  // product, "Same as everywhere · English" (what it follows).
  function updateDefaultLabels() {
    const main = core.normalizeChoice(settings);
    for (const f of FIELDS) {
      const first = $(f).options[0];
      first.text = scope === "all"
        ? msg("option_default") || "Google default"
        : `${msg("option_same") || "Same as everywhere"} · ${core.labelFor(f, main[f], msg, UI)}`;
    }
  }

  // Moves the switch's white pill under the chosen side.
  function placePill(animated) {
    const box = $("scope");
    const on = box.querySelector("button.on");
    if (!on || box.hidden) return;
    box.classList.toggle("still", !animated);
    box.style.setProperty("--pill-x", `${on.offsetLeft}px`);
    box.style.setProperty("--pill-y", `${on.offsetTop}px`);
    box.style.setProperty("--pill-w", `${on.offsetWidth}px`);
    box.style.setProperty("--pill-h", `${on.offsetHeight}px`);
    box.classList.add("placed");
  }

  function setScope(next, animated = true) {
    scope = next;
    for (const button of $("scope").querySelectorAll("button")) {
      const on = (button.dataset.scope === "all") === (scope === "all");
      button.classList.toggle("on", on);
      button.setAttribute("aria-checked", String(on));
      button.tabIndex = on ? 0 : -1;
    }
    placePill(animated);
    $("save-form").hidden = true;
    updateDefaultLabels();
    for (const f of FIELDS) $(f).value = scopeChoice()[f];
    $("reset").textContent = scope === "all"
      ? msg("button_reset") || "Reset"
      : msg("button_use_same") || "Use same as everywhere";
    if (animated) restart($("fields"), "swap");
    refresh(false);
  }

  // Under the switch: on Everywhere, a reminder that this product has its own
  // settings (with Remove). Without a switch: which products have their own.
  let noteKey = null;
  function renderScopeNote() {
    const note = $("scope-note");
    const own = Object.keys(settings.productSettings);
    let key = "";
    if (canScope() && scope === "all" && settings.productSettings[pageProduct]) {
      key = `own:${core.choiceSummary(core.choiceForProduct(settings, pageProduct), msg, UI)}`;
    }
    else if (!canScope() && own.length) key = `list:${own.join(",")}`;
    if (key === noteKey) return; // unchanged: keep it still
    noteKey = key;
    note.textContent = "";
    note.hidden = !key;
    if (!key) return;

    if (key.startsWith("own:")) {
      const summary = core.choiceSummary(core.choiceForProduct(settings, pageProduct), msg, UI);
      const text = document.createElement("span");
      text.append(core.boldMessage(document, msg, "own_line", [productName(pageProduct), summary]));
      const remove = document.createElement("button");
      remove.className = "text-link";
      remove.textContent = msg("button_remove") || "Remove";
      remove.addEventListener("click", () => removeOwn());
      note.append(text, remove);
    } else {
      const link = document.createElement("button");
      link.className = "text-link";
      link.textContent = msg("own_note", [own.map(productName).join(", ")]);
      link.addEventListener("click", openSettings);
      note.append(link);
    }
    restart(note, "show");
  }

  // ---------- Chips ----------

  // What a chip sets in the current scope. For a product, a saved "Google
  // default" becomes the main value, so the product gets exactly what the
  // chip says rather than "same as everywhere".
  function chipChoice(preset) {
    if (scope === "all") return core.normalizeChoice(preset);
    const main = core.normalizeChoice(settings);
    return Object.fromEntries(FIELDS.map((f) => [f, preset[f] === "default" ? main[f] : preset[f]]));
  }

  // One chip per saved choice. Tapping one applies it in the current scope.
  function renderChips(newIndex = -1) {
    const box = $("chips");
    box.textContent = "";
    box.hidden = settings.presets.length === 0;
    settings.presets.forEach((preset, index) => {
      const chip = document.createElement("button");
      chip.className = "chip";
      if (index === newIndex) chip.classList.add("new");
      chip.textContent = preset.name;
      chip.title = core.choiceSummary(preset, msg, UI);
      chip.addEventListener("click", () => {
        showChoice(chipChoice(preset));
        apply(readChoice());
      });
      box.append(chip);
    });
    refresh(false);
  }

  // Chip states, the Save button, and the note.
  // pop: false when the chips were just drawn, so they do not pop on arrival.
  function refresh(pop = true) {
    const choice = readChoice();
    // A chip lights up when the dropdowns match it, and fades out as soon as
    // they no longer do. A chip that just lit up gives a small pop.
    [...$("chips").children].forEach((chip, i) => {
      const on = core.sameChoice(chipChoice(settings.presets[i]), choice);
      if (on && !chip.classList.contains("on") && pop) restart(chip, "lit");
      chip.classList.toggle("on", on);
      chip.setAttribute("aria-pressed", String(on));
    });
    // Saving a new choice only on Everywhere: for a product, "default" means
    // "same as everywhere", which a saved choice does not have.
    const saved = settings.presets.some((p) => core.sameChoice(p, choice));
    $("save-open").hidden = scope !== "all" || saved || core.isDefaultChoice(choice) ||
      !$("save-form").hidden || settings.presets.length >= 30;
    renderScopeNote();
  }

  // ---------- Saving ----------

  async function activeGoogleTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // Only Google pages LocalView changes (not Gmail, Docs…). tab.url is only
    // visible for hosts in host_permissions, which are all Google.
    return tab?.url && core.pageProduct(tab.url) ? tab : null;
  }

  // Writes, updates the rules, and reloads the Google tab so it shows at once.
  async function store(values, doneText) {
    try {
      await chrome.storage.sync.set(values);
      settings = core.normalizeSettings({ ...settings, ...values });
      refresh();
      const result = await chrome.runtime.sendMessage({ type: "localview:apply" });
      if (!result?.ok) throw new Error(result?.error);
      const tab = await activeGoogleTab();
      if (tab) {
        setStatus(msg("status_reloading") || "Applied. Reloading…", true);
        await chrome.tabs.reload(tab.id);
      } else {
        setStatus(doneText);
      }
    } catch (_error) {
      setStatus(msg("status_failed") || "Couldn't save your settings.");
    }
  }

  // Apply in the current scope: Everywhere, or only this product.
  function apply(choice, doneKey = "status_applied") {
    if (scope === "all") return store(core.normalizeChoice(choice), msg(doneKey));
    if (core.isDefaultChoice(choice)) return removeOwn();
    const productSettings = { ...settings.productSettings, [scope]: core.normalizeChoice(choice) };
    return store({ productSettings }, msg("status_saved_for", [productName(scope)]));
  }

  // The product goes back to the same as everywhere.
  function removeOwn() {
    const product = pageProduct;
    if (!settings.productSettings[product]) return setScope("all"); // nothing to remove
    const productSettings = { ...settings.productSettings };
    delete productSettings[product];
    setScope("all");
    return store({ productSettings }, msg("status_same_again", [productName(product)]));
  }

  function openSaveForm(open) {
    $("save-form").hidden = !open;
    refresh();
    if (open) {
      $("preset-name").value = "";
      $("preset-name").focus();
    } else if (!$("save-open").hidden) {
      $("save-open").focus();
    } else {
      $("apply").focus();
    }
  }

  async function savePreset(event) {
    event.preventDefault();
    if (scope !== "all") return;
    const name = $("preset-name").value.trim();
    let error = "";
    // Saved choices share one sync item (8 KB), so they are capped at 30.
    if (settings.presets.length >= 30) error = msg("validation_preset_limit");
    else if (!name) error = msg("validation_preset_name");
    else if (settings.presets.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      error = msg("validation_preset_name_duplicate", [name]);
    }
    if (error) {
      restart($("save-form"), "shake");
      setStatus(error);
      return;
    }
    const presets = [...settings.presets, { name, ...readChoice() }];
    try {
      await chrome.storage.sync.set({ presets });
      settings.presets = presets;
      $("save-form").hidden = true;
      renderChips(presets.length - 1);
      $("apply").focus();
      setStatus(msg("status_preset_saved"));
    } catch (_error) {
      setStatus(msg("status_failed"));
    }
  }

  function openSettings(event) {
    event?.preventDefault();
    chrome.runtime.openOptionsPage();
    window.close();
  }

  async function init() {
    core.localizePage(document, msg);
    for (const f of FIELDS) {
      core.fillSelect($(f), core.choiceOptions(f, msg, UI, navigator.languages));
      $(f).addEventListener("change", () => refresh());
    }

    settings = core.normalizeSettings(await chrome.storage.sync.get(core.DEFAULT_SETTINGS));
    const tab = await activeGoogleTab();
    pageProduct = tab ? core.pageProduct(tab.url) : null;

    // On a product other than Search: the switch, opening on "Just Maps" when
    // Maps already has its own settings.
    if (canScope()) {
      $("scope-product").textContent = msg("scope_just", [productName(pageProduct)]);
      $("scope").hidden = false;
    }
    renderChips();
    setScope(canScope() && settings.productSettings[pageProduct] ? pageProduct : "all", false);
    document.body.classList.remove("loading");
    placePill(false); // measured again now that the popup is visible

    for (const button of $("scope").querySelectorAll("button")) {
      button.addEventListener("click", () => {
        const next = button.dataset.scope === "all" ? "all" : pageProduct;
        if (next !== scope) setScope(next);
      });
    }
    // Arrow keys move between the two sides, like any radio group.
    $("scope").addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      setScope(scope === "all" ? pageProduct : "all");
      $("scope").querySelector("button.on").focus();
    });
    $("apply").addEventListener("click", () => apply(readChoice()));
    $("reset").addEventListener("click", () => {
      if (scope !== "all") return removeOwn();
      showChoice(core.normalizeChoice({}));
      apply(readChoice(), "status_reset");
    });
    $("save-open").addEventListener("click", () => openSaveForm(true));
    $("save-cancel").addEventListener("click", () => openSaveForm(false));
    $("save-form").addEventListener("submit", savePreset);
    $("save-form").addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        openSaveForm(false);
      }
    });
    $("settings").addEventListener("click", openSettings);
  }

  init();
})();
