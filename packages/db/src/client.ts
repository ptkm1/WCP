import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

export function resolveDbFile(): string {
  return process.env.WCP_DB_FILE
    ? resolve(process.cwd(), process.env.WCP_DB_FILE)
    : resolve(process.cwd(), "packages/db/local.db");
}

export function queryJson<T>(sql: string, dbFile = resolveDbFile()): T[] {
  const output = execFileSync("sqlite3", ["-json", dbFile, sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return JSON.parse(output || "[]") as T[];
}

export function execute(sql: string, dbFile = resolveDbFile()): void {
  execFileSync("sqlite3", [dbFile, sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}
