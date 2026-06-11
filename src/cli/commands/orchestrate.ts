import type { Phase } from "../../kernel/contracts/vocabulary.js";
import { isPhase } from "../../kernel/contracts/vocabulary.js";
import { orchestratePackage } from "../../lifecycle-loop/orchestrate.js";
import { failure, type CommandResult } from "../types.js";

export interface OrchestrateCommandOptions {
  packageId: string;
  runtimeId: string;
  actor: string;
  throughPhase?: Phase;
  baseDir?: string;
}

export async function runOrchestrate(options: OrchestrateCommandOptions): Promise<CommandResult> {
  const result = await orchestratePackage({
    packageId: options.packageId,
    runtimeId: options.runtimeId,
    actor: options.actor,
    ...(options.throughPhase ? { throughPhase: options.throughPhase } : {}),
    ...(options.baseDir ? { baseDir: options.baseDir } : {}),
  });
  return { code: result.code, output: result.output };
}

export function parseThroughPhase(value: string | undefined): Phase | null {
  if (!value) return null;
  return isPhase(value) ? value : null;
}

export function validateOrchestratePhase(phase: string): CommandResult | null {
  if (!isPhase(phase)) {
    return failure(`invalid through phase: ${phase}`);
  }
  return null;
}
