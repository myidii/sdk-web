// A CommonJS TypeScript consumer of @myidii/react. Typechecked, never run.
import { createElement } from "react";
import { LivenessButton, useLiveness, type LivenessButtonProps } from "@myidii/react";

const props: LivenessButtonProps = { getUrl: async () => "https://verify.myidii.test/s/1" };
export = { button: createElement(LivenessButton, props), useLiveness };
