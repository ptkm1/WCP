declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
};

declare module "node:child_process" {
  export interface ExecFileSyncOptions {
    cwd?: string;
    encoding?: string;
    stdio?: Array<"ignore" | "pipe">;
  }

  export function execFileSync(
    file: string,
    args?: string[],
    options?: ExecFileSyncOptions
  ): string;
}

declare module "node:path" {
  export function resolve(...paths: string[]): string;
}
