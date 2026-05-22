import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { resolve } from "path";
import { spawnSync } from "child_process";
import pkg from "../package.json" with { type: "json" };

const root = resolve(import.meta.dirname, "..");
const releases = resolve(root, "releases");
mkdirSync(releases, { recursive: true });
for (const entry of readdirSync(releases)) {
  if (entry.startsWith(`ultimate-pip-${pkg.version}-`)) {
    rmSync(resolve(releases, entry));
  }
}

for (const browser of ["chrome", "edge"]) {
  const source = resolve(root, "dist", browser);
  if (!statSync(source, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Missing build output: ${source}`);
  }
  const packageSource = preparePackageSource(source);

  const output = resolve(
    releases,
    `ultimate-pip-${pkg.version}-${browser}.zip`,
  );
  const args = ["-qry", output, ...readdirSync(packageSource)];
  const result = spawnSync("zip", args, {
    cwd: packageSource,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`zip failed for ${browser}`);
  }

  if (packageSource !== source) {
    rmSync(packageSource, { recursive: true, force: true });
  }
}

function preparePackageSource(source) {
  const packageSource = mkdtempSync(resolve(tmpdir(), "pip-anywhere-package-"));
  cpSync(source, packageSource, { recursive: true });

  const manifestPath = resolve(packageSource, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  delete manifest.key;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  return packageSource;
}
