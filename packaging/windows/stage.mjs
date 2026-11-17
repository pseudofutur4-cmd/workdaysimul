import {
  copyFileSync,
  cpSync,
  realpathSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";

const destination = process.argv[2];
if (!destination) throw new Error("A staging directory is required.");
const build = ".next-installer";
const standalone = realpathSync(join(build, "standalone"));
function copyTree(source, target, omitModules = false) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (omitModules && entry.name === "node_modules") continue;
    if (
      entry.name.startsWith(".env") ||
      /\.(?:db|db-wal|db-shm|pdf)$/i.test(entry.name)
    )
      continue;
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isSymbolicLink())
      throw new Error("Unexpected link inside traced files: " + from);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) copyFileSync(from, to);
  }
}
copyTree(standalone, destination, true);

// The trace contains absolute pnpm junctions on Windows. Place the traced
// packages in one relocatable node_modules, with a single React instance.
const tracedStore = join(standalone, "node_modules", ".pnpm");
const installed = new Set();
for (const entry of readdirSync(tracedStore, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === "node_modules") continue;
  const name = entry.name
    .slice(0, entry.name.indexOf("@", 1))
    .replace("+", "/");
  const storePath = join(entry.name, "node_modules");
  const target = join(destination, "node_modules", name);
  if (installed.has(name))
    throw new Error("Conflicting traced versions of " + name);
  installed.add(name);
  copyTree(join(tracedStore, storePath, name), target);
  const original = join("node_modules", ".pnpm", storePath, name);
  for (const file of readdirSync(original, { withFileTypes: true })) {
    if (file.isFile() && /^(license|notice|copying)(\.|$)/i.test(file.name))
      copyFileSync(join(original, file.name), join(target, file.name));
  }
  const generatedPrisma = join(tracedStore, storePath, ".prisma", "client");
  if (name === "@prisma/client" && existsSync(generatedPrisma))
    copyTree(
      generatedPrisma,
      join(destination, "node_modules", ".prisma", "client"),
    );
}
cpSync(join(build, "static"), join(destination, build, "static"), {
  recursive: true,
});
if (existsSync("public"))
  cpSync("public", join(destination, "public"), { recursive: true });
copyFileSync("prisma/installer-template.db", join(destination, "seed.db"));
