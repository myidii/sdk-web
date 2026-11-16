/**
 * MYIDII Web SDK. Opens the hosted liveness scan for a session your server created.
 * It never sees a secret key and never decides the result: always confirm the verdict
 * from your server with GET /v1/sessions/:id or the session.completed webhook.
 */

export type LivenessStatus = "passed" | "failed" | "expired" | "cancelled";
export type LivenessResult = {
  /** A hint for your UI only. Confirm it on your server before acting on it. */
  status: LivenessStatus;
  sessionId: string | null;
};
export type StartOptions = {
  /** The `url` from the session your server created. */
  url: string;
  /** "modal" opens the scan over your page. "redirect" sends the browser to it. Default "modal". */
  mode?: "modal" | "redirect";
  /** Called when the person closes the modal before finishing. */
  onCancel?: () => void;
};

const MSG = "myidii:liveness";
let open = false;

function overlay(url: string) {
  const root = document.createElement("div");
  root.setAttribute("data-myidii", "");
  root.innerHTML = `
    <style>
      [data-myidii]{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;background:rgba(10,10,10,.55);opacity:0;transition:opacity .25s ease}
      [data-myidii].in{opacity:1}
      [data-myidii] .mi-frame{position:relative;width:min(440px,100vw);height:min(720px,100dvh);border-radius:24px;overflow:hidden;background:#F6F7F9;box-shadow:0 30px 80px -20px rgba(0,0,0,.5);transform:translateY(12px) scale(.98);transition:transform .35s cubic-bezier(.22,1,.36,1),width .4s cubic-bezier(.22,1,.36,1),height .4s cubic-bezier(.22,1,.36,1),border-radius .4s}
      [data-myidii] .mi-frame.full{width:100vw;height:100dvh;border-radius:0}
      [data-myidii].in .mi-frame{transform:none}
      [data-myidii] iframe{width:100%;height:100%;border:0;display:block}
      [data-myidii] .mi-x{position:absolute;top:22px;right:22px;z-index:1;width:32px;height:32px;border:0;border-radius:50%;background:rgba(10,10,10,.06);color:#0A0A0A;font:16px/1 system-ui;cursor:pointer}
      @media (max-width:480px){[data-myidii] .mi-frame{border-radius:0;height:100dvh}}
    </style>
    <div class="mi-frame" role="dialog" aria-modal="true" aria-label="Face verification">
      <iframe allow="camera; fullscreen" title="Face verification"></iframe>
      <button class="mi-x" aria-label="Close">✕</button>
    </div>`;
  const frame = root.querySelector("iframe")!;
  const u = new URL(url);
  u.searchParams.set("embed", "1");
  frame.src = u.toString();
  document.body.appendChild(root);
  requestAnimationFrame(() => root.classList.add("in"));
  return { root, close: root.querySelector(".mi-x") as HTMLButtonElement, origin: u.origin };
}

/** Runs the scan. Resolves when the person finishes or closes it. */
export function startLiveness(opts: StartOptions): Promise<LivenessResult> {
  if (typeof window === "undefined") return Promise.reject(new Error("startLiveness runs in the browser."));
  if (!opts?.url) return Promise.reject(new Error("Pass the session url your server got from POST /v1/sessions."));
  if (opts.mode === "redirect") {
    window.location.assign(opts.url);
    return new Promise(() => {});
  }
  if (open) return Promise.reject(new Error("A scan is already open."));
  open = true;
  return new Promise((resolve) => {
    const { root, close, origin } = overlay(opts.url);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let settled = false;
    const finish = (result: LivenessResult) => {
      // The close button stays clickable while the overlay fades out. Only the first outcome counts.
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKey);
      root.classList.remove("in");
      setTimeout(() => { root.remove(); document.body.style.overflow = prevOverflow; open = false; }, 250);
      if (result.status === "cancelled") opts.onCancel?.();
      resolve(result);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.data?.type !== MSG) return;
      // A live scan fills the screen while it runs: the colour check needs the light. See the scan page.
      if (e.data.event === "expand") root.querySelector(".mi-frame")!.classList.add("full");
      if (e.data.event === "collapse") root.querySelector(".mi-frame")!.classList.remove("full");
      if (e.data.event === "done") finish({ status: e.data.status, sessionId: e.data.sessionId ?? null });
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish({ status: "cancelled", sessionId: null }); };
    close.addEventListener("click", () => finish({ status: "cancelled", sessionId: null }));
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKey);
  });
}

export const Myidii = { startLiveness };
export default Myidii;
