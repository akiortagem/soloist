import { readFile, readdir } from "node:fs/promises";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const featuresRoot = join(root, "src", "features");
const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g;
const layers = new Set([
  "domain",
  "application",
  "infrastructure",
  "presentation",
]);
const forbiddenLayerImports = {
  domain: new Set(["application", "infrastructure", "presentation"]),
  application: new Set(["infrastructure", "presentation"]),
  infrastructure: new Set(["presentation"]),
  presentation: new Set(["infrastructure"]),
};

function importedFeaturePath(file, specifier) {
  if (specifier.startsWith(".")) {
    const target = normalize(resolve(dirname(file), specifier));
    const targetParts = relative(featuresRoot, target).split(sep);
    return targetParts[0].startsWith("..") ? undefined : targetParts;
  }

  const match = specifier
    .replaceAll("\\", "/")
    .match(/^(?:@\/|src\/)?features\/([^/]+)(?:\/(.+))?$/);
  return match ? [match[1], ...(match[2]?.split("/") ?? [])] : undefined;
}

function importedLayer(specifier, targetParts) {
  if (targetParts && layers.has(targetParts[1])) return targetParts[1];
  return specifier
    .replaceAll("\\", "/")
    .split("/")
    .find((part) => layers.has(part));
}

function isFeaturePublicApi(targetParts) {
  return (
    targetParts.length === 1 ||
    (targetParts.length === 2 && /^index(?:\.[^/]+)?$/.test(targetParts[1]))
  );
}

async function files(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory()
          ? files(path)
          : /\.(ts|tsx)$/.test(entry.name)
            ? [path]
            : [];
      }),
    )
  ).flat();
}

const violations = [];
for (const file of await files(featuresRoot)) {
  const parts = relative(featuresRoot, file).split(sep);
  const [feature, layer] = parts;
  if (!layers.has(layer)) continue;
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    const targetParts = importedFeaturePath(file, specifier);
    const targetLayer = importedLayer(specifier, targetParts);
    if (layer === "domain" && /^(react|@tauri-apps)(\/|$)/.test(specifier)) {
      violations.push(`${relative(root, file)}: domain imports '${specifier}'`);
    }
    if (targetLayer && forbiddenLayerImports[layer].has(targetLayer)) {
      violations.push(
        `${relative(root, file)}: ${layer} imports ${targetLayer} '${specifier}'`,
      );
    }
    if (
      targetParts &&
      targetParts[0] !== feature &&
      !isFeaturePublicApi(targetParts)
    ) {
      violations.push(
        `${relative(root, file)}: cross-feature deep import '${specifier}' (use the feature public API)`,
      );
    }
  }
}

if (violations.length) {
  console.error(`Architecture boundary violations:\n${violations.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("Feature layer and public API boundaries are valid.");
}
