import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";
// Prisma's Windows schema engine needs an existing SQLite file in this environment.
const db = new PrismaClient();
await db.$queryRawUnsafe("SELECT 1");
await db.$disconnect();
const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
