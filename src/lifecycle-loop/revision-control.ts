import type { AnyDocument, GateAttempt, RuleEvaluation } from "../kernel/contracts/types.js";
import type { Phase } from "../kernel/contracts/vocabulary.js";
import { DEFAULT_LOOP_SAFETY, type LoopSafetyConfig } from "./safety.js";
import type { ReentryRecommendation } from "./types.js";

export function gateAttemptsForPhase(
  documents: AnyDocument[],
  packageId: string,
  phase: Phase,
): GateAttempt[] {
  return documents
    .filter((document): document is GateAttempt =>
      document.kind === "GateAttempt" &&
      document.spec.packageId === packageId &&
      document.spec.phase === phase)
    .sort((left, right) => right.metadata.revision - left.metadata.revision);
}

function failedBlockingRuleIds(evaluations: RuleEvaluation[]): string[] {
  return evaluations
    .filter((item) => item.blocking && item.outcome === "fail")
    .map((item) => item.ruleId)
    .sort();
}

export function detectNoProgress(
  attempts: GateAttempt[],
  config: LoopSafetyConfig = DEFAULT_LOOP_SAFETY,
): boolean {
  const failedAttempts = attempts
    .filter((attempt) => attempt.spec.result === "fail" || attempt.spec.result === "error")
    .slice(0, config.noProgressRepeatCount);
  if (failedAttempts.length < config.noProgressRepeatCount) return false;

  const signatures = failedAttempts.map((attempt) =>
    failedBlockingRuleIds(attempt.spec.evaluations).join("|"));
  return signatures.every((signature) => signature === signatures[0] && signature.length > 0);
}

export function recommendReentry(
  packageId: string,
  phase: Phase,
  documents: AnyDocument[],
  gateFailed: boolean,
  config: LoopSafetyConfig = DEFAULT_LOOP_SAFETY,
): ReentryRecommendation | undefined {
  if (!gateFailed) return undefined;

  const attempts = gateAttemptsForPhase(documents, packageId, phase);
  const attemptCount = attempts.length + 1;

  if (attemptCount > config.maxRevisionAttempts) {
    return {
      phase,
      reason: "Revision attempt budget exhausted; escalate to human review.",
      attemptCount,
      maxAttempts: config.maxRevisionAttempts,
    };
  }

  if (detectNoProgress(attempts, config)) {
    return {
      phase,
      reason: "Repeated blocking failures without progress; escalate instead of automatic re-entry.",
      attemptCount,
      maxAttempts: config.maxRevisionAttempts,
    };
  }

  return {
    phase,
    reason: "Gate failed; re-run the owning phase skill to produce a revised artifact.",
    attemptCount,
    maxAttempts: config.maxRevisionAttempts,
  };
}
