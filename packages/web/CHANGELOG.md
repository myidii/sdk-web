# @myidii/web

## 0.2.1

### Patch Changes

- [`66cc686`](https://github.com/myidii/sdk-web/commit/66cc686ad4ed2d1a5224a552aafacb2070a94a46) Thanks [@Scottlexium](https://github.com/Scottlexium)! - `import "@myidii/web/browser"` in a bundled app now keeps the script tag build, so `window.MYIDII` is set. Bundlers dropped it before because the whole package was marked free of side effects.

- [`1c8265e`](https://github.com/myidii/sdk-web/commit/1c8265eb1505aea9883d68c6ec7d512778efe1bc) Thanks [@Scottlexium](https://github.com/Scottlexium)! - Clicking the close button while the overlay fades out after a finished scan no longer calls `onCancel`.

## 0.2.0

### Minor Changes

- A script-tag build for sites without a bundler: load `https://cdn.jsdelivr.net/npm/@myidii/web@0/dist/myidii.min.js` and call `MYIDII.startLiveness({ url })`. The package now ships both ES modules and CommonJS.

- React support moves to its own package, `@myidii/react`, with `useLiveness` and a ready-made `LivenessButton`. `@myidii/web/react` is gone: install `@myidii/react` instead.
