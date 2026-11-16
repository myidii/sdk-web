// @vitest-environment node
import { describe, expect, it } from "vitest";
import { startLiveness } from "../src/index";

describe("on the server", () => {
  it("has no window", () => {
    expect(typeof window).toBe("undefined");
  });

  it("rejects instead of throwing, so server rendering does not crash", async () => {
    const p = startLiveness({ url: "https://verify.myidii.test/s/1" });
    expect(p).toBeInstanceOf(Promise);
    await expect(p).rejects.toThrow("startLiveness runs in the browser.");
  });
});
