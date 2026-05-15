import { mkdirSync, readdirSync, rmSync, statSync } from "fs";
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

  const output = resolve(
    releases,
    `ultimate-pip-${pkg.version}-${browser}.zip`,
  );
  const args = ["-qry", output, ...readdirSync(source)];
  const result = spawnSync("zip", args, { cwd: source, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`zip failed for ${browser}`);
  }
}
