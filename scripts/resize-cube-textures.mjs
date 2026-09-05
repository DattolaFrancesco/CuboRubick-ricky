import sharp from "sharp";
import { readdirSync, mkdirSync, statSync } from "fs";
import { join } from "path";

const SRC_DIR = "public/foto";
const OUT_DIR = "public/foto-cube";
const MAX_DIM = 640;
const QUALITY = 78;

mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(SRC_DIR).filter((f) => /\.jpe?g$/i.test(f));

let totalIn = 0;
let totalOut = 0;

for (const file of files) {
  const src = join(SRC_DIR, file);
  const out = join(OUT_DIR, file);
  const inSize = statSync(src).size;
  totalIn += inSize;
  await sharp(src)
    .rotate()
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toFile(out);
  const outSize = statSync(out).size;
  totalOut += outSize;
  console.log(`${file}: ${(inSize / 1024 / 1024).toFixed(1)}MB -> ${(outSize / 1024).toFixed(0)}KB`);
}

console.log(`\nTotal: ${(totalIn / 1024 / 1024).toFixed(0)}MB -> ${(totalOut / 1024 / 1024).toFixed(1)}MB`);
