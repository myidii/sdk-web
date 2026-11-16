# @myidii/web

## 0.2.0

### Minor Changes

- A script-tag build for sites without a bundler: load `https://cdn.jsdelivr.net/npm/@myidii/web@0/dist/myidii.min.js` and call `MYIDII.startLiveness({ url })`. The package now ships both ES modules and CommonJS.

- React support moves to its own package, `@myidii/react`, with `useLiveness` and a ready-made `LivenessButton`. `@myidii/web/react` is gone: install `@myidii/react` instead.
