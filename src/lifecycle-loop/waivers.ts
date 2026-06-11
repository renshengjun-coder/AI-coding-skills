import type { AnyDocument, RuleEvaluation, Waiver } from "../kernel/contracts/types.js";
import type { Phase } from "../kernel/contracts/vocabulary.js";

export function activeWaiversForPhase(
  documents: AnyDocument[],
  packageId: string,
  phase: Phase,
  evaluationTime: string,
): Waiver[] {
  const evaluationMs = Date.parse(evaluationTime);
  return documents.filter((document): document is Waiver =>
    document.kind === "Waiver" &&
    document.spec.packageId === packageId &&
    document.spec.phase === phase &&
    document.spec.status === "active" &&
    Date.parse(document.spec.expiresAt) > evaluationMs);
}

export function waivedRuleIds(
  waivers: Waiver[],
  failedEvaluations: RuleEvaluation[],
): Set<string> {
  const failedBlocking = failedEvaluations.filter((item) => item.blocking && item.outcome === "fail");
  const waived = new Set<string>();
  for (const evaluation of failedBlocking) {
    const covers = waivers.some((waiver) => waiver.spec.conditionId === evaluation.ruleId);
    if (covers) waived.add(evaluation.ruleId);
  }
  return waived;
}

export function applyWaiversToResult(
  evaluations: RuleEvaluation[],
  waivers: Waiver[],
): "pass" | "fail" | "waived" {
  const blockingFailures = evaluations.filter((item) => item.blocking && item.outcome === "fail");
  if (blockingFailures.length === 0) return "pass";

  const waived = waivedRuleIds(waivers, evaluations);
  const uncovered = blockingFailures.filter((item) => !waived.has(item.ruleId));
  if (uncovered.length === 0) return "waived";
  return "fail";
}
