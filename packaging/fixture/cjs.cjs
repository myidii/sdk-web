// Requires the installed package the way an older Node or Jest setup would, and prints what it found.
const web = require("@myidii/web");
const react = require("@myidii/react");

web.startLiveness({ url: "https://verify.myidii.test/s/1" }).then(
  () => print(null),
  (e) => print(e.message),
);

function print(rejected) {
  console.log(JSON.stringify({
    resolved: require.resolve("@myidii/web"),
    browser: require.resolve("@myidii/web/browser"),
    reactResolved: require.resolve("@myidii/react"),
    version: require("@myidii/web/package.json").version,
    exports: Object.keys(web).sort(),
    startLiveness: typeof web.startLiveness,
    defaultIsMyidii: web.default === web.Myidii && web.Myidii.startLiveness === web.startLiveness,
    rejected,
    reactExports: Object.keys(react).sort(),
    useLiveness: typeof react.useLiveness,
    LivenessButton: typeof react.LivenessButton,
  }));
}
