// The script-tag build: exposes window.MYIDII for sites without a bundler.
//   <script src="https://cdn.jsdelivr.net/npm/@myidii/web@0/dist/myidii.min.js"></script>
//   <script>MYIDII.startLiveness({ url }).then((r) => console.log(r.status))</script>
import { startLiveness } from "./index";

const api = { startLiveness, version: __VERSION__ };
(globalThis as unknown as { MYIDII: typeof api }).MYIDII = api;
