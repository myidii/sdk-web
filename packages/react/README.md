# @myidii/react

The MYIDII liveness scan for React: a hook and a ready-made button. Built on [`@myidii/web`](https://www.npmjs.com/package/@myidii/web).

```sh
npm install @myidii/react
```

Your server creates the session with [`@myidii/node`](https://www.npmjs.com/package/@myidii/node) and returns its
url. The result in the browser is a hint for your UI only: always confirm the verdict on your server.

## Button

```tsx
import { LivenessButton } from "@myidii/react";

<LivenessButton
  className="btn"
  getUrl={async () => (await fetch("/api/start-check", { method: "POST" }).then((r) => r.json())).url}
  onResult={(r) => r.status === "passed" && router.push("/next-step")}
>
  Verify it's me
</LivenessButton>
```

## Hook

```tsx
import { useLiveness } from "@myidii/react";

const { start, running, result } = useLiveness();
<button disabled={running} onClick={async () => start(await getUrlFromYourServer())}>Verify it's me</button>
```
