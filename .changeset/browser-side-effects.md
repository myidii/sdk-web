---
"@myidii/web": patch
---

`import "@myidii/web/browser"` in a bundled app now keeps the script tag build, so `window.MYIDII` is set. Bundlers dropped it before because the whole package was marked free of side effects.
