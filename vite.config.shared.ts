import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import sharp from "sharp";
import { build, type InlineConfig, type Plugin } from "vite";

const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "package.json"), "utf-8"),
) as { version: string };

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
}

function entryConfig(
  browser: string,
  entry: "background" | "content" | "options",
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
      ) as { version: string; name: string };
      manifest.version = pkg.version;
      if (isDev) manifest.name += " (dev)";
      writeFileSync(
        resolve(outDir, "manifest.json"),
        JSON.stringify(manifest, null, 2) + "\n",
      );

      copyFileSync(
        resolve(import.meta.dirname, "src/options/index.html"),
        resolve(outDir, "options.html"),
      );
      writeFileSync(
        resolve(outDir, "options.css"),
        bundleCss(resolve(import.meta.dirname, "src/options/index.css")),
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
