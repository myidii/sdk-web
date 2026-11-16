# @myidii/web

Run the MYIDII liveness scan in any website. Works with a bundler or a plain `<script>` tag.

Your server creates the session with [`@myidii/node`](https://www.npmjs.com/package/@myidii/node) and passes
`session.url` to the browser. The SDK opens the scan, then tells your page how it went. It never holds a secret
key and never decides the result: always confirm the verdict on your server.

## With a bundler

```sh
npm install @myidii/web
```

```ts
import { startLiveness } from "@myidii/web";

const { url } = await fetch("/api/start-check", { method: "POST" }).then((r) => r.json());
const result = await startLiveness({ url });
// result.status: "passed", "failed", "expired" or "cancelled". A hint for your UI only.
```

## With a script tag

```html
<script src="https://cdn.jsdelivr.net/npm/@myidii/web@0/dist/myidii.min.js"></script>
<script>
  async function verify() {
    const { url } = await fetch("/api/start-check", { method: "POST" }).then((r) => r.json());
    const result = await MYIDII.startLiveness({ url });
  }
</script>
```

Pin an exact version in production, for example `@myidii/web@0.2.0`.

## Options

| Option | |
| --- | --- |
| `url` | The session url your server got from `POST /v1/sessions`. Required |
| `mode` | `"modal"` (default) opens the scan over your page. `"redirect"` sends the browser to it, and it comes back to your `return_url` |
| `onCancel` | Called when the person closes the scan before finishing |

Using React? See [`@myidii/react`](https://www.npmjs.com/package/@myidii/react).
