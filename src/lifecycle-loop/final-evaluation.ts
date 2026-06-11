import type { Approval, RuleEvaluation } from "../kernel/contracts/types.js";
import { evaluateGate } from "../kernel/policy/evaluate-gate.js";
import {
  detectEscalations,
  escalationApprovalEvaluation,
} from "./escalation.js";
import {
  buildEscalationFindings,
  buildReentryFinding,
} from "./findings.js";
import { gateAttemptsForPhase, recommendReentry } from "./revision-control.js";
import { evaluatePhaseSelfCheck } from "./self-check.js";
import { activeWaiversForPhase, applyWaiversToResult } from "./waivers.js";
import type { LifecycleLoopGateInput, LifecycleLoopGateResult } from "./types.js";

const ESCALATION_RULE_ID = "lifecycle-escalation-approvals";

function countApprovals(
  input: LifecycleLoopGateInput,
): number {
  return input.documents.filter((document): document is Approval =>
    document.kind === "Approval" &&
    document.spec.packageId === input.package.metadata.id &&
    document.spec.phase === input.phase &&
    document.spec.decision === "approved" &&
    (!document.spec.expiresAt ||
      Date.parse(document.spec.expiresAt) > Date.parse(input.evaluationTime))).length;
}

export function runLifecycleLoopGateEvaluation(
  input: LifecycleLoopGateInput,
): LifecycleLoopGateResult {
  const packageId = input.package.metadata.id;
  const phase = input.phase;
  const now = input.evaluationTime;

  const selfCheckEvaluation = evaluatePhaseSelfCheck(input.documents, packageId, phase);
  const policyEvaluation = evaluateGate(input);
  const evaluations: RuleEvaluation[] = [
    selfCheckEvaluation,
    ...policyEvaluation.evaluations,
  ];

  const priorAttempts = gateAttemptsForPhase(input.documents, packageId, phase);
  const escalations = detectEscalations(input.documents, packageId, phase, priorAttempts.length + 1);
  const escalationCheck = escalationApprovalEvaluation(escalations, countApprovals(input));
  if (escalations.length > 0) {
    evaluations.push({
      ruleId: ESCALATION_RULE_ID,
      blocking: true,
      outcome: escalationCheck.outcome,
      message: escalationCheck.message,
      evidence: [],
    });
  }

  const hasError = evaluations.some((item) => item.outcome === "error");
  const hasBlockingFail = evaluations.some((item) => item.blocking && item.outcome === "fail");

  let result: LifecycleLoopGateResult["result"];
  if (hasError) {
    result = "error";
  } else if (!hasBlockingFail) {
    result = "pass";
  } else {
    const waivers = activeWaiversForPhase(input.documents, packageId, phase, now);
    const waiverOutcome = applyWaiversToResult(evaluations, waivers);
    result = waiverOutcome === "pass" ? "pass" : waiverOutcome;
  }

  const gateFailed = result === "fail" || result === "error";
  const reentry = recommendReentry(packageId, phase, input.documents, gateFailed);

  const escalationFindings = buildEscalationFindings(
    packageId,
    phase,
    escalations.filter(() => escalationCheck.outcome === "fail"),
    input.documents,
    now,
  );
  const reentryFinding = reentry ? buildReentryFinding(packageId, reentry, input.documents, now, escalationFindings) : undefined;
  const emittedFindings = reentryFinding
    ? [...escalationFindings, reentryFinding]
    : escalationFindings;

  return {
    result,
    evaluations,
    escalations,
    ...(reentry ? { reentry } : {}),
    emittedFindings,
  };
}
