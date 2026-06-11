import { spawnSync } from "node:child_process";
import { evaluateGate } from "../kernel/policy/evaluate-gate.js";
import { validateGraphIntegrity } from "../kernel/graph/evidence-graph.js";
import { validateDocument } from "../kernel/validation/schema-registry.js";
import { runLifecycleLoopGateEvaluation } from "../lifecycle-loop/final-evaluation.js";
import { buildPackageStatus } from "../loop/status-report.js";
import {
  loadPackageContext,
  loadPoliciesForProfile,
  loadProfile,
  resolveLoopRoot,
} from "../loop/package-store.js";
import type { PackageVerifyResult, VerifyIssue, VerifyMode, VerifyReport } from "./types.js";
import { discoverPackageIdsFromPaths } from "./discover-packages.js";

export interface VerifyPackageOptions {
  packageId: string;
  baseDir?: string;
  evaluationTime?: string;
  runRepositoryTests?: boolean;
}

export interface VerifyChangedOptions {
  baseDir?: string;
  mode?: VerifyMode;
  packageIds?: string[];
  changedPaths?: string[];
  runRepositoryTests?: boolean;
}

function issue(ruleId: string, message: string, blocking = true): VerifyIssue {
  return { ruleId, message, blocking };
}

export async function verifyPackage(options: VerifyPackageOptions): Promise<PackageVerifyResult> {
  const loopRootPath = resolveLoopRoot(options.baseDir);
  const context = await loadPackageContext(loopRootPath, options.packageId);
  const rootBundle = context.bundles.find((bundle) => bundle.package.metadata.id === options.packageId);
  if (!rootBundle) {
    return {
      packageId: options.packageId,
      passed: false,
      issues: [issue("missing-package", `package ${options.packageId} not found`)],
    };
  }

  const issues: VerifyIssue[] = [];
  const evaluationTime = options.evaluationTime ?? new Date().toISOString();

  for (const document of context.documents) {
    const result = validateDocument(document);
    if (!result.valid) {
      for (const item of result.issues) {
        issues.push(issue(
          "schema-conformance",
          `${document.kind}:${document.metadata.id} ${item.path}: ${item.message}`,
        ));
      }
    }
  }

  for (const graphIssue of validateGraphIntegrity(context.documents)) {
    issues.push(issue("graph-integrity", `${graphIssue.documentKey}: ${graphIssue.message}`));
  }

  const profile = await loadProfile(loopRootPath, rootBundle.package.spec.profileId);
  const policies = await loadPoliciesForProfile(loopRootPath, profile);
  const status = buildPackageStatus(context, rootBundle.package, profile);

  for (const phaseStatus of status.phases) {
    if (!phaseStatus.required) continue;

    if (!phaseStatus.latestGate) {
      issues.push(issue("required-gate", `required phase ${phaseStatus.phase} has no gate attempt`));
      continue;
    }

    const gateResult = phaseStatus.gateResult;
    if (gateResult !== "pass" && gateResult !== "waived") {
      issues.push(issue(
        "gate-result",
        `phase ${phaseStatus.phase} gate result is ${gateResult ?? "unknown"}`,
      ));
    }

    if (phaseStatus.freshness === "stale") {
      issues.push(issue(
        "gate-freshness",
        `phase ${phaseStatus.phase} gate is stale; re-run loop gate ${phaseStatus.phase}`,
      ));
    }

    if (phaseStatus.openBlockingFindings > 0) {
      issues.push(issue(
        "open-blocking-findings",
        `phase ${phaseStatus.phase} has ${phaseStatus.openBlockingFindings} open blocking finding(s)`,
      ));
    }

    const policyEval = evaluateGate({
      package: rootBundle.package,
      phase: phaseStatus.phase,
      evaluationTime,
      profile,
      policies,
      documents: context.documents,
    });
    if (policyEval.result !== "pass") {
      issues.push(issue(
        "policy-evaluation",
        `phase ${phaseStatus.phase} policy evaluation is ${policyEval.result}`,
      ));
    }

    const lifecycleEval = runLifecycleLoopGateEvaluation({
      package: rootBundle.package,
      phase: phaseStatus.phase,
      evaluationTime,
      profile,
      policies,
      documents: context.documents,
    });
    if (lifecycleEval.result !== "pass" && lifecycleEval.result !== "waived") {
      issues.push(issue(
        "lifecycle-evaluation",
        `phase ${phaseStatus.phase} lifecycle evaluation is ${lifecycleEval.result}`,
      ));
    }
  }

  if (options.runRepositoryTests) {
    const test = spawnSync("npm", ["test"], {
      cwd: options.baseDir ?? process.cwd(),
      encoding: "utf8",
    });
    if (test.status !== 0) {
      issues.push(issue(
        "repository-tests",
        `npm test failed (exit ${test.status ?? "unknown"})`,
      ));
    }
  }

  const blocking = issues.filter((item) => item.blocking);
  return {
    packageId: options.packageId,
    passed: blocking.length === 0,
    issues,
  };
}

export function formatVerifyResult(result: PackageVerifyResult): string {
  if (result.passed) {
    return `Package ${result.packageId}: verify passed`;
  }
  const lines = [`Package ${result.packageId}: verify failed`];
  for (const item of result.issues) {
    lines.push(`  - [${item.ruleId}] ${item.message}`);
  }
  return lines.join("\n");
}

export function formatVerifyReport(report: VerifyReport): string {
  const lines = [`Loop verify mode=${report.mode} passed=${report.passed}`];
  for (const result of report.results) {
    lines.push(formatVerifyResult(result));
  }
  return lines.join("\n");
}

export async function verifyChangedPackages(options: VerifyChangedOptions): Promise<VerifyReport> {
  const mode = options.mode ?? "enforce";
  const baseDir = options.baseDir ?? process.cwd();
  let packageIds = options.packageIds ?? [];

  if (packageIds.length === 0 && options.changedPaths) {
    packageIds = discoverPackageIdsFromPaths(options.changedPaths);
  }

  if (packageIds.length === 0) {
    return { mode, results: [], passed: true };
  }

  const results: PackageVerifyResult[] = [];
  for (const packageId of packageIds) {
    results.push(await verifyPackage({
      packageId,
      baseDir,
      ...(options.runRepositoryTests ? { runRepositoryTests: true } : {}),
    }));
  }

  const passed = results.every((result) => result.passed);
  return {
    mode,
    results,
    passed: mode === "report-only" ? true : passed,
  };
}
