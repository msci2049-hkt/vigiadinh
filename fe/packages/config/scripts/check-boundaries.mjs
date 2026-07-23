/**
 * Enforce module boundaries inside ONE app (run with cwd = the app root):
 *   - a feature MUST NOT import another feature (compose at the app/ layer)
 *   - a feature MUST NOT import the app/ layer (dependency points one way)
 *
 * Shared across apps from @repo/config (plain .mjs — no tsx/ts-node needed).
 * Runs in each app's `validate`. Exits non-zero (with a report) on violations.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = process.cwd();
const FEATURES_DIR = join(ROOT, "src", "features");
const APP_DIR = join(ROOT, "src", "app");

function listSourceFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // features dir may not exist yet
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// matches: import ... from "x" | export ... from "x" | import("x") | import "x"
const IMPORT_RE =
  /(?:import|export)[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;

function featureOf(file) {
  const rel = relative(FEATURES_DIR, file);
  if (rel.startsWith("..")) return null;
  return rel.split(sep)[0] ?? null;
}

function checkFile(file, current) {
  const source = readFileSync(file, "utf8");
  const violations = [];

  for (const match of source.matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2] ?? match[3];
    if (!spec) continue;

    const aliasFeature = spec.match(/^@\/features\/([^/]+)/)?.[1];
    if (aliasFeature && aliasFeature !== current) {
      violations.push({
        file,
        importPath: spec,
        reason: `cross-feature import ("${current}" → "${aliasFeature}")`,
      });
      continue;
    }

    if (/^@\/app(\/|$)/.test(spec)) {
      violations.push({
        file,
        importPath: spec,
        reason: `feature "${current}" imports the app/ layer (compose features in app/, not the reverse)`,
      });
      continue;
    }

    // Relative specifiers: resolve to an absolute path and check containment.
    if (spec.startsWith(".")) {
      const resolved = resolve(dirname(file), spec);

      const fromFeatures = relative(FEATURES_DIR, resolved);
      if (!fromFeatures.startsWith("..")) {
        const target = fromFeatures.split(sep)[0];
        if (target && target !== current) {
          violations.push({
            file,
            importPath: spec,
            reason: `cross-feature import via relative path ("${current}" → "${target}")`,
          });
        }
        continue;
      }

      const fromApp = relative(APP_DIR, resolved);
      if (!fromApp.startsWith("..")) {
        violations.push({
          file,
          importPath: spec,
          reason: `feature "${current}" imports the app/ layer via relative path`,
        });
      }
    }
  }

  return violations;
}

function main() {
  const violations = [];
  for (const file of listSourceFiles(FEATURES_DIR)) {
    const feature = featureOf(file);
    if (feature) violations.push(...checkFile(file, feature));
  }

  if (violations.length > 0) {
    console.error(`\n❌ Module boundary violations (${violations.length}):\n`);
    for (const v of violations) {
      console.error(`  ${relative(ROOT, v.file)}`);
      console.error(`    → ${v.importPath}`);
      console.error(`    ${v.reason}\n`);
    }
    console.error("Features must be self-contained. Compose them in the app/ layer.\n");
    process.exit(1);
  }

  console.log("✅ Module boundaries OK — no cross-feature imports.");
}

main();
