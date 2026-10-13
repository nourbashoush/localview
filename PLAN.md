# LocalView for Google: rebuild plan

Status: approved. Build version 1.

## Goal

Rebuild "Locale Switch for Google" (v0.2.0) as **LocalView for Google**.
Make it minimal, clean, and Google-only.

- Source (read only): `/Users/nourashoush/Developer/language-switcher`
- Target: `/Users/nourashoush/Developer/localview` (this folder)

## Rules

1. Do not change files in the source folder.
2. Do not send data to a server. No analytics, no accounts, no remote code.
3. Do not change the user's IP address or location. Change only language and region settings.
4. Request Google domains only. Do not request access to all websites.
5. Do not use "Google" as the first word of the name.
6. Explain each new feature to the user before you build it. Features in "Version 1" below are already approved.

## Features

| # | Feature | Decision |
|---|---|---|
| 1 | Display language (`hl`) | Keep |
| 2 | Results language (`lr=lang_xx`) | Keep |
| 3 | Results region (`gl`) | Keep |
| 4 | URL rewrite | Change: use `declarativeNetRequest` redirects. No flash, no reload loop. |
| 5 | Hidden fields in Google search forms | Keep |
| 6 | 9 products: Search, Maps, Images, News, Shopping, Videos, Books, Flights, Hotels | Keep |
| 7 | Per-product on/off toggles | Keep, on the options page only |
| 8 | "Auto" / "Any" values | Keep, rename to "Google default" |
| 9 | Saved choices (presets) | Change: a simple list. No edit or overflow menus. |
| 10 | In-page panel | Change: replace with a standard toolbar popup |
| 11 | Panel on non-Google sites | Remove. Drop `activeTab` and `scripting`. |
| 12 | Theme picker | Change: follow the system light/dark theme only |
| 13 | Bundled Poppins fonts and Lucide icons | Remove. Use system fonts. |
| 14 | Interface text in 12 languages | Keep. Update the name in every catalog. |
| 15 | `chrome.storage.sync` | Keep |
| 16 | ~2,600 Google host patterns | Change: main Google country domains only for v1 |
| 17 | Node tests, packaging script | Keep the engine tests only |

## Interface

**Popup** (about 320 px wide):
- Title: "LocalView"
- Dropdowns: "Display language", "Results language", "Region". The first item in each is "Google default".
- "Saved" dropdown. Show it only when presets exist.
- Buttons: "Apply" (primary) and "Reset"
- Small "Settings" link
- Status line, for example "Applied. Reloading…". Reload the tab only if it is a Google page.

**Options page** (one column):
- "Products": 9 checkboxes
- "Saved choices": rows with name, summary and Delete. Under the list: "Save current as…"
- "About": privacy statement and version

## File structure

```
localview/
  manifest.json
  background.js        DNR rules, messages
  content.js           form fields, fallback normalization
  core.js              shared URL logic, language and region lists
  popup.html  popup.js
  options.html options.js
  style.css
  _locales/<12 languages>/messages.json
  icons/               16, 32, 48, 128
  tests/core.test.mjs
  scripts/build-hosts.mjs
  README.md  PRIVACY.md
```

## Version 1

1. `declarativeNetRequest` redirects (permissions: `declarativeNetRequest`, Google host permissions)
2. Toolbar popup instead of the injected panel
3. No `activeTab` or `scripting` permissions
4. Badge on the toolbar icon with the active language code, for example "JA"
5. Saved choices (presets)

## Later (explain to the user before building)

| Feature | Permissions | Store risk |
|---|---|---|
| Keyboard shortcut to cycle presets | `commands` | Low |
| Context menu "Search this in [language]" | `contextMenus` | Low |
| Settings for one tab only | session storage, DNR session rules | Low |
| Export and import settings as a JSON file | none | Low |
| Optional products, for example YouTube | `optional_host_permissions` | Medium |

## Decisions

1. Create files in this folder: **yes**
2. Run `git init` here: **yes**. Remote: a new GitHub repo `nourbashoush/localview`. Use the SSH alias: `git@github:nourbashoush/localview.git`. The user creates the repo on GitHub first.
3. Copy the 12 locale catalogs and the icons from the source: **yes**. Change the name in the strings.
4. Popup instead of the in-page panel: **popup**
5. Host patterns: **main Google country domains only** for v1
6. Saved choices: **in v1**
7. Settings storage: **`chrome.storage.sync`**
8. Minimum Chrome version: **116**
9. Store listing, privacy policy, support URL: **move to the new `localview` repo**
10. Name: no store clashes found for "LocalView". Check the live Chrome Web Store before submission.
11. New icons: **ask the user**. Use the old icons until then.
