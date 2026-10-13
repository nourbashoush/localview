// Writes the Google host patterns from core.js into manifest.json.
// Usage: node scripts/build-hosts.mjs
import { readFile, writeFile } from "node:fs/promises";

await import("../core.js");
const { GOOGLE_DOMAINS } = globalThis.LocalViewCore;

const manifestUrl = new URL("../manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
// Only the hosts the nine products use, not Gmail, Docs or Accounts.
const SUBDOMAINS = ["", "www.", "maps.", "news.", "books.", "images.", "shopping."];
const patterns = GOOGLE_DOMAINS.flatMap((domain) => SUBDOMAINS.map((sub) => `*://${sub}${domain}/*`));

manifest.host_permissions = patterns;
manifest.content_scripts[0].matches = patterns;

await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${patterns.length} host patterns to manifest.json`);
