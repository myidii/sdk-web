// The published files in a real browser. Every request is answered by page.route, so nothing leaves the
// machine: shop.example.test plays the developer's site and verify.myidii.test plays the hosted scan page,
// on a different origin, the same way production runs.
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const work = process.env.MYIDII_PACKAGING_DIR;
if (!work) throw new Error("Run this through `npm run test:packaging`, which prepares the packed packages.");
const app = join(work, "app");
const installedWeb = join(app, "node_modules/@myidii/web");
const repoVersion = JSON.parse(readFileSync(join(__dirname, "../packages/web/package.json"), "utf8")).version;

const SHOP = "https://shop.example.test";
const SCAN = "https://verify.myidii.test";
const SESSION_URL = `${SCAN}/s/ses_e2e?lang=en`;

// The stand-in scan page: buttons that post the same messages the real one does.
const scanPage = `<!doctype html><meta charset="utf-8"><title>scan</title>
<script>
  const send = (event, extra) => parent.postMessage(Object.assign({ type: "myidii:liveness", event }, extra), "*");
</script>
<button id="expand" onclick="send('expand')">expand</button>
<button id="collapse" onclick="send('collapse')">collapse</button>
<button id="pass" onclick="send('done', { status: 'passed', sessionId: 'ses_e2e' })">pass</button>
<button id="fail" onclick="send('done', { status: 'failed', sessionId: 'ses_e2e' })">fail</button>
<p id="query"></p><script>document.getElementById("query").textContent = location.search</script>`;

const html = (body: string) => `<!doctype html><html><head><meta charset="utf-8"><title>shop</title></head><body>${body}</body></html>`;

async function serve(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const send = (body: string, contentType: string) => route.fulfill({ status: 200, contentType, body });
    if (url.origin === SCAN && url.pathname.startsWith("/s/")) return send(scanPage, "text/html");
    if (url.origin === SHOP) {
      if (url.pathname === "/myidii.min.js") return send(readFileSync(join(installedWeb, "dist/myidii.min.js"), "utf8"), "text/javascript");
      if (url.pathname === "/app.js") return send(readFileSync(join(app, "out/app.js"), "utf8"), "text/javascript");
      if (url.pathname === "/script.html") return send(html(`<p>shop</p><script src="/myidii.min.js"></script>`), "text/html");
      if (url.pathname === "/react.html") {
        return send(html(`<div id="root"></div><script>window.SESSION_URL = ${JSON.stringify(SESSION_URL)}</script><script type="module" src="/app.js"></script>`), "text/html");
      }
    }
    return route.abort("blockedbyclient");
  });
  return errors;
}

const scanFrame = (page: Page) => page.frameLocator("[data-myidii] iframe");

