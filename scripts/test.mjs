import { spawnSync } from "node:child_process";
const env = { ...process.env, DATABASE_URL: "file:./test.db" };
for (const args of [
  ["scripts/migrate.mjs"],
  ["node_modules/vitest/vitest.mjs", "run"],
]) {
  const r = spawnSync(process.execPath, args, { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
