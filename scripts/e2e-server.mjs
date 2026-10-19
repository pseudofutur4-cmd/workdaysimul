import { spawnSync, spawn } from "node:child_process";
const env = {
  ...process.env,
  DATABASE_URL: "file:./e2e.db",
  NEXT_DIST_DIR: ".next-e2e",
};
for (const args of [
  ["scripts/migrate.mjs"],
  ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"],
]) {
  const r = spawnSync(process.execPath, args, { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3001",
  ],
  { stdio: "inherit", env },
);
process.on("SIGTERM", () => child.kill());
child.on("exit", (code) => process.exit(code ?? 0));
