import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import sharp from "sharp";
import { build, type InlineConfig, type Plugin } from "vite";

const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "package.json"), "utf-8"),
) as { version: string };

const CHROMIUM_LOCAL_PROD_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqWrofqc0az2QIu7LylzTv3ZGyvNv5mP1G0+gn6Q9f/67KtYx+5RltFHs8ef0BThcNwgV3CFf+R9mjRU1iwuiu5UTHxQHXBK5Ft2XaVIzi82OiuQfgGGfIxmQSDkjBPnWaPkR1exB/3MFPrurJgPc61+DggL5iToRdDVYpeDZt3xRJWtn6KEuKOD9HEVahkRi3jttAazx84ygODWMa/MFDuFSsxMMAl1dwo1Lw292OnKnmxQ5jqQ4ih85esa4HW5RgtX7DRBXb7Yjif7n6PkC227X4JJctgYyaIuFxYdVegF5i8rW1sz43NLJpel6d6j4TrsGBPWOylVGHeQOuns60QIDAQAB";
const CHROMIUM_DEV_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArQIV9aaSSmjULoCx5FoGrUgnGBSAGSD79jEjLk19FyCwPbEOH9zeK4DUEJCDzw+ZrjbuSv25lRBADdNvvpndrAWGtsmH8MIdo1mQr3QXjUJOhCwvNZBb5jSf+itIV/t4/GASMr2aALDsfFSFicfoD2Cnkm3soIJi4Yhda+2Cn3J81M/gLcwycUSxxgG33Ukfd2BRsEc/01qud+vpAOXjTeyBHN/pZ4xnm2E3W42nYLUb0QQZ+to3pHUv3e/Qli0CpgnIABW7GKJo+kRkHy871KJoXQDM/m8G/9npy/Y56Q79nQpvuhpWjsA85ppUE/ic04pO4vawVNJhswhvbhe/9wIDAQAB";
const CHROMIUM_LOCAL_PROD_EXTENSION_ID = "dakagfnbbijbflodaajdfgdiddgobjhl";
const CHROMIUM_DEV_EXTENSION_ID = "cjodjanjoahbgiigloplfkiikoejgoge";

const ICON_SIZES: Partial<Record<string, number[]>> = {
  chrome: [16, 32, 48, 128],
  firefox: [16, 32, 48, 128],
  edge: [16, 32, 48, 128, 300],
};

function outDirFor(browser: string, isDev: boolean): string {
  return isDev ? `dist-dev/${browser}` : `dist/${browser}`;
}

function bundleCss(filePath: string): string {
  const dir = dirname(filePath);
  const css = readFileSync(filePath, "utf-8");
  return css.replace(
    /@import\s+["']([^"']+)["']\s*;/g,
    (_match, importPath: string) => {
      return readFileSync(resolve(dir, importPath), "utf-8");
    },
  );
}

async function generateIcons(browser: string, outDir: string): Promise<void> {
  const svg = readFileSync(resolve(import.meta.dirname, "src/assets/icon.svg"));
  await Promise.all(
    (ICON_SIZES[browser] ?? ICON_SIZES.chrome ?? []).map((size) =>
      sharp(svg)
        .resize(size, size)
        .png()
        .toFile(resolve(outDir, `icon${size}.png`)),
    ),
  );
  await Promise.all(
    (ICON_SIZES[browser] ?? ICON_SIZES.chrome ?? []).map((size) =>
      sharp(svg)
        .resize(size, size)
        .grayscale()
        .modulate({ brightness: 0.72 })
        .png()
        .toFile(resolve(outDir, `icon-off${size}.png`)),
    ),
  );
}

function entryConfig(
  browser: string,
  entry: "background" | "content" | "options" | "popup",
  format: "es" | "iife",
  isDev: boolean,
): InlineConfig {
  return {
    resolve: {
      alias: { "@": resolve(import.meta.dirname, "src") },
    },
    build: {
      lib: {
        entry: resolve(import.meta.dirname, `src/${entry}/index.ts`),
        formats: [format],
        fileName: () => `${entry}.js`,
        name: entry,
      },
      outDir: outDirFor(browser, isDev),
      target: "ES2022",
      minify: false,
      sourcemap: true,
      emptyOutDir: false,
    },
    define: {
      __BROWSER__: JSON.stringify(browser),
      __DEV__: JSON.stringify(isDev),
    },
    configFile: false,
    logLevel: "warn",
  };
}

function buildExtras(browser: string, isDev: boolean): Plugin {
  return {
    name: "build-extra-entries",
    async closeBundle() {
      await build(entryConfig(browser, "content", "iife", isDev));
      await build(entryConfig(browser, "options", "es", isDev));
      await build(entryConfig(browser, "popup", "es", isDev));
    },
  };
}

function copyAssets(browser: string, isDev: boolean): Plugin {
  return {
    name: "copy-extension-assets",
    async closeBundle() {
      const outDir = resolve(import.meta.dirname, outDirFor(browser, isDev));
      mkdirSync(outDir, { recursive: true });

      const manifest = JSON.parse(
        readFileSync(
          resolve(import.meta.dirname, `src/manifests/${browser}.json`),
          "utf-8",
        ),
      ) as {
        version: string;
        name: string;
        key?: string;
        externally_connectable?: { ids: string[] };
      };
      manifest.version = pkg.version;
      if (isDev) manifest.name += " (dev)";
      if (browser === "chrome" || browser === "edge") {
        manifest.key = isDev ? CHROMIUM_DEV_KEY : CHROMIUM_LOCAL_PROD_KEY;
        manifest.externally_connectable = {
          ids: isDev
            ? [CHROMIUM_LOCAL_PROD_EXTENSION_ID]
            : [CHROMIUM_DEV_EXTENSION_ID],
        };
      }
      writeFileSync(
        resolve(outDir, "manifest.json"),
        JSON.stringify(manifest, null, 2) + "\n",
      );

      copyFileSync(
        resolve(import.meta.dirname, "src/options/index.html"),
        resolve(outDir, "options.html"),
      );
      copyFileSync(
        resolve(import.meta.dirname, "src/popup/index.html"),
        resolve(outDir, "popup.html"),
      );
      writeFileSync(
        resolve(outDir, "options.css"),
        bundleCss(resolve(import.meta.dirname, "src/options/index.css")),
      );
      writeFileSync(
        resolve(outDir, "popup.css"),
        bundleCss(resolve(import.meta.dirname, "src/popup/index.css")),
      );
      copyFileSync(
        resolve(import.meta.dirname, "src/injected/pip-unblocker.js"),
        resolve(outDir, "pip-unblocker.js"),
      );
      await generateIcons(browser, outDir);
    },
  };
}

export function createConfig(browser: string, mode = "production") {
  const isDev = mode === "development";
  return {
    resolve: {
      alias: { "@": resolve(import.meta.dirname, "src") },
    },
    plugins: [buildExtras(browser, isDev), copyAssets(browser, isDev)],
    build: {
      lib: {
        entry: resolve(import.meta.dirname, "src/background/index.ts"),
        formats: ["es" as const],
        fileName: () => "background.js",
        name: "background",
      },
      outDir: outDirFor(browser, isDev),
      target: "ES2022",
      minify: false,
      sourcemap: true,
      emptyOutDir: true,
    },
    define: {
      __BROWSER__: JSON.stringify(browser),
      __DEV__: JSON.stringify(isDev),
    },
  };
}
