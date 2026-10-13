# Chrome Web Store submission notes

## Privacy practices tab

**Single purpose:** Lets the user choose the display language, results
language and region that Google services use, by setting Google's `hl`, `lr`
and `gl` URL parameters.

**Permission justifications**

- `storage`: Saves the user's language, region, product and saved-choice
  settings with chrome.storage.sync.
- `declarativeNetRequestWithHostAccess`: Adds redirect rules that put the
  user's hl/lr/gl parameters on Google URLs before the page loads, so there is
  no reload or flash.
- Host permissions: Needed for the redirect rules and for the content script
  that corrects Google pages loaded without them. Limited to the Google hosts
  of Search, Maps, Images, News, Shopping, Videos, Books, Flights and Hotels.

**Remote code:** No, I am not using remote code.

**Data usage:** Tick no data types. Tick all three certifications.

## Listing

Assets are in `store-assets/`: `promo-tile-440x280.png`, and per language
(`en`, `ar`, `de`, …) four 1280×800 screenshots plus `description.txt` to paste
into that language's listing. Regenerate after any text or UI change:
`node scripts/store-assets.mjs` (or only some: `node scripts/store-assets.mjs de ja`).
Headlines and descriptions live in `store-assets/text.json`.


- Category: Productivity. Languages: 12, including English (one listing per language).
- End the description with: "Google is a trademark of Google LLC. LocalView is
  not affiliated with or endorsed by Google."
- Privacy policy URL, support URL, contact email.
- 1–5 screenshots, 1280×800 or 640×400: popup, options, results before/after.
- Small promo tile 440×280: icon and the name "LocalView".
- Icon 128×128: about 96×96 artwork with 16 px transparent padding.
- Before submitting, check the live store and USPTO for "LocalView".
