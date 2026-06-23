import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const dbFile = process.env.WCP_DB_FILE
  ? resolve(process.cwd(), process.env.WCP_DB_FILE)
  : resolve(packageRoot, "local.db");
const seedSql = readFileSync(resolve(packageRoot, "seed.sql"), "utf8");

execFileSync("sqlite3", [dbFile, seedSql], {
  cwd: packageRoot,
  stdio: "inherit"
});

console.log("Seed applied to", dbFile);
