import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "package/reference-script.soloist-plugin");
const names = ["plugin.json", "dist/plugin.js"];

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function u16(value) { const out = Buffer.alloc(2); out.writeUInt16LE(value); return out; }
function u32(value) { const out = Buffer.alloc(4); out.writeUInt32LE(value >>> 0); return out; }

const localParts = [];
const centralParts = [];
let offset = 0;
for (const name of names) {
  const filename = Buffer.from(name);
  const contents = await readFile(resolve(root, name));
  const checksum = crc32(contents);
  const local = Buffer.concat([
    u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(33), u32(checksum),
    u32(contents.length), u32(contents.length), u16(filename.length), u16(0), filename, contents,
  ]);
  centralParts.push(Buffer.concat([
    u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(33), u32(checksum),
    u32(contents.length), u32(contents.length), u16(filename.length), u16(0), u16(0), u16(0),
    u16(0), u32(0), u32(offset), filename,
  ]));
  localParts.push(local);
  offset += local.length;
}
const central = Buffer.concat(centralParts);
const archive = Buffer.concat([
  ...localParts, central, u32(0x06054b50), u16(0), u16(0), u16(names.length), u16(names.length),
  u32(central.length), u32(offset), u16(0),
]);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, archive);
console.log(`Created ${output}`);
