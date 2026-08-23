import { copyFile, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const outputRoot = path.resolve("out");
let aliasesCreated = 0;

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(entryPath));
    else files.push(entryPath);
  }
  return files;
}

for (const source of await filesBelow(outputRoot)) {
  const relativeParts = path.relative(outputRoot, source).split(path.sep);
  const rscStart = relativeParts.findIndex((part) => part.startsWith("__next."));
  if (rscStart < 0 || rscStart === relativeParts.length - 1) continue;

  const routeDirectory = path.join(outputRoot, ...relativeParts.slice(0, rscStart));
  const alias = path.join(routeDirectory, relativeParts.slice(rscStart).join("."));
  try {
    const [sourceBody, aliasBody] = await Promise.all([readFile(source), readFile(alias)]);
    if (!sourceBody.equals(aliasBody)) throw new Error(`Conflicting RSC alias: ${path.relative(outputRoot, alias)}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await copyFile(source, alias);
    aliasesCreated += 1;
  }
}

console.log(`Created ${aliasesCreated} flattened Next.js static RSC aliases.`);
