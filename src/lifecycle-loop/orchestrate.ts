import { runLifecycleGate, type LifecycleGateOptions } from "../cli/commands/gate.js";
import { runPhaseSkill, type RunOptions } from "../cli/commands/run.js";
import type { CommandResult } from "../cli/types.js";
import type { WorkflowProfile } from "../kernel/contracts/types.js";
import type { Phase } from "../kernel/contracts/vocabulary.js";
import { PHASES } from "../kernel/contracts/vocabulary.js";
import {
  loadPackageContext,
  loadProfile,
  resolveLoopRoot,
} from "../loop/package-store.js";
import { DEFAULT_LOOP_SAFETY } from "./safety.js";

export interface OrchestrateOptions {
  packageId: string;
  baseDir?: string;
  runtimeId: string;
  actor: string;
  throughPhase?: Phase;
  runPhaseSkillOptions?: Partial<RunOptions>;
  gateOptions?: Partial<LifecycleGateOptions>;
}

export interface OrchestratePhaseResult {
  phase: Phase;
  run?: CommandResult;
  gate: CommandResult;
  reentered: boolean;
}

export interface OrchestrateResult {
  code: number;
  output: string;
  phases: OrchestratePhaseResult[];
}

function requiredPhases(profile: WorkflowProfile, throughPhase?: Phase): Phase[] {
  const required = profile.spec.phases.filter((item) => item.required).map((item) => item.phase);
  if (!throughPhase) return required;
  const throughIndex = PHASES.indexOf(throughPhase);
  return required.filter((phase) => PHASES.indexOf(phase) <= throughIndex);
}

export async function orchestratePackage(options: OrchestrateOptions): Promise<OrchestrateResult> {
  const loopRootPath = resolveLoopRoot(options.baseDir);
  const context = await loadPackageContext(loopRootPath, options.packageId);
  const rootBundle = context.bundles.find((bundle) => bundle.package.metadata.id === options.packageId);
  if (!rootBundle) {
    return { code: 1, output: `package ${options.packageId} not found`, phases: [] };
  }

  const profile = await loadProfile(loopRootPath, rootBundle.package.spec.profileId);
  const phases = requiredPhases(profile, options.throughPhase);
  const phaseResults: OrchestratePhaseResult[] = [];
  const lines: string[] = [`Orchestrating ${options.packageId} through ${phases.join(" → ")}`];

  for (const phase of phases) {
    let attempts = 0;
    let reentered = false;
    let gateResult: CommandResult | undefined;

    while (attempts < DEFAULT_LOOP_SAFETY.maxRevisionAttempts) {
      attempts += 1;
      const runResult = await runPhaseSkill({
        packageId: options.packageId,
        phase,
        runtimeId: options.runtimeId,
        actor: options.actor,
        ...(options.baseDir ? { baseDir: options.baseDir } : {}),
        ...options.runPhaseSkillOptions,
      });
      if (runResult.code !== 0) {
        phaseResults.push({ phase, run: runResult, gate: runResult, reentered });
        lines.push(`${phase}: phase skill failed`);
        return { code: runResult.code, output: lines.join("\n"), phases: phaseResults };
      }

      gateResult = await runLifecycleGate({
        packageId: options.packageId,
        phase,
        ...(options.baseDir ? { baseDir: options.baseDir } : {}),
        ...options.gateOptions,
      });
      if (gateResult.code === 0 && gateResult.output.includes("result=pass")) {
        phaseResults.push({ phase, run: runResult, gate: gateResult, reentered });
        lines.push(`${phase}: pass (attempt ${attempts})`);
        break;
      }
      if (gateResult.code === 0 && gateResult.output.includes("result=waived")) {
        phaseResults.push({ phase, run: runResult, gate: gateResult, reentered });
        lines.push(`${phase}: waived (attempt ${attempts})`);
        break;
      }

      if (attempts >= DEFAULT_LOOP_SAFETY.maxRevisionAttempts ||
        gateResult.output.includes("escalate instead of automatic re-entry") ||
        gateResult.output.includes("Revision attempt budget exhausted")) {
        phaseResults.push({ phase, run: runResult, gate: gateResult!, reentered });
        lines.push(`${phase}: blocked after attempt ${attempts}`);
        return { code: 1, output: lines.join("\n"), phases: phaseResults };
      }

      reentered = true;
      lines.push(`${phase}: re-entering after failed gate (attempt ${attempts})`);
    }
  }

  return { code: 0, output: lines.join("\n"), phases: phaseResults };
}
