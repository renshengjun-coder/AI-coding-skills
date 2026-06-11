import { spawnSync } from "node:child_process";
import { listPackageIds } from "../../loop/package-store.js";
import { resolveLoopRoot } from "../../loop/package-store.js";
import { discoverPackageIdsFromPaths } from "../../ci/discover-packages.js";
import { formatVerifyReport, verifyChangedPackages } from "../../ci/verify-package.js";
import type { VerifyMode } from "../../ci/types.js";
import { failure, success, type CommandResult } from "../types.js";

export interface VerifyChangedCommandOptions {
  baseDir?: string;
  mode?: VerifyMode;
  packageIds?: string[];
  allPackages?: boolean;
  fromGitDiff?: boolean;
  gitBase?: string;
  runRepositoryTests?: boolean;
}

function gitChangedPaths(baseDir: string, gitBase?: string): string[] {
  const base = gitBase ?? "HEAD~1";
  const result = spawnSync("git", ["diff", "--name-only", base, "HEAD"], {
    cwd: baseDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git diff failed with exit ${result.status}`);
  }
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function runVerifyChanged(options: VerifyChangedCommandOptions): Promise<CommandResult> {
  const baseDir = options.baseDir ?? process.cwd();
  let packageIds = options.packageIds ?? [];

  if (options.allPackages) {
    packageIds = await listPackageIds(resolveLoopRoot(baseDir));
  } else if (options.fromGitDiff) {
    const paths = gitChangedPaths(baseDir, options.gitBase);
    packageIds = discoverPackageIdsFromPaths(paths);
  }

  const report = await verifyChangedPackages({
    baseDir,
    mode: options.mode ?? "enforce",
    packageIds,
    ...(options.runRepositoryTests ? { runRepositoryTests: true } : {}),
  });

  if (report.results.length === 0) {
    return success("No loop change packages to verify");
  }

  const output = formatVerifyReport(report);
  if (report.mode === "enforce" && !report.passed) {
    return failure(output);
  }
  return success(output);
}

export function parseVerifyMode(value: string | undefined): VerifyMode | null {
  if (value === "enforce" || value === "report-only") return value;
  return null;
}
