import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_LINES = 300;
const root = fileURLToPath(new URL("../", import.meta.url));
const baseline = JSON.parse(
  await readFile(
    new URL("architecture-baseline.json", import.meta.url),
    "utf8",
  ),
);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory())
        return entry.name === "tests" ? [] : sourceFiles(path);
      return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")
        ? [path]
        : [];
    }),
  );
  return nested.flat();
}

const violations = [];
for (const file of await sourceFiles(join(root, "src"))) {
  const path = relative(root, file);
  const source = await readFile(file, "utf8");
  const lines = source.split(/\r?\n/).length - (source.endsWith("\n") ? 1 : 0);
  const allowance = baseline[path] ?? MAX_LINES;
  if (lines > allowance)
    violations.push(`${path}: ${lines} lines (allowed ${allowance})`);
}

if (violations.length) {
  console.error(`Production file-size violations:\n${violations.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(
    "Production files satisfy the 300-line limit or legacy baseline.",
  );
}
