import type { AnyDocument, Finding } from "../kernel/contracts/types.js";
import type { Phase } from "../kernel/contracts/vocabulary.js";
import type { EscalationNotice, ReentryRecommendation } from "./types.js";

const SOURCE = "lifecycle-loop";

export function nextFindingId(documents: AnyDocument[], existing: Finding[]): string {
  const all = [...documents, ...existing];
  let max = 0;
  for (const document of all) {
    if (document.kind !== "Finding") continue;
    const match = document.metadata.id.match(/^FND-(\d+)$/);
    if (match?.[1]) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return `FND-${String(max + 1).padStart(4, "0")}`;
}

export function buildEscalationFindings(
  packageId: string,
  phase: Phase,
  escalations: EscalationNotice[],
  documents: AnyDocument[],
  createdAt: string,
  pending: Finding[] = [],
): Finding[] {
  const findings: Finding[] = [...pending];
  for (const escalation of escalations) {
    const id = nextFindingId(documents, findings);
    findings.push({
      apiVersion: "loop.dev/v1",
      kind: "Finding",
      metadata: { id, revision: 1, createdAt },
      spec: {
        packageId,
        phase,
        sourceEvaluator: SOURCE,
        ruleId: `escalation-${escalation.trigger}`,
        severity: "blocking",
        status: "open",
        message: escalation.message,
        affectedEvidence: [],
        recommendedAction: "Obtain required human approval or resolve the escalation trigger.",
      },
    });
  }
  return findings;
}

export function buildReentryFinding(
  packageId: string,
  reentry: ReentryRecommendation,
  documents: AnyDocument[],
  createdAt: string,
  pending: Finding[] = [],
): Finding | undefined {
  if (reentry.reason.includes("escalate")) return undefined;
  const id = nextFindingId(documents, pending);
  return {
    apiVersion: "loop.dev/v1",
    kind: "Finding",
    metadata: { id, revision: 1, createdAt },
    spec: {
      packageId,
      phase: reentry.phase,
      sourceEvaluator: SOURCE,
      ruleId: "controlled-reentry",
      severity: "warning",
      status: "open",
      message: reentry.reason,
      affectedEvidence: [],
      recommendedAction: `Re-run phase skill for ${reentry.phase} (attempt ${reentry.attemptCount}/${reentry.maxAttempts}).`,
    },
  };
}
