import { parseArgs } from "node:util";
import type { Phase } from "../kernel/contracts/vocabulary.js";
import { PHASES } from "../kernel/contracts/vocabulary.js";
import { runAudit } from "./commands/audit.js";
import { runClassify } from "./commands/classify.js";
import { runCheck } from "./commands/check.js";
import { runApprove } from "./commands/approve.js";
import { runGate } from "./commands/gate.js";
import { runLinkPackage } from "./commands/link.js";
import { runOrchestrate, validateOrchestratePhase } from "./commands/orchestrate.js";
import { runPhaseSkill } from "./commands/run.js";
import { runWaive } from "./commands/waive.js";
import { StubRuntimeExecutor } from "../skills/runtime/stub-executor.js";
import { isSupportedRuntimeId } from "../adapters/registry.js";
import { parseProfileTier, parseWorkItemType, runStart, validateStartOptions } from "./commands/start.js";
import { runReleasePrepare } from "./commands/release.js";
import { runStatus } from "./commands/status.js";
import { parseVerifyMode, runVerifyChanged } from "./commands/verify-changed.js";
import { failure } from "./types.js";

function parsePhase(value: string): Phase | null {
  return PHASES.includes(value as Phase) ? value as Phase : null;
}

export async function runCli(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (!command) {
    console.error("Usage: loop <command> [options]");
    return 1;
  }

  try {
    switch (command) {
      case "start": {
        const { values } = parseArgs({
          args: rest,
          options: {
            type: { type: "string" },
            title: { type: "string" },
            owner: { type: "string" },
            profile: { type: "string" },
            id: { type: "string" },
          },
          allowPositionals: false,
        });
        const type = parseWorkItemType(values.type ?? "");
        const profileId = parseProfileTier(values.profile ?? "");
        const invalid = validateStartOptions({
          ...(type ? { type } : {}),
          title: values.title ?? "",
          owner: values.owner ?? "",
          ...(profileId ? { profileId } : {}),
        });
        if (invalid) {
          console.error(invalid.output);
          return invalid.code;
        }
        const result = await runStart({
          type: type!,
          title: values.title ?? "",
          owner: values.owner ?? "",
          profileId: profileId!,
          ...(values.id ? { packageId: values.id } : {}),
        });
        console.log(result.output);
        return result.code;
      }
      case "classify": {
        const [packageId, ...classifyRest] = rest;
        if (!packageId) {
          console.error("Usage: loop classify <package-id> --tier <routine|standard|high-risk> [--override-actor <actor> --override-reason <reason>]");
          return 1;
        }
        const { values } = parseArgs({
          args: classifyRest,
          options: {
            tier: { type: "string" },
            "override-actor": { type: "string" },
            "override-reason": { type: "string" },
          },
          allowPositionals: false,
        });
        const tier = parseProfileTier(values.tier ?? "");
        if (!tier) {
          console.error("loop classify requires --tier routine|standard|high-risk");
          return 1;
        }
        const result = await runClassify({
          packageId,
          selectedTier: tier,
          ...(values["override-actor"] && values["override-reason"]
            ? { overrideActor: values["override-actor"], overrideReason: values["override-reason"] }
            : {}),
        });
        console.log(result.output);
        return result.code;
      }
      case "check": {
        const [packageId] = rest;
        if (!packageId) {
          console.error("Usage: loop check <package-id>");
          return 1;
        }
        const result = await runCheck({ packageId });
        console.log(result.output);
        return result.code;
      }
      case "gate": {
        const [packageId, phaseValue, ...gateRest] = rest;
        if (!packageId || !phaseValue) {
          console.error("Usage: loop gate <package-id> <phase>");
          return 1;
        }
        const phase = parsePhase(phaseValue);
        if (!phase) {
          console.error(`invalid phase: ${phaseValue}`);
          return 1;
        }
        const { values } = parseArgs({
          args: gateRest,
          options: { "evaluation-time": { type: "string" } },
          allowPositionals: false,
        });
        const result = await runGate({
          packageId,
          phase,
          ...(values["evaluation-time"] ? { evaluationTime: values["evaluation-time"] } : {}),
        });
        console.log(result.output);
        return result.code;
      }
      case "status": {
        const [packageId] = rest;
        if (!packageId) {
          console.error("Usage: loop status <package-id>");
          return 1;
        }
        const result = await runStatus({ packageId });
        console.log(result.output);
        return result.code;
      }
      case "audit": {
        const [packageId] = rest;
        if (!packageId) {
          console.error("Usage: loop audit <package-id>");
          return 1;
        }
        const result = await runAudit({ packageId });
        console.log(result.output);
        return result.code;
      }
      case "link": {
        const [subcommand, ...linkRest] = rest;
        if (subcommand !== "package") {
          console.error("Usage: loop link package --from <id> --to <id> --relation <relation>");
          return 1;
        }
        const { values } = parseArgs({
          args: linkRest,
          options: {
            from: { type: "string" },
            to: { type: "string" },
            relation: { type: "string" },
          },
          allowPositionals: false,
        });
        if (!values.from || !values.to || !values.relation) {
          console.error("loop link package requires --from, --to, and --relation");
          return 1;
        }
        const result = await runLinkPackage({
          fromPackageId: values.from,
          toPackageId: values.to,
          relation: values.relation as import("../kernel/contracts/vocabulary.js").PackageRelationship,
        });
        console.log(result.output);
        return result.code;
      }
      case "approve": {
        const [packageId, phaseValue, ...approveRest] = rest;
        if (!packageId || !phaseValue) {
          console.error("Usage: loop approve <package-id> <phase> --actor <actor> --reason <reason> [--expires <iso-datetime>]");
          return 1;
        }
        const phase = parsePhase(phaseValue);
        if (!phase) {
          console.error(`invalid phase: ${phaseValue}`);
          return 1;
        }
        const { values } = parseArgs({
          args: approveRest,
          options: {
            actor: { type: "string" },
            reason: { type: "string" },
            expires: { type: "string" },
          },
          allowPositionals: false,
        });
        if (!values.actor || !values.reason) {
          console.error("loop approve requires --actor and --reason");
          return 1;
        }
        const result = await runApprove({
          packageId,
          phase,
          actor: values.actor,
          reason: values.reason,
          ...(values.expires ? { expiresAt: values.expires } : {}),
        });
        console.log(result.output);
        return result.code;
      }
      case "waive": {
        const [packageId, phaseValue, ...waiveRest] = rest;
        if (!packageId || !phaseValue) {
          console.error("Usage: loop waive <package-id> <phase> --condition <rule-id> --approver <actor> --reason <reason> --expires <iso-datetime>");
          return 1;
        }
        const phase = parsePhase(phaseValue);
        if (!phase) {
          console.error(`invalid phase: ${phaseValue}`);
          return 1;
        }
        const { values } = parseArgs({
          args: waiveRest,
          options: {
            condition: { type: "string" },
            approver: { type: "string" },
            reason: { type: "string" },
            expires: { type: "string" },
          },
          allowPositionals: false,
        });
        if (!values.condition || !values.approver || !values.reason || !values.expires) {
          console.error("loop waive requires --condition, --approver, --reason, and --expires");
          return 1;
        }
        const result = await runWaive({
          packageId,
          phase,
          conditionId: values.condition,
          approver: values.approver,
          reason: values.reason,
          expiresAt: values.expires,
        });
        console.log(result.output);
        return result.code;
      }
      case "verify-changed": {
        const { values } = parseArgs({
          args: rest,
          options: {
            mode: { type: "string", default: "enforce" },
            "git-base": { type: "string" },
            "package-id": { type: "string", multiple: true },
            "all-packages": { type: "boolean", default: false },
            "from-git-diff": { type: "boolean", default: false },
            "repo-tests": { type: "boolean", default: false },
          },
          allowPositionals: false,
        });
        const mode = parseVerifyMode(values.mode ?? "enforce");
        if (!mode) {
          console.error("loop verify-changed requires --mode enforce or report-only");
          return 1;
        }
        const result = await runVerifyChanged({
          mode,
          ...(values["git-base"] ? { gitBase: values["git-base"] } : {}),
          ...(values["package-id"]?.length ? { packageIds: values["package-id"] } : {}),
          ...(values["all-packages"] ? { allPackages: true } : {}),
          ...(values["from-git-diff"] ? { fromGitDiff: true } : {}),
          ...(values["repo-tests"] ? { runRepositoryTests: true } : {}),
        });
        console.log(result.output);
        return result.code;
      }
      case "release": {
        const [subcommand, packageId, ...releaseRest] = rest;
        if (subcommand !== "prepare" || !packageId) {
          console.error("Usage: loop release prepare <package-id> --commit <sha> [--workflow-run-id <id>]");
          return 1;
        }
        const { values } = parseArgs({
          args: releaseRest,
          options: {
            commit: { type: "string" },
            "workflow-run-id": { type: "string" },
          },
          allowPositionals: false,
        });
        if (!values.commit) {
          console.error("loop release prepare requires --commit");
          return 1;
        }
        const result = await runReleasePrepare({
          packageId,
          gitCommit: values.commit,
          ...(values["workflow-run-id"] ? { workflowRunId: values["workflow-run-id"] } : {}),
        });
        console.log(result.output);
        return result.code;
      }
      case "orchestrate": {
        const [packageId, ...orchestrateRest] = rest;
        if (!packageId) {
          console.error("Usage: loop orchestrate <package-id> [--runtime codex|claude] [--actor <actor>] [--through <phase>]");
          return 1;
        }
        const { values } = parseArgs({
          args: orchestrateRest,
          options: {
            runtime: { type: "string", default: "codex" },
            actor: { type: "string", default: "loop-cli" },
            through: { type: "string" },
          },
          allowPositionals: false,
        });
        const runtimeId = values.runtime ?? "codex";
        if (!isSupportedRuntimeId(runtimeId)) {
          console.error("loop orchestrate requires --runtime codex or claude");
          return 1;
        }
        if (values.through) {
          const invalid = validateOrchestratePhase(values.through);
          if (invalid) {
            console.error(invalid.output);
            return invalid.code;
          }
        }
        const result = await runOrchestrate({
          packageId,
          runtimeId,
          actor: values.actor ?? "loop-cli",
          ...(values.through ? { throughPhase: parsePhase(values.through)! } : {}),
        });
        console.log(result.output);
        return result.code;
      }
      case "run": {
        const [packageId, phaseValue, ...runRest] = rest;
        if (!packageId || !phaseValue) {
          console.error("Usage: loop run <package-id> <phase> [--runtime codex|claude] [--actor <actor>] [--model <model-id>] [--stub]");
          return 1;
        }
        const phase = parsePhase(phaseValue);
        if (!phase) {
          console.error(`invalid phase: ${phaseValue}`);
          return 1;
        }
        const { values } = parseArgs({
          args: runRest,
          options: {
            runtime: { type: "string", default: "codex" },
            actor: { type: "string", default: "loop-cli" },
            model: { type: "string" },
            stub: { type: "boolean", default: false },
          },
          allowPositionals: false,
        });
        const runtimeId = values.runtime ?? "codex";
        if (!isSupportedRuntimeId(runtimeId)) {
          console.error("loop run requires --runtime codex or claude");
          return 1;
        }
        const result = await runPhaseSkill({
          packageId,
          phase,
          runtimeId,
          actor: values.actor ?? "loop-cli",
          ...(values.model ? { modelId: values.model } : {}),
          ...(values.stub ? { useStubExecutor: true, executor: new StubRuntimeExecutor(runtimeId) } : {}),
        });
        console.log(result.output);
        return result.code;
      }
      default: {
        const result = failure(`unknown command: ${command}`);
        console.error(result.output);
        return result.code;
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

const code = await runCli(process.argv.slice(2));
process.exit(code);
