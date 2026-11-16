import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const webPkg = JSON.parse(readFileSync(new URL("./packages/web/package.json", import.meta.url), "utf8"));

export default defineConfig({
  // Unit tests run against the source. The packaging tests cover the built files.
  resolve: { alias: { "@myidii/web": fileURLToPath(new URL("./packages/web/src/index.ts", import.meta.url)) } },
  define: { __VERSION__: JSON.stringify(webPkg.version) },
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}"],
    environment: "happy-dom",
    environmentOptions: {
      happyDOM: {
        url: "https://shop.example.test/checkout",
        // Never fetch the scan page or anything else: the tests must not touch the network.
        settings: { disableIframePageLoading: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true },
      },
    },
    setupFiles: ["./test/setup.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts"],
      reporter: ["text", "json-summary", "html"],
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 90 },
    },
  },
});
