// Imports the installed package the way a Node or SSR app would, and prints what it found.
import * as web from "@myidii/web";
import webDefault from "@myidii/web";
import webPkg from "@myidii/web/package.json" with { type: "json" };
import * as react from "@myidii/react";

const rejected = await web.startLiveness({ url: "https://verify.myidii.test/s/1" }).then(() => null, (e) => e.message);

console.log(JSON.stringify({
  resolved: import.meta.resolve("@myidii/web"),
  browser: import.meta.resolve("@myidii/web/browser"),
  reactResolved: import.meta.resolve("@myidii/react"),
  version: webPkg.version,
  exports: Object.keys(web).sort(),
  startLiveness: typeof web.startLiveness,
  defaultIsMyidii: webDefault === web.Myidii && webDefault.startLiveness === web.startLiveness,
  rejected,
  reactExports: Object.keys(react).sort(),
}));
