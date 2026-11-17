// An ESM TypeScript consumer of @myidii/web. Typechecked, never run.
import { Myidii, startLiveness, type LivenessResult, type LivenessStatus, type StartOptions } from "@myidii/web";
import MyidiiDefault from "@myidii/web";

const options: StartOptions = { url: "https://verify.myidii.test/s/1", mode: "modal", onCancel: () => {} };
const pending: Promise<LivenessResult> = startLiveness(options);
pending.then((r) => {
  const status: LivenessStatus = r.status;
  const id: string | null = r.sessionId;
  return [status, id];
});
MyidiiDefault.startLiveness({ url: "https://verify.myidii.test/s/1", mode: "redirect" });
Myidii.startLiveness({ url: "https://verify.myidii.test/s/1" });

// The types must be real, not `any`.
// @ts-expect-error url is required
startLiveness({});
// @ts-expect-error there is no popup mode
startLiveness({ url: "https://verify.myidii.test/s/1", mode: "popup" });
// @ts-expect-error not a status
const notAStatus: LivenessStatus = "ok";
// @ts-expect-error sessionId may be null
const notNull: string = ({} as LivenessResult).sessionId;

export { notAStatus, notNull };
