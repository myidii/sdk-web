// Run by run.mjs, which packs the packages and installs the tarballs into MYIDII_PACKAGING_DIR/app first.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = process.env.MYIDII_PACKAGING_DIR;
if (!work) throw new Error("Run this through `npm run test:packaging`, which prepares the packed packages.");
const app = join(work, "app");
const tarballs = { web: process.env.MYIDII_WEB_TGZ, react: process.env.MYIDII_REACT_TGZ };
const bin = (name) => join(repo, "node_modules/.bin", name);
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const webPkg = readJson(join(repo, "packages/web/package.json"));
const installed = (...p) => join(app, "node_modules/@myidii", ...p);

/** Runs a command and returns its output. On failure the output becomes the assertion message. */
function sh(cmd, args, cwd = app) {
  try {
    return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    assert.fail(`${cmd} ${args.join(" ")} failed:\n${e.stdout}\n${e.stderr}`);
  }
}

describe("tarball contents", () => {
  const list = (tgz) => sh("tar", ["-tzf", tgz]).trim().split("\n").map((f) => f.replace(/^package\//, "")).sort();

  it("@myidii/web ships the builds, types, script tag bundle and docs, and no source", () => {
    const files = list(tarballs.web);
    for (const f of ["dist/index.js", "dist/index.cjs", "dist/index.d.ts", "dist/index.d.cts", "dist/myidii.min.js", "package.json", "README.md", "LICENSE"]) {
      assert.ok(files.includes(f), `missing ${f}`);
    }
    assert.deepEqual(files.filter((f) => f.startsWith("src/") || f.startsWith("test/") || f.endsWith(".tgz")), []);
  });

  it("@myidii/react ships the builds, types and docs, and no source", () => {
    const files = list(tarballs.react);
    for (const f of ["dist/index.js", "dist/index.cjs", "dist/index.d.ts", "dist/index.d.cts", "package.json", "README.md", "LICENSE"]) {
      assert.ok(files.includes(f), `missing ${f}`);
    }
    assert.deepEqual(files.filter((f) => f.startsWith("src/") || f.startsWith("test/")), []);
  });
});

describe("publint", () => {
  for (const [name, tgz] of Object.entries(tarballs)) {
    it(`@myidii/${name} has no errors or warnings`, () => {
      const out = sh(bin("publint"), ["run", tgz, "--strict", "--level", "warning"], repo);
      assert.match(out, /No problems found|All good/, out);
    });
  }
});

describe("are the types wrong", () => {
  // ./browser is the script tag bundle: an IIFE that sets window.MYIDII and exports nothing, so there is
  // nothing for TypeScript to resolve. The browser spec covers it. Every other entry point must be clean.
  it("@myidii/web resolves types for every module system", () => {
    sh(bin("attw"), [tarballs.web, "--profile", "strict", "--exclude-entrypoints", "./browser", "--format", "table-flipped", "--no-emoji", "--no-color"], repo);
  });

  it("@myidii/react resolves types for every module system", () => {
    sh(bin("attw"), [tarballs.react, "--profile", "strict", "--format", "table-flipped", "--no-emoji", "--no-color"], repo);
  });
});

describe("installed from the tarballs", () => {
  it("uses the packed @myidii/web, not a copy from the registry", () => {
    const lock = readJson(join(app, "package-lock.json"));
    assert.match(lock.packages["node_modules/@myidii/web"].resolved, /^file:/);
    assert.match(lock.packages["node_modules/@myidii/react"].resolved, /^file:/);
    assert.equal(existsSync(installed("react/node_modules/@myidii/web")), false, "@myidii/react pulled its own @myidii/web");
    assert.equal(readJson(installed("web/package.json")).version, webPkg.version);
  });
});

describe("Node", () => {
  const expectedWeb = ["Myidii", "default", "startLiveness"];
  const expectedReact = ["LivenessButton", "useLiveness"];

  it("ESM import resolves dist/index.js and exposes startLiveness", () => {
    const r = JSON.parse(sh(process.execPath, ["esm.mjs"]));
    assert.equal(r.resolved, pathToFileURL(installed("web/dist/index.js")).href);
    assert.equal(r.browser, pathToFileURL(installed("web/dist/myidii.min.js")).href);
    assert.equal(r.reactResolved, pathToFileURL(installed("react/dist/index.js")).href);
    assert.equal(r.version, webPkg.version);
    assert.deepEqual(r.exports, expectedWeb);
    assert.equal(r.startLiveness, "function");
    assert.equal(r.defaultIsMyidii, true);
    assert.deepEqual(r.reactExports, expectedReact);
  });

  it("CJS require resolves dist/index.cjs and exposes startLiveness", () => {
    const r = JSON.parse(sh(process.execPath, ["cjs.cjs"]));
    assert.equal(r.resolved, installed("web/dist/index.cjs"));
    assert.equal(r.browser, installed("web/dist/myidii.min.js"));
    assert.equal(r.reactResolved, installed("react/dist/index.cjs"));
    assert.equal(r.version, webPkg.version);
    assert.deepEqual(r.exports, expectedWeb);
    assert.equal(r.startLiveness, "function");
    assert.equal(r.defaultIsMyidii, true);
    assert.deepEqual(r.reactExports, expectedReact);
    assert.equal(r.useLiveness, "function");
    assert.equal(r.LivenessButton, "function");
  });

  it("importing on a server does not touch the DOM, and startLiveness rejects cleanly", () => {
    for (const script of ["esm.mjs", "cjs.cjs"]) {
      assert.equal(JSON.parse(sh(process.execPath, [script])).rejected, "startLiveness runs in the browser.");
    }
  });
});

describe("TypeScript consumers", () => {
  const tsc = join(repo, "node_modules/typescript/bin/tsc");
  it('typecheck with moduleResolution "bundler"', () => {
    sh(process.execPath, [tsc, "-p", "tsconfig.bundler.json"]);
  });
  it('typecheck with moduleResolution "node16", from ESM and CJS files', () => {
    sh(process.execPath, [tsc, "-p", "tsconfig.node16.json"]);
  });
});

describe("bundlers", () => {
  it("a React app using @myidii/react builds with esbuild", async () => {
    const esbuild = await import(pathToFileURL(join(repo, "node_modules/esbuild/lib/main.js")).href);
    const result = await esbuild.build({
      absWorkingDir: app,
      entryPoints: ["src/app.tsx"],
      outfile: "out/app.js",
      bundle: true,
      format: "esm",
      platform: "browser",
      jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"' },
      minify: true,
      logLevel: "silent",
      metafile: true,
    });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
    const inputs = Object.keys(result.metafile.inputs);
    assert.ok(inputs.some((f) => f.endsWith("node_modules/@myidii/react/dist/index.js")), "bundled the ESM build of @myidii/react");
    assert.ok(inputs.some((f) => f.endsWith("node_modules/@myidii/web/dist/index.js")), "bundled the ESM build of @myidii/web");
    assert.match(readFileSync(join(app, "out/app.js"), "utf8"), /myidii:liveness/);
  });

  const bundle = async (contents) => {
    const esbuild = await import(pathToFileURL(join(repo, "node_modules/esbuild/lib/main.js")).href);
    const result = await esbuild.build({
      absWorkingDir: app,
      stdin: { contents, resolveDir: app, loader: "js" },
      bundle: true,
      format: "esm",
      write: false,
      logLevel: "silent",
    });
    return { text: result.outputFiles[0].text, warnings: result.warnings };
  };

  it("a bundler can drop @myidii/web when nothing from it is used", async () => {
    const { text } = await bundle('import "@myidii/web"; export const x = 1;');
    assert.doesNotMatch(text, /myidii:liveness/);
  });

  it('import "@myidii/web/browser" keeps the script tag build, which sets window.MYIDII', async () => {
    const { text, warnings } = await bundle('import "@myidii/web/browser";');
    assert.deepEqual(warnings, []);
    assert.match(text, /myidii:liveness/);
    assert.match(text, /\.MYIDII\s*=/);
  });
});
