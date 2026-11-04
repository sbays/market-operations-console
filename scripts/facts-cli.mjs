// Runs scripts/facts.ts through Vite's module runner, which resolves the "@/" paths and the
// JSON imports the way the tests do, so the project needs no separate TypeScript runner.
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const local = (path) => fileURLToPath(new URL(path, import.meta.url));

const { module } = await runnerImport(local("./facts.ts"), {
  configFile: false,
  logLevel: "silent",
  resolve: {
    tsconfigPaths: true,
    // data/pack.ts guards against client bundles; this script is server code.
    alias: { "server-only": local("../node_modules/server-only/empty.js") },
  },
});

const result = module.run(process.argv.slice(2));
if (result.ok) {
  console.log(result.text);
} else {
  console.error(result.error);
  process.exitCode = 1;
}
