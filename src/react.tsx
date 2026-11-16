import { useCallback, useState } from "react";
import { startLiveness, type LivenessResult, type StartOptions } from "./index.js";

/** React hook around startLiveness. Fetch the session url from your server, then call start(url). */
export function useLiveness(options: Omit<StartOptions, "url"> = {}) {
  const [result, setResult] = useState<LivenessResult | null>(null);
  const [running, setRunning] = useState(false);
  const start = useCallback(async (url: string) => {
    setRunning(true);
    try {
      const r = await startLiveness({ ...options, url });
      setResult(r);
      return r;
    } finally {
      setRunning(false);
    }
  }, [options]);
  return { start, result, running };
}

export { startLiveness } from "./index.js";
export type { LivenessResult, LivenessStatus, StartOptions } from "./index.js";
