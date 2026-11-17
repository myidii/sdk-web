// Tests the packages exactly as npm would publish them.
//
//   1. builds both packages and packs them with `npm pack`
//   2. installs the tarballs into a throwaway app in a temp dir (never this repo's node_modules)
//   3. runs checks.test.mjs (publint, attw, Node ESM and CJS, TypeScript, a React bundle)
//   4. runs browser.spec.ts in Playwright (the script tag build and the React bundle in Chromium)
//
// Flags: --skip-build reuses packages/*/dist, --keep leaves the temp dir for a look around.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const args = new Set(process.argv.slice(2));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { stdio: "inherit", ...opts });
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const work = realpathSync(mkdtempSync(join(tmpdir(), "myidii-sdk-web-packaging-")));
const tarballs = join(work, "tarballs");
const app = join(work, "app");
let failed = false;

try {
  if (!args.has("--skip-build")) {
    console.log("\n> Building");
    run(npm, ["run", "build"], { cwd: repo });
  }

  console.log("\n> Packing");
  mkdirSync(tarballs);
  run(npm, ["pack", "-w", "@myidii/web", "-w", "@myidii/react", "--pack-destination", tarballs, "--silent"], { cwd: repo });
  const web = readJson(join(repo, "packages/web/package.json"));
  const react = readJson(join(repo, "packages/react/package.json"));
  const webTgz = join(tarballs, `myidii-web-${web.version}.tgz`);
  const reactTgz = join(tarballs, `myidii-react-${react.version}.tgz`);

  console.log("\n> Installing the tarballs into a fresh app");
  cpSync(join(here, "fixture"), app, { recursive: true });
  // Pin React to the versions this repo already uses, so the install comes from the npm cache when it can.
  const has = (name) => readJson(join(repo, "node_modules", name, "package.json")).version;
  const pkg = readJson(join(app, "package.json"));
  pkg.dependencies = {
    "@myidii/web": `file:${webTgz}`,
    "@myidii/react": `file:${reactTgz}`,
    react: has("react"),
    "react-dom": has("react-dom"),
  };
  pkg.devDependencies = { "@types/react": has("@types/react"), "@types/react-dom": has("@types/react-dom") };
  writeFileSync(join(app, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  run(npm, ["install", "--prefer-offline", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: app });

  const env = { ...process.env, MYIDII_PACKAGING_DIR: work, MYIDII_WEB_TGZ: webTgz, MYIDII_REACT_TGZ: reactTgz };

  console.log("\n> Package checks");
  run(process.execPath, ["--test", "--test-reporter=spec", join(here, "checks.test.mjs")], { cwd: repo, env });

  console.log("\n> Browser checks");
  run(join(repo, "node_modules/.bin/playwright"), ["test", "-c", join(here, "playwright.config.ts")], { cwd: repo, env });
} catch (e) {
  failed = true;
  console.error(e.status == null ? e : `\nFailed: ${e.message.split("\n")[0]}`);
} finally {
  if (args.has("--keep")) console.log(`\nKept ${work}`);
  else rmSync(work, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
