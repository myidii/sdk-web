import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_ORIGIN, SESSION_URL, closeButton, frame, iframe, liveness, loadSdk, overlay, post } from "./helpers";

let sdk: Awaited<ReturnType<typeof loadSdk>>;

beforeEach(async () => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
  document.body.style.overflow = "";
  sdk = await loadSdk();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Lets the fade-out finish so the overlay is removed. */
const settle = () => vi.advanceTimersByTime(300);

describe("exports", () => {
  it("exposes startLiveness as a named export, on Myidii and on the default export", () => {
    expect(typeof sdk.startLiveness).toBe("function");
    expect(sdk.Myidii.startLiveness).toBe(sdk.startLiveness);
    expect(sdk.default).toBe(sdk.Myidii);
  });
});

describe("opening the modal", () => {
  it("adds one overlay with an iframe to the body", () => {
    sdk.startLiveness({ url: SESSION_URL });
    expect(document.querySelectorAll("[data-myidii]")).toHaveLength(1);
    expect(overlay()!.parentElement).toBe(document.body);
    expect(iframe()).not.toBeNull();
  });

  it("points the iframe at the session url with embed=1, keeping the existing query", () => {
    sdk.startLiveness({ url: SESSION_URL });
    const src = new URL(iframe()!.src);
    expect(src.origin).toBe(SESSION_ORIGIN);
    expect(src.pathname).toBe("/s/ses_123");
    expect(src.searchParams.get("embed")).toBe("1");
    expect(src.searchParams.get("lang")).toBe("en");
  });

  it("overwrites an embed parameter already on the url", () => {
    sdk.startLiveness({ url: "https://verify.myidii.test/s/1?embed=0" });
    expect(new URL(iframe()!.src).searchParams.getAll("embed")).toEqual(["1"]);
  });

  it("lets the iframe use the camera", () => {
    sdk.startLiveness({ url: SESSION_URL });
    const allow = iframe()!.getAttribute("allow")!.split(";").map((s) => s.trim());
    expect(allow).toContain("camera");
    expect(iframe()!.getAttribute("title")).toBe("Face verification");
  });

  it("marks the frame as a modal dialog with a labelled close button", () => {
    sdk.startLiveness({ url: SESSION_URL });
    expect(frame()!.getAttribute("role")).toBe("dialog");
    expect(frame()!.getAttribute("aria-modal")).toBe("true");
    expect(closeButton()!.getAttribute("aria-label")).toBe("Close");
  });

  it("fades in on the next animation frame", () => {
    sdk.startLiveness({ url: SESSION_URL });
    expect(overlay()!.classList.contains("in")).toBe(false);
    vi.advanceTimersToNextFrame();
    expect(overlay()!.classList.contains("in")).toBe(true);
  });

  it("locks page scrolling while open", () => {
    document.body.style.overflow = "scroll";
    sdk.startLiveness({ url: SESSION_URL });
    expect(document.body.style.overflow).toBe("hidden");
  });
});

describe("messages from the scan page", () => {
  it("resolves with the status and session id on done", async () => {
    const p = sdk.startLiveness({ url: SESSION_URL });
    post(liveness("done", { status: "passed", sessionId: "ses_123" }));
    await expect(p).resolves.toEqual({ status: "passed", sessionId: "ses_123" });
  });

  it.each(["failed", "expired"] as const)("passes a %s status through", async (status) => {
    const p = sdk.startLiveness({ url: SESSION_URL });
    post(liveness("done", { status, sessionId: "ses_9" }));
    await expect(p).resolves.toEqual({ status, sessionId: "ses_9" });
  });

  it("uses null when done has no session id", async () => {
    const p = sdk.startLiveness({ url: SESSION_URL });
    post(liveness("done", { status: "failed" }));
    await expect(p).resolves.toEqual({ status: "failed", sessionId: null });
  });

  it("does not call onCancel when the scan finishes", async () => {
    const onCancel = vi.fn();
    const p = sdk.startLiveness({ url: SESSION_URL, onCancel });
    post(liveness("done", { status: "passed", sessionId: "ses_123" }));
    await p;
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when the scan page reports cancelled", async () => {
    const onCancel = vi.fn();
    const p = sdk.startLiveness({ url: SESSION_URL, onCancel });
    post(liveness("done", { status: "cancelled", sessionId: "ses_123" }));
    await expect(p).resolves.toEqual({ status: "cancelled", sessionId: "ses_123" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["another origin", "https://evil.example.test"],
    ["a lookalike subdomain", "https://verify.myidii.test.evil.example"],
    ["http instead of https", "http://verify.myidii.test"],
    ["another port", "https://verify.myidii.test:8443"],
    ["the host page itself", "https://shop.example.test"],
    ["an empty origin", ""],
  ])("ignores done from %s", async (_name, origin) => {
    const onResolve = vi.fn();
    sdk.startLiveness({ url: SESSION_URL }).then(onResolve);
    post(liveness("done", { status: "passed", sessionId: "forged" }), origin);
    post(liveness("expand"), origin);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onResolve).not.toHaveBeenCalled();
    expect(overlay()).not.toBeNull();
    expect(frame()!.classList.contains("full")).toBe(false);
  });

  it("still listens after ignoring a forged message", async () => {
    const p = sdk.startLiveness({ url: SESSION_URL });
    post(liveness("done", { status: "passed", sessionId: "forged" }), "https://evil.example.test");
    post(liveness("done", { status: "failed", sessionId: "ses_123" }));
    await expect(p).resolves.toEqual({ status: "failed", sessionId: "ses_123" });
  });

  it.each([
    ["another type", { type: "other", event: "done", status: "passed" }],
    ["a string", "myidii:liveness"],
    ["null", null],
    ["no type", { event: "done", status: "passed" }],
  ])("ignores messages with %s from the right origin", async (_name, data) => {
    const onResolve = vi.fn();
    sdk.startLiveness({ url: SESSION_URL }).then(onResolve);
    post(data);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onResolve).not.toHaveBeenCalled();
    expect(overlay()).not.toBeNull();
  });

  it("ignores unknown events", async () => {
    const onResolve = vi.fn();
    sdk.startLiveness({ url: SESSION_URL }).then(onResolve);
    post(liveness("progress", { value: 0.5 }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(onResolve).not.toHaveBeenCalled();
    expect(frame()!.classList.contains("full")).toBe(false);
  });

  it("expand fills the screen and collapse shrinks it back", () => {
    sdk.startLiveness({ url: SESSION_URL });
    expect(frame()!.classList.contains("full")).toBe(false);
    post(liveness("expand"));
    expect(frame()!.classList.contains("full")).toBe(true);
    post(liveness("expand"));
    expect(frame()!.classList.contains("full")).toBe(true);
    post(liveness("collapse"));
    expect(frame()!.classList.contains("full")).toBe(false);
  });
});

describe("closing", () => {
  it("Escape resolves cancelled and calls onCancel once", async () => {
    const onCancel = vi.fn();
    const p = sdk.startLiveness({ url: SESSION_URL, onCancel });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await expect(p).resolves.toEqual({ status: "cancelled", sessionId: null });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("other keys do nothing", async () => {
    const onResolve = vi.fn();
    sdk.startLiveness({ url: SESSION_URL }).then(onResolve);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(onResolve).not.toHaveBeenCalled();
  });

  it("the close button resolves cancelled and calls onCancel once", async () => {
    const onCancel = vi.fn();
    const p = sdk.startLiveness({ url: SESSION_URL, onCancel });
    closeButton()!.click();
    await expect(p).resolves.toEqual({ status: "cancelled", sessionId: null });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("works without onCancel", async () => {
    const p = sdk.startLiveness({ url: SESSION_URL });
    closeButton()!.click();
    await expect(p).resolves.toEqual({ status: "cancelled", sessionId: null });
  });

  it("does not cancel a scan that already finished when close is clicked during the fade out", async () => {
    const onCancel = vi.fn();
    const p = sdk.startLiveness({ url: SESSION_URL, onCancel });
    post(liveness("done", { status: "passed", sessionId: "ses_123" }));
    closeButton()!.click();
    await expect(p).resolves.toEqual({ status: "passed", sessionId: "ses_123" });
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe("cleanup", () => {
  it("fades out, then removes the overlay and restores body overflow", async () => {
    document.body.style.overflow = "auto";
    const p = sdk.startLiveness({ url: SESSION_URL });
    vi.advanceTimersToNextFrame();
    post(liveness("done", { status: "passed", sessionId: "ses_123" }));
    await p;
    expect(overlay()!.classList.contains("in")).toBe(false);
    expect(document.body.style.overflow).toBe("hidden");
    settle();
    expect(overlay()).toBeNull();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("removes its message and keydown listeners", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const p = sdk.startLiveness({ url: SESSION_URL });
    const added = add.mock.calls.filter(([type]) => type === "message" || type === "keydown");
    expect(added.map(([type]) => type).sort()).toEqual(["keydown", "message"]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await p;
    for (const [type, listener] of added) expect(remove).toHaveBeenCalledWith(type, listener);
  });

  it("stops reacting to messages and keys after it resolves", async () => {
    const onCancel = vi.fn();
    const p = sdk.startLiveness({ url: SESSION_URL, onCancel });
    post(liveness("done", { status: "passed", sessionId: "ses_123" }));
    await p;
    settle();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    post(liveness("done", { status: "failed", sessionId: "ses_456" }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(overlay()).toBeNull();
  });

  it("can open a new scan once the previous one is gone", async () => {
    const first = sdk.startLiveness({ url: SESSION_URL });
    closeButton()!.click();
    await first;
    settle();
    const second = sdk.startLiveness({ url: "https://verify.myidii.test/s/ses_2" });
    expect(document.querySelectorAll("[data-myidii]")).toHaveLength(1);
    post(liveness("done", { status: "passed", sessionId: "ses_2" }));
    await expect(second).resolves.toEqual({ status: "passed", sessionId: "ses_2" });
  });
});

describe("one scan at a time", () => {
  it("rejects a second call while a scan is open, and leaves the first one running", async () => {
    const first = sdk.startLiveness({ url: SESSION_URL });
    await expect(sdk.startLiveness({ url: SESSION_URL })).rejects.toThrow("A scan is already open.");
    expect(document.querySelectorAll("[data-myidii]")).toHaveLength(1);
    post(liveness("done", { status: "passed", sessionId: "ses_123" }));
    await expect(first).resolves.toEqual({ status: "passed", sessionId: "ses_123" });
  });
});

describe("bad input", () => {
  it.each([
    ["no options", undefined],
    ["no url", {}],
    ["an empty url", { url: "" }],
  ])("rejects with %s", async (_name, opts) => {
    await expect(sdk.startLiveness(opts as never)).rejects.toThrow("Pass the session url your server got from POST /v1/sessions.");
    expect(overlay()).toBeNull();
  });

  it("a rejected call does not block the next one", async () => {
    await expect(sdk.startLiveness({ url: "" })).rejects.toThrow();
    const p = sdk.startLiveness({ url: SESSION_URL });
    expect(overlay()).not.toBeNull();
    closeButton()!.click();
    await p;
  });
});

describe("redirect mode", () => {
  it("sends the browser to the session url and never resolves", async () => {
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    const onResolve = vi.fn();
    const onReject = vi.fn();
    sdk.startLiveness({ url: SESSION_URL, mode: "redirect" }).then(onResolve, onReject);
    expect(assign).toHaveBeenCalledWith(SESSION_URL);
    expect(overlay()).toBeNull();
    await vi.advanceTimersByTimeAsync(5000);
    expect(onResolve).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
  });

  it("does not add embed=1 or lock scrolling", () => {
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    sdk.startLiveness({ url: SESSION_URL, mode: "redirect" });
    expect(assign.mock.calls[0][0]).not.toContain("embed");
    expect(document.body.style.overflow).toBe("");
  });
});
