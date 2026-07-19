import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const sourceRoot = resolve("test-fixtures/script-plugins");
const outputRoot = resolve("test-fixtures/packages");
const fixedDosTime = 0;
const fixedDosDate = 33; // 1980-01-01

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const out = Buffer.alloc(2);
  out.writeUInt16LE(value);
  return out;
}

function u32(value) {
  const out = Buffer.alloc(4);
  out.writeUInt32LE(value >>> 0);
  return out;
}

async function filesBelow(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path, root));
    else if (entry.isFile()) files.push(relative(root, path).replaceAll("\\", "/"));
  }
  return files;
}

async function createZip(directory) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const names = await filesBelow(directory);
  for (const name of names) {
    const nameBytes = Buffer.from(name);
    const contents = await readFile(join(directory, name));
    const checksum = crc32(contents);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(fixedDosTime), u16(fixedDosDate),
      u32(checksum), u32(contents.length), u32(contents.length), u16(nameBytes.length), u16(0),
      nameBytes, contents,
    ]);
    centralParts.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(fixedDosTime), u16(fixedDosDate),
      u32(checksum), u32(contents.length), u32(contents.length), u16(nameBytes.length),
      u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes,
    ]));
    localParts.push(local);
    offset += local.length;
  }
  const central = Buffer.concat(centralParts);
  return Buffer.concat([
    ...localParts,
    central,
    u32(0x06054b50), u16(0), u16(0), u16(names.length), u16(names.length),
    u32(central.length), u32(offset), u16(0),
  ]);
}

await mkdir(outputRoot, { recursive: true });
for (const fixture of (await readdir(sourceRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))) {
  await writeFile(join(outputRoot, `${fixture.name}.soloist-plugin`), await createZip(join(sourceRoot, fixture.name)));
}
