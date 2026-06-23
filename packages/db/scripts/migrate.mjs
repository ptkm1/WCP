import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const dbFile = process.env.WCP_DB_FILE
  ? resolve(process.cwd(), process.env.WCP_DB_FILE)
  : resolve(packageRoot, "local.db");
const migrationsDir = resolve(packageRoot, "drizzle");

if (!existsSync(migrationsDir)) {
  console.error("No migrations directory found:", migrationsDir);
  process.exit(1);
}

mkdirSync(dirname(dbFile), { recursive: true });

execSql(`
CREATE TABLE IF NOT EXISTS __wcp_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`);

const applied = new Set(
  execSql("SELECT id FROM __wcp_migrations;", { json: true }).map(
    (row) => row.id,
  ),
);

const migrationFiles = readdirSync(migrationsDir)
  .filter((entry) => entry.endsWith(".sql"))
  .sort();

for (const file of migrationFiles) {
  if (applied.has(file)) {
    continue;
  }

  const sql = readFileSync(resolve(migrationsDir, file), "utf8");
  execSql(`
BEGIN;
${sql}
INSERT INTO __wcp_migrations (id, applied_at) VALUES ('${escapeSql(file)}', datetime('now'));
COMMIT;
`);
  console.log(`Applied migration ${file}`);
}

function execSql(sql, options = { json: false }) {
  const baseArgs = ["-bail"];
  const args = options.json
    ? [...baseArgs, "-json", dbFile, sql]
    : [...baseArgs, dbFile, sql];
  const output = execFileSync("sqlite3", args, {
    cwd: packageRoot,
    encoding: "utf8",
  });
  return options.json ? JSON.parse(output || "[]") : output;
}

function escapeSql(value) {
  return value.replaceAll("'", "''");
}
