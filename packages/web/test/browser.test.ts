import { describe, expect, it, vi } from "vitest";
import pkg from "../package.json";

describe("script tag entry", () => {
  it("puts startLiveness and the package version on window.MYIDII", async () => {
    vi.resetModules();
    delete (globalThis as { MYIDII?: unknown }).MYIDII;
    await import("../src/browser");
    const api = (window as unknown as { MYIDII: { startLiveness: unknown; version: string } }).MYIDII;
    expect(typeof api.startLiveness).toBe("function");
    expect(api.version).toBe(pkg.version);
  });
});
