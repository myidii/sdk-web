// happy-dom prints an error for every iframe it refuses to load. Refusing is what we want (no network in unit
// tests), so drop that one message and let everything else through. happy-dom writes to Node's own console,
// not the one Vitest captures, hence the patch on node:console.
import nodeConsole from "node:console";

const quiet = (a: unknown) => String((a as Error)?.message ?? a).includes("Iframe page loading is disabled");
const error = nodeConsole.error.bind(nodeConsole);
nodeConsole.error = (...args: unknown[]) => {
  if (args.some(quiet)) return;
  error(...args);
};
