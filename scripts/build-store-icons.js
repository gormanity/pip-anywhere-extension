// Generate store-upload icon PNGs with an opaque app tile background.
//
// Extension toolbar icons stay transparent in dist/{chrome,edge}. Store icons
// need to read as app artwork on white marketplace surfaces.

import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(repoRoot, "dist", "store", "icons");
const iconSvg = readFileSync(join(repoRoot, "src", "assets", "icon.svg"));
const sizes = [128, 300];

mkdirSync(outDir, { recursive: true });

for (const size of sizes) {
  await buildStoreIcon(size);
}

async function buildStoreIcon(size) {
  const tileInset = Math.round(size * 0.08);
  const tileSize = size - tileInset * 2;
  const tileRadius = Math.round(size * 0.18);
  const markSize = Math.round(size * 0.64);
  const markInset = Math.round((size - markSize) / 2);

  const tile = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect x="${tileInset}" y="${tileInset}" width="${tileSize}" height="${tileSize}" rx="${tileRadius}" fill="#0f172a"/>
    </svg>
  `);

  const mark = await sharp(iconSvg).resize(markSize, markSize).png().toBuffer();
  const output = join(outDir, `icon${size}.png`);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: tile, left: 0, top: 0 },
      { input: mark, left: markInset, top: markInset },
    ])
    .png()
    .toFile(output);

  console.log(`${output} ${size}x${size}`);
}
