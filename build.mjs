import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(projectRoot, "dist");
const publicFiles = ["index.html", "styles.css", "app.js", "_headers"];

await mkdir(outputDir, { recursive: true });
for (const file of publicFiles) {
  await copyFile(resolve(projectRoot, file), resolve(outputDir, file));
}
await writeFile(resolve(outputDir, ".nojekyll"), "", "utf8");
console.log(`Static production files copied to ${outputDir}`);
