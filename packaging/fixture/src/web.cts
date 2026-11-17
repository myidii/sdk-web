// A CommonJS TypeScript consumer of @myidii/web (resolves the "require" condition). Typechecked, never run.
import { startLiveness, type LivenessResult, type StartOptions } from "@myidii/web";

const options: StartOptions = { url: "https://verify.myidii.test/s/1" };
const pending: Promise<LivenessResult> = startLiveness(options);
// @ts-expect-error url is required
startLiveness({});

export = pending;
