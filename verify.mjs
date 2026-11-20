import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(projectRoot, "dist");
const html = await readFile(resolve(outputDir, "index.html"), "utf8");
const css = await readFile(resolve(outputDir, "styles.css"), "utf8");
const js = await readFile(resolve(outputDir, "app.js"), "utf8");
const files = new Set(await readdir(outputDir));
const scenes = html.match(/<section\s+class="scene\b/g) ?? [];
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);

assert.equal(scenes.length, 7, "The story must contain exactly seven scenes in one document.");
assert.equal(new Set(ids).size, ids.length, "HTML id attributes must be unique.");
assert.ok(html.includes('type="module" src="./app.js"'), "The module script must be wired into index.html.");
assert.ok(files.has("index.html") && files.has("styles.css") && files.has("app.js"), "The production directory must contain the site assets.");
assert.ok(css.includes("@media (max-width: 680px)"), "Mobile layout styles must be present.");
assert.ok(css.includes("prefers-reduced-motion"), "Reduced-motion support must be present.");
assert.ok(js.includes("localStorage.setItem(CONFIG.draftStorageKey"), "The reply draft must be stored locally.");
assert.ok(js.includes("navigator.clipboard?.writeText"), "The reply copy action must be implemented.");
assert.ok(!js.match(/fetch\s*\(/), "No message delivery endpoint should be implied without a backend.");

for (const reference of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g)) {
  assert.ok(files.has(reference[1]), `Missing production asset: ${reference[1]}`);
}

console.log(`Verified ${scenes.length} scenes, ${ids.length} unique ids, mobile and reduced-motion styles, local draft, copy-only reply, and ${files.size} production files.`);
