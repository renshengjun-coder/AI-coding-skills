import { digestDocument } from "../canonical/canonicalize.js";
import type { AnyDocument, GateAttempt } from "../contracts/types.js";
import { buildEvidenceGraph, evidenceRefKey } from "../graph/evidence-graph.js";

export interface FreshnessIssue {
  reference: string;
  reason: "missing" | "digest-mismatch";
}

export interface FreshnessResult {
  status: "fresh" | "stale";
  issues: FreshnessIssue[];
}

export function evaluateFreshness(gate: GateAttempt, currentDocuments: AnyDocument[]): FreshnessResult {
  const graph = buildEvidenceGraph(currentDocuments);
  const issues: FreshnessIssue[] = [];

  for (const reference of gate.spec.boundEvidence) {
    const key = evidenceRefKey(reference);
    const current = graph.byKey.get(key);
    if (!current) {
      issues.push({ reference: key, reason: "missing" });
    } else if (digestDocument(current) !== reference.digest) {
      issues.push({ reference: key, reason: "digest-mismatch" });
    }
  }

  return { status: issues.length === 0 ? "fresh" : "stale", issues };
}
