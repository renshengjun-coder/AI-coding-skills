import type { AnyDocument, ClassificationDecision, Finding } from "../kernel/contracts/types.js";
import type { Phase } from "../kernel/contracts/vocabulary.js";
import type { EscalationNotice } from "./types.js";
import { DEFAULT_LOOP_SAFETY } from "./safety.js";

function classificationOverrides(
  documents: AnyDocument[],
  packageId: string,
): ClassificationDecision[] {
  return documents.filter((document): document is ClassificationDecision =>
    document.kind === "ClassificationDecision" &&
    document.spec.packageId === packageId &&
    document.spec.override !== undefined);
}

function recurringBlockingFindings(
  documents: AnyDocument[],
  packageId: string,
  phase: Phase,
): Finding[] {
  const openBlockers = documents.filter((document): document is Finding =>
    document.kind === "Finding" &&
    document.spec.packageId === packageId &&
    document.spec.phase === phase &&
    document.spec.severity === "blocking" &&
    document.spec.status === "open");
  const byRule = new Map<string, number>();
  for (const finding of openBlockers) {
    byRule.set(finding.spec.ruleId, (byRule.get(finding.spec.ruleId) ?? 0) + 1);
  }
  return openBlockers.filter((finding) => (byRule.get(finding.spec.ruleId) ?? 0) >= 2);
}

export function detectEscalations(
  documents: AnyDocument[],
  packageId: string,
  phase: Phase,
  attemptCount: number,
): EscalationNotice[] {
  const escalations: EscalationNotice[] = [];

  if (classificationOverrides(documents, packageId).length > 0) {
    escalations.push({
      trigger: "classification-override",
      message: "Classification override recorded; human approval required for this gate.",
      requiredApprovals: 1,
    });
  }

  const recurring = recurringBlockingFindings(documents, packageId, phase);
  if (recurring.length > 0) {
    escalations.push({
      trigger: "recurring-blocking-finding",
      message: `Recurring blocking findings: ${recurring.map((f) => f.spec.ruleId).join(", ")}`,
      requiredApprovals: 1,
    });
  }

  if (attemptCount >= DEFAULT_LOOP_SAFETY.maxRevisionAttempts) {
    escalations.push({
      trigger: "attempt-budget",
      message: `Revision attempt budget exhausted (${attemptCount}/${DEFAULT_LOOP_SAFETY.maxRevisionAttempts}).`,
      requiredApprovals: 1,
    });
  }

  return escalations;
}

export function escalationApprovalEvaluation(
  escalations: EscalationNotice[],
  approvalCount: number,
): { outcome: "pass" | "fail"; message: string; required: number } {
  const required = escalations.reduce((max, item) => Math.max(max, item.requiredApprovals), 0);
  if (required === 0) {
    return { outcome: "pass", message: "no escalation approvals required", required: 0 };
  }
  if (approvalCount >= required) {
    return { outcome: "pass", message: `${approvalCount}/${required} escalation approvals present`, required };
  }
  return {
    outcome: "fail",
    message: `${approvalCount}/${required} escalation approvals present`,
    required,
  };
}
