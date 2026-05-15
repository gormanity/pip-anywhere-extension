import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const assets = [
  [
    "store/screenshots/01-hover-overlay.html",
    "store/screenshots/01-hover-overlay.png",
    1280,
    800,
  ],
  [
    "store/screenshots/02-keyboard-toolbar.html",
    "store/screenshots/02-keyboard-toolbar.png",
    1280,
    800,
  ],
  [
    "store/screenshots/03-site-unblocking.html",
    "store/screenshots/03-site-unblocking.png",
    1280,
    800,
  ],
  [
    "store/screenshots/04-options.html",
    "store/screenshots/04-options.png",
    1280,
    800,
  ],
  [
    "store/screenshots/05-preview-suppression.html",
    "store/screenshots/05-preview-suppression.png",
    1280,
    800,
  ],
  ["store/promo/small-promo.html", "store/promo/small-promo.png", 440, 280],
  [
    "store/promo/marquee-promo.html",
    "store/promo/marquee-promo.png",
    1400,
    560,
  ],
].map(([source, output, width, height]) => ({ source, output, width, height }));

const browser = await chromium.launch();
try {
  for (const asset of assets) {
    await renderAsset(asset);
  }
} finally {
  await browser.close();
}

async function renderAsset(asset) {
  const page = await browser.newPage({
    viewport: { width: asset.width, height: asset.height },
    deviceScaleFactor: 1,
  });

  const source = resolve(repoRoot, asset.source);
  const output = resolve(repoRoot, asset.output);
  mkdirSync(dirname(output), { recursive: true });

  await page.goto(pathToFileURL(source).href);
  await page.screenshot({
    path: output,
    fullPage: false,
    animations: "disabled",
  });
  await page.close();

  const metadata = await sharp(output).metadata();
  if (metadata.width !== asset.width || metadata.height !== asset.height) {
    throw new Error(
      `${asset.output} rendered at ${metadata.width}x${metadata.height}; expected ${asset.width}x${asset.height}`,
    );
  }

  console.log(`${asset.output} ${asset.width}x${asset.height}`);
}
