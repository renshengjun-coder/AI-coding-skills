import { createRuntimeAdapter, isSupportedRuntimeId } from "../../adapters/registry.js";
import type { Phase } from "../../kernel/contracts/vocabulary.js";
import { isPhase } from "../../kernel/contracts/vocabulary.js";
import {
  loadPackageContext,
  resolveLoopRoot,
} from "../../loop/package-store.js";
import { loadPhaseSkillManifest } from "../../skills/contract/manifest.js";
import type { RuntimeExecutor } from "../../skills/contract/types.js";
import { persistSkillInvocationResult } from "../../skills/persist-invocation.js";
import { createPhaseSkillExecutor } from "../../skills/runtime/phase-skill-executor.js";
import { failure, success, type CommandResult } from "../types.js";

export interface RunOptions {
  packageId: string;
  phase: Phase;
  runtimeId: string;
  actor: string;
  modelId?: string;
  executor?: RuntimeExecutor;
  useStubExecutor?: boolean;
  baseDir?: string;
}

export async function runPhaseSkill(options: RunOptions): Promise<CommandResult> {
  if (!isPhase(options.phase)) {
    return failure(`invalid phase: ${options.phase}`);
  }
  if (!isSupportedRuntimeId(options.runtimeId)) {
    return failure(`invalid runtime: ${options.runtimeId}; expected codex or claude`);
  }
  const workspaceRoot = options.baseDir ?? process.cwd();
  const loopRootPath = resolveLoopRoot(workspaceRoot);
  const context = await loadPackageContext(loopRootPath, options.packageId);
  const rootBundle = context.bundles.find((bundle) => bundle.package.metadata.id === options.packageId);
  if (!rootBundle) return failure(`package ${options.packageId} not found`);

  const skill = await loadPhaseSkillManifest(options.phase, workspaceRoot);
  const invocationContext = {
    workspaceRoot,
    loopRoot: loopRootPath,
    package: rootBundle.package,
    documents: context.documents,
    phase: options.phase,
    actor: options.actor,
  };

  const executor = options.executor
    ?? (options.useStubExecutor
      ? undefined
      : createPhaseSkillExecutor(invocationContext, skill));
  if (!executor) {
    return failure("no runtime executor configured; pass executor or disable --stub");
  }

  const adapter = createRuntimeAdapter(options.runtimeId, executor, options.modelId);

  const result = await adapter.invoke({
    skill,
    context: invocationContext,
  });

  if (result.status === "error") {
    return failure(`skill invocation failed: ${result.error ?? "unknown error"}`);
  }

  const savedPaths = await persistSkillInvocationResult(loopRootPath, options.packageId, result);
  return success(
    [
      `Ran ${skill.metadata.id} via ${options.runtimeId}`,
      `Artifact ${result.envelope?.metadata.id}@${result.envelope?.metadata.revision}`,
      `Self-check: ${result.selfCheck.result}`,
      `Findings: ${result.findings.length}`,
      ...savedPaths,
    ].join("\n"),
  );
}
