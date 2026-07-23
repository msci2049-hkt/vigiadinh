/**
 * Static guard: HOST-LOADED config files must never import raw .ts across
 * package boundaries.
 *
 * "Host-loaded" = Node (or a config loader) imports the file directly:
 * vite.config.*, vitest.config.*, playwright.config.*, postcss/tailwind
 * configs, and everything in packages/config. If such a file resolves an
 * import into another workspace package and the target is a .ts/.tsx file,
 * the repo only works on runtimes that strip types (Bun, Node ≥ 23.6) and
 * dies elsewhere (Cloudflare CI, Node 20/22) with ERR_UNKNOWN_FILE_EXTENSION.
 *
 * This guard fails fast and RUNTIME-INDEPENDENTLY — do not rely on a modern
 * local Node hiding the bug. Runs in `pnpm validate` and CI.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const CONFIG_FILE_RE = /^(vite|vitest|playwright|postcss|tailwind)\.config\.(ts|mts|cts|js|mjs)$/;
const IMPORT_RE =
  /(?:import|export)[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;

/** Workspace packages: name → absolute dir + parsed package.json. */
function loadWorkspacePackages() {
  const map = new Map();
  for (const group of ["apps", "packages"]) {
    const groupDir = join(ROOT, group);
    if (!existsSync(groupDir)) continue;
    for (const entry of readdirSync(groupDir)) {
      const pkgJsonPath = join(groupDir, entry, "package.json");
      if (!existsSync(pkgJsonPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
      map.set(pkg.name, { dir: join(groupDir, entry), pkg });
    }
  }
  return map;
}

/** Resolve an exports-map subpath ("." | "./vite" | …) to a relative target. */
function resolveExport(pkg, subpath) {
  const exp = pkg.exports;
  if (!exp) return null;
  if (typeof exp === "string") return subpath === "." ? exp : null;
  const entry = exp[subpath];
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    return entry.import ?? entry.default ?? null;
  }
  // Wildcard patterns: "./tsconfig/*": "./tsconfig/*.json"
  for (const [key, value] of Object.entries(exp)) {
    if (!key.includes("*") || typeof value !== "string") continue;
    const [prefix, suffix] = key.split("*");
    if (subpath.startsWith(prefix) && subpath.endsWith(suffix)) {
      const wildcard = subpath.slice(prefix.length, subpath.length - suffix.length);
      return value.replace("*", wildcard);
    }
  }
  return null;
}

/** Collect host-loaded files: every *.config.* in apps/* roots + all packages/config sources. */
function collectHostLoadedFiles() {
  const files = [];
  for (const group of ["apps", "packages"]) {
    const groupDir = join(ROOT, group);
    if (!existsSync(groupDir)) continue;
    for (const entry of readdirSync(groupDir)) {
      const pkgDir = join(groupDir, entry);
      if (!statSync(pkgDir).isDirectory()) continue;
      for (const f of readdirSync(pkgDir)) {
        if (CONFIG_FILE_RE.test(f)) files.push(join(pkgDir, f));
      }
    }
  }
  const sharedConfig = join(ROOT, "packages", "config");
  if (existsSync(sharedConfig)) {
    for (const f of readdirSync(sharedConfig)) {
      if (f.endsWith(".mjs") || f.endsWith(".js")) files.push(join(sharedConfig, f));
    }
  }
  return files;
}

function main() {
  const packages = loadWorkspacePackages();
  const violations = [];

  for (const file of collectHostLoadedFiles()) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT_RE)) {
      const spec = match[1] ?? match[2] ?? match[3];
      if (!spec) continue;

      let targetAbs = null;

      // Cross-package import via workspace name (@repo/config/vite, …)
      const named = [...packages.keys()].find((n) => spec === n || spec.startsWith(`${n}/`));
      if (named) {
        const { dir, pkg } = packages.get(named);
        const subpath = spec === named ? "." : `./${spec.slice(named.length + 1)}`;
        const rel = resolveExport(pkg, subpath) ?? subpath;
        targetAbs = resolve(dir, rel);
      } else if (spec.startsWith(".")) {
        // Relative import that escapes into another workspace package
        const resolved = resolve(dirname(file), spec);
        const relFromRoot = relative(ROOT, resolved);
        const inWorkspace = /^(apps|packages)[\\/]/.test(relFromRoot);
        const sameDirTree = !relative(dirname(file), resolved).startsWith("..");
        if (inWorkspace && !sameDirTree) targetAbs = resolved;
      }

      if (!targetAbs) continue;

      // Resolve extensionless targets the way Node would try
      const candidates = [targetAbs, `${targetAbs}.ts`, `${targetAbs}.tsx`];
      const tsHit = candidates.find((c) => /\.(ts|tsx)$/.test(c) && existsSync(c));
      if (/\.(ts|tsx)$/.test(targetAbs) || tsHit) {
        violations.push({
          file: relative(ROOT, file),
          spec,
          target: relative(ROOT, tsHit ?? targetAbs),
        });
      }
    }
  }

  if (violations.length > 0) {
    console.error(
      `\n❌ Host-loaded files importing raw .ts across packages (${violations.length}):\n`,
    );
    for (const v of violations) {
      console.error(`  ${v.file}`);
      console.error(`    → "${v.spec}" resolves to ${v.target}`);
      console.error(
        "    Host-loaded configs must import .mjs/.json from other packages (ERR_UNKNOWN_FILE_EXTENSION on Cloudflare/Node<23.6).\n",
      );
    }
    process.exit(1);
  }

  console.log("✅ Host-loaded config imports OK — no cross-package .ts.");
}

main();
