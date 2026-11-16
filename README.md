# @myidii/web

Run the MYIDII liveness scan in your website or web app.

```sh
npm install @myidii/web
```

Your server creates the session with `@myidii/node` and passes `session.url` to the browser:

```ts
import { Myidii } from "@myidii/web";

const { url } = await fetch("/api/start-check", { method: "POST" }).then((r) => r.json());
const result = await Myidii.startLiveness({ url });
// result.status is "passed", "failed", "expired" or "cancelled".
// It's a hint for your UI only. Confirm the verdict on your server.
```

React:

```tsx
import { useLiveness } from "@myidii/web/react";

const { start, running } = useLiveness();
<button disabled={running} onClick={async () => start(await getUrlFromYourServer())}>Verify it's you</button>
```

Options: `mode: "redirect"` sends the browser to the scan instead of opening it over your page (it comes back to your `return_url`).

The SDK never holds a secret key and never decides the result.
