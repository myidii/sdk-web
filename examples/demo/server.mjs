// A tiny "customer app" that uses both SDKs, the way a real integration would:
// @myidii/node on the server creates sessions and verifies webhooks, @myidii/web in the page runs the scan.
//
//   MYIDII_SECRET_KEY=sk_test_... MYIDII_WEBHOOK_SECRET=whsec_... MYIDII_API_URL=http://localhost:4100 node server.mjs
//   open http://localhost:4800, and add http://localhost:4800/webhooks/myidii as a webhook endpoint in the dashboard.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Myidii } from "../../../sdk-server/node/dist/index.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const sdkDir = join(here, "../../packages/web/dist");
const port = Number(process.env.PORT || 4800);
const myidii = new Myidii(process.env.MYIDII_SECRET_KEY, { apiUrl: process.env.MYIDII_API_URL });
const received = [];

const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "content-type": type }); res.end(type === "application/json" ? JSON.stringify(body) : body); };
const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname === "/") return send(res, 200, await readFile(join(here, "index.html"), "utf8"), "text/html");
    if (req.method === "GET" && url.pathname.startsWith("/sdk/")) {
      const file = join(sdkDir, url.pathname.slice(5).replace(/\.\./g, ""));
      return send(res, 200, await readFile(file, "utf8"), extname(file) === ".js" ? "text/javascript" : "text/plain");
    }
    if (req.method === "POST" && url.pathname === "/api/start") {
      const { simulate } = JSON.parse((await readBody(req)).toString() || "{}");
      const session = await myidii.sessions.create({ reference: `demo_${Date.now() % 100000}`, ...(simulate ? { simulate } : {}) });
      return send(res, 200, { id: session.id, url: session.url });
    }
    if (req.method === "GET" && url.pathname === "/api/result") {
      // The verdict that counts: read on the server with the secret key.
      return send(res, 200, await myidii.sessions.retrieve(url.searchParams.get("id")));
    }
    if (req.method === "POST" && url.pathname === "/webhooks/myidii") {
      const raw = await readBody(req);
      try {
        const event = Myidii.webhooks.constructEvent(raw, req.headers["myidii-signature"], process.env.MYIDII_WEBHOOK_SECRET);
        received.unshift({ id: event.id, type: event.type, status: event.data?.status ?? null, at: new Date().toISOString() });
        console.log("webhook verified:", event.type, event.data?.status ?? "");
        return send(res, 200, { received: true });
      } catch (e) {
        console.log("webhook rejected:", e.message);
        return send(res, 400, { error: e.message });
      }
    }
    if (req.method === "GET" && url.pathname === "/api/webhooks") return send(res, 200, received);
    send(res, 404, { error: "not found" });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}).listen(port, () => console.log(`demo app on http://localhost:${port}`));
