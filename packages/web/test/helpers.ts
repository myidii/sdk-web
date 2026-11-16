export const SESSION_URL = "https://verify.myidii.test/s/ses_123?lang=en";
export const SESSION_ORIGIN = "https://verify.myidii.test";

/** Loads a fresh copy of the SDK so the "one scan at a time" flag never leaks between tests. */
export async function loadSdk() {
  const { vi } = await import("vitest");
  vi.resetModules();
  return import("../src/index");
}

/** Posts a message as if it came from the hosted scan page (or from somewhere else). */
export function post(data: unknown, origin = SESSION_ORIGIN) {
  window.dispatchEvent(new MessageEvent("message", { data, origin }));
}

export const liveness = (event: string, extra: Record<string, unknown> = {}) => ({ type: "myidii:liveness", event, ...extra });

export const overlay = () => document.querySelector<HTMLDivElement>("[data-myidii]");
export const frame = () => document.querySelector<HTMLDivElement>("[data-myidii] .mi-frame");
export const iframe = () => document.querySelector<HTMLIFrameElement>("[data-myidii] iframe");
export const closeButton = () => document.querySelector<HTMLButtonElement>("[data-myidii] .mi-x");
