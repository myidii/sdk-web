import { useCallback, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { startLiveness, type LivenessResult, type StartOptions } from "@myidii/web";

export type { LivenessResult, LivenessStatus, StartOptions } from "@myidii/web";

/**
 * Runs the MYIDII liveness scan. Get the session url from your server, then call start(url).
 * The result is a hint for your UI only: always confirm the verdict on your server.
 */
export function useLiveness(options: Omit<StartOptions, "url"> = {}) {
  const [result, setResult] = useState<LivenessResult | null>(null);
  const [running, setRunning] = useState(false);
  // Read the latest options without restarting the callback on every render.
  const opts = useRef(options);
  opts.current = options;

  const start = useCallback(async (url: string) => {
    setRunning(true);
    try {
      const r = await startLiveness({ ...opts.current, url });
      setResult(r);
      return r;
    } finally {
      setRunning(false);
    }
  }, []);

  return { start, result, running };
}

export type LivenessButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children"> & {
  /** Fetches a session url from your server, which creates the session with your secret key. */
  getUrl: () => Promise<string>;
  /** Called when the scan finishes or is closed. Confirm the verdict on your server. */
  onResult?: (result: LivenessResult) => void;
  /** Called if getUrl or the scan throws. */
  onError?: (error: unknown) => void;
  mode?: StartOptions["mode"];
  children?: ReactNode;
};

/** A button that starts the scan. Bring your own styles through className. */
export function LivenessButton({ getUrl, onResult, onError, mode, children = "Verify it's me", disabled, ...rest }: LivenessButtonProps) {
  const { start, running } = useLiveness({ mode });
  const run = async () => {
    try {
      const r = await start(await getUrl());
      onResult?.(r);
    } catch (e) {
      onError?.(e);
    }
  };
  return (
    <button type="button" {...rest} disabled={disabled || running} aria-busy={running} onClick={run}>
      {children}
    </button>
  );
}
