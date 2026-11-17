// A small React app using @myidii/react. Typechecked under every config, then bundled with esbuild and run
// in Chromium by browser.spec.ts.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { LivenessButton, useLiveness, type LivenessButtonProps, type LivenessResult, type LivenessStatus } from "@myidii/react";

declare global {
  interface Window { SESSION_URL: string }
}

function HookDemo() {
  const { start, result, running } = useLiveness({ onCancel: () => {} });
  const status: LivenessStatus | undefined = result?.status;
  return (
    <button type="button" id="hook" disabled={running} onClick={() => start(window.SESSION_URL)}>
      {status ?? "idle"}
    </button>
  );
}

function App() {
  const [status, setStatus] = useState("idle");
  const props: LivenessButtonProps = {
    getUrl: async () => window.SESSION_URL,
    onResult: (r: LivenessResult) => setStatus(`${r.status}:${r.sessionId}`),
    onError: (e: unknown) => setStatus(`error:${String(e)}`),
  };
  return (
    <main>
      <LivenessButton {...props} className="verify" mode="modal">Verify</LivenessButton>
      <output id="status">{status}</output>
      <HookDemo />
    </main>
  );
}

// @ts-expect-error getUrl is required
export const missingGetUrl = <LivenessButton />;
// @ts-expect-error onClick is owned by the button
export const ownClick = <LivenessButton getUrl={async () => ""} onClick={() => {}} />;

createRoot(document.getElementById("root")!).render(<App />);
