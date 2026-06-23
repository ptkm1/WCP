import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const configHome = resolve(packageRoot, ".drizzle-home");
const action = process.argv.slice(2);
const drizzleBin = resolve(packageRoot, "node_modules/.bin/drizzle-kit");

const result = spawnSync(drizzleBin, action, {
  cwd: packageRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    HOME: configHome,
    XDG_CONFIG_HOME: configHome
  }
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