test.describe("script tag build (dist/myidii.min.js)", () => {
  test("exposes window.MYIDII with startLiveness and the package version", async ({ page }) => {
    const errors = await serve(page);
    await page.goto(`${SHOP}/script.html`);
    const api = await page.evaluate(() => {
      const m = (window as unknown as { MYIDII: { startLiveness: unknown; version: unknown } }).MYIDII;
      return { startLiveness: typeof m.startLiveness, version: m.version, keys: Object.keys(m).sort() };
    });
    expect(api).toEqual({ startLiveness: "function", version: repoVersion, keys: ["startLiveness", "version"] });
    const installedVersion = JSON.parse(readFileSync(join(installedWeb, "package.json"), "utf8")).version;
    expect(api.version).toBe(installedVersion);
    expect(errors).toEqual([]);
  });

  test("opens the scan in an overlay and resolves with the result from the scan page", async ({ page }) => {
    const errors = await serve(page);
    await page.goto(`${SHOP}/script.html`);
    await page.evaluate((url) => {
      const w = window as unknown as { MYIDII: { startLiveness: (o: { url: string }) => Promise<unknown> }; result?: Promise<unknown> };
      w.result = w.MYIDII.startLiveness({ url });
    }, SESSION_URL);

    const overlay = page.locator("[data-myidii]");
    await expect(overlay).toHaveCount(1);
    await expect(overlay).toHaveClass(/\bin\b/);
    const iframe = overlay.locator("iframe");
    const src = new URL((await iframe.getAttribute("src"))!);
    expect(src.origin).toBe(SCAN);
    expect(src.searchParams.get("embed")).toBe("1");
    expect(src.searchParams.get("lang")).toBe("en");
    expect(await iframe.getAttribute("allow")).toContain("camera");
    await expect(page.getByRole("dialog", { name: "Face verification" })).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    // The scan page really loaded inside the iframe, with the query the SDK built.
    await expect(scanFrame(page).locator("#query")).toHaveText("?lang=en&embed=1");

    await scanFrame(page).locator("#expand").click();
    await expect(overlay.locator(".mi-frame")).toHaveClass(/\bfull\b/);
    await scanFrame(page).locator("#collapse").click();
    await expect(overlay.locator(".mi-frame")).not.toHaveClass(/\bfull\b/);

    await scanFrame(page).locator("#pass").click();
    expect(await page.evaluate(() => (window as unknown as { result: Promise<unknown> }).result)).toEqual({ status: "passed", sessionId: "ses_e2e" });
    await expect(overlay).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    expect(errors).toEqual([]);
  });

  test("ignores a forged message from the host page, and Escape cancels", async ({ page }) => {
    const errors = await serve(page);
    await page.goto(`${SHOP}/script.html`);
    await page.evaluate((url) => {
      const w = window as unknown as { MYIDII: { startLiveness: (o: object) => Promise<unknown> }; result?: Promise<unknown>; cancels: number };
      w.cancels = 0;
      w.result = w.MYIDII.startLiveness({ url, onCancel: () => { w.cancels++; } });
    }, SESSION_URL);
    await expect(scanFrame(page).locator("#pass")).toBeVisible();

    // Same shape as the real message, but posted by the shop page itself, so its origin is wrong.
    await page.evaluate(() => window.postMessage({ type: "myidii:liveness", event: "done", status: "passed", sessionId: "forged" }, "*"));
    await page.evaluate(() => window.postMessage({ type: "myidii:liveness", event: "expand" }, "*"));
    await page.waitForTimeout(100);
    await expect(page.locator("[data-myidii]")).toHaveCount(1);
    await expect(page.locator("[data-myidii] .mi-frame")).not.toHaveClass(/\bfull\b/);

    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => (window as unknown as { result: Promise<unknown> }).result)).toEqual({ status: "cancelled", sessionId: null });
    expect(await page.evaluate(() => (window as unknown as { cancels: number }).cancels)).toBe(1);
    await expect(page.locator("[data-myidii]")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("the close button cancels", async ({ page }) => {
    await serve(page);
    await page.goto(`${SHOP}/script.html`);
    await page.evaluate((url) => {
      const w = window as unknown as { MYIDII: { startLiveness: (o: object) => Promise<unknown> }; result?: Promise<unknown> };
      w.result = w.MYIDII.startLiveness({ url });
    }, SESSION_URL);
    await page.getByRole("button", { name: "Close" }).click();
    expect(await page.evaluate(() => (window as unknown as { result: Promise<unknown> }).result)).toEqual({ status: "cancelled", sessionId: null });
  });
});

test.describe("React app bundled with esbuild", () => {
  test("LivenessButton runs the scan and reports the result", async ({ page }) => {
    const errors = await serve(page);
    await page.goto(`${SHOP}/react.html`);
    const button = page.getByRole("button", { name: "Verify" });
    await expect(button).toHaveClass("verify");
    await expect(button).toHaveAttribute("aria-busy", "false");

    await button.click();
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button).toBeDisabled();
    await scanFrame(page).locator("#fail").click();

    await expect(page.locator("#status")).toHaveText("failed:ses_e2e");
    await expect(button).toHaveAttribute("aria-busy", "false");
    await expect(button).toBeEnabled();
    await expect(page.locator("[data-myidii]")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("useLiveness stores the result", async ({ page }) => {
    const errors = await serve(page);
    await page.goto(`${SHOP}/react.html`);
    await page.locator("#hook").click();
    await expect(page.locator("#hook")).toBeDisabled();
    await scanFrame(page).locator("#pass").click();
    await expect(page.locator("#hook")).toHaveText("passed");
    await expect(page.locator("#hook")).toBeEnabled();
    expect(errors).toEqual([]);
  });
});
