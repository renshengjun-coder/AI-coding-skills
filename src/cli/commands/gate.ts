import { digestForEvidenceReference } from "../../kernel/graph/evidence-graph.js";
import type { GateAttempt } from "../../kernel/contracts/types.js";
import type { Phase } from "../../kernel/contracts/vocabulary.js";
import { runLifecycleLoopGateEvaluation } from "../../lifecycle-loop/final-evaluation.js";
import {
  loadPackageContext,
  loadPoliciesForProfile,
  loadProfile,
  nextDocumentRevision,
  nextSequentialId,
  resolveLoopRoot,
  savePackageDocument,
} from "../../loop/package-store.js";
import { failure, success, type CommandResult } from "../types.js";

export const LIFECYCLE_LOOP_ISSUER = "lifecycle-loop";

export interface LifecycleGateOptions {
  packageId: string;
  phase: Phase;
  evaluationTime?: string;
  baseDir?: string;
  persistFindings?: boolean;
}

export async function runLifecycleGate(options: LifecycleGateOptions): Promise<CommandResult> {
  const loopRootPath = resolveLoopRoot(options.baseDir);
  const context = await loadPackageContext(loopRootPath, options.packageId);
  const rootBundle = context.bundles.find((bundle) => bundle.package.metadata.id === options.packageId);
  if (!rootBundle) return failure(`package ${options.packageId} not found`);

  const profile = await loadProfile(loopRootPath, rootBundle.package.spec.profileId);
  const policies = await loadPoliciesForProfile(loopRootPath, profile);
  const evaluationTime = options.evaluationTime ?? new Date().toISOString();

  const evaluation = runLifecycleLoopGateEvaluation({
    package: rootBundle.package,
    phase: options.phase,
    evaluationTime,
    profile,
    policies,
    documents: context.documents,
  });

  const gateId = nextSequentialId(rootBundle.documents, "GateAttempt", "GATE");
  const revision = nextDocumentRevision(rootBundle.documents, "GateAttempt", gateId);
  const now = new Date().toISOString();

  const gateAttempt: GateAttempt = {
    apiVersion: "loop.dev/v1",
    kind: "GateAttempt",
    metadata: { id: gateId, revision, createdAt: now },
    spec: {
      packageId: options.packageId,
      phase: options.phase,
      profileId: profile.metadata.id,
      policyIds: profile.spec.policyIds,
      boundEvidence: context.documents.map((document) => ({
        kind: document.kind,
        id: document.metadata.id,
        revision: document.metadata.revision,
        digest: digestForEvidenceReference(document),
      })),
      evaluations: evaluation.evaluations,
      result: evaluation.result,
      issuedBy: LIFECYCLE_LOOP_ISSUER,
    },
  };

  const savedPaths: string[] = [];
  const gatePath = await savePackageDocument(loopRootPath, options.packageId, gateAttempt);
  savedPaths.push(gatePath);

  if ((options.persistFindings ?? true) && evaluation.emittedFindings.length > 0) {
    for (const finding of evaluation.emittedFindings) {
      savedPaths.push(await savePackageDocument(loopRootPath, options.packageId, finding));
    }
  }

  const summary = evaluation.evaluations
    .map((item) => `${item.ruleId}: ${item.outcome}`)
    .join(", ");
  const escalationSummary = evaluation.escalations.length > 0
    ? `\nEscalations: ${evaluation.escalations.map((item) => item.trigger).join(", ")}`
    : "";
  const reentrySummary = evaluation.reentry
    ? `\nRe-entry: ${evaluation.reentry.reason} (attempt ${evaluation.reentry.attemptCount}/${evaluation.reentry.maxAttempts})`
    : "";

  return success(
    `Gate ${gateId}@${revision} result=${gateAttempt.spec.result}\n${summary}${escalationSummary}${reentrySummary}\n${savedPaths.join("\n")}`,
  );
}

/** @deprecated Use runLifecycleGate — alias for CLI compatibility. */
export async function runGate(options: LifecycleGateOptions): Promise<CommandResult> {
  return runLifecycleGate(options);
}
