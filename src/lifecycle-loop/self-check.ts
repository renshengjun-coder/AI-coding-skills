import type { AnyDocument, ArtifactEnvelope, RuleEvaluation } from "../kernel/contracts/types.js";
import type { Phase } from "../kernel/contracts/vocabulary.js";

const RULE_ID = "lifecycle-phase-self-check";

function latestPhaseArtifact(
  documents: AnyDocument[],
  packageId: string,
  phase: Phase,
): ArtifactEnvelope | undefined {
  return documents
    .filter((document): document is ArtifactEnvelope =>
      document.kind === "ArtifactEnvelope" &&
      document.spec.packageId === packageId &&
      document.spec.phase === phase)
    .sort((left, right) => right.metadata.revision - left.metadata.revision)[0];
}

export function evaluatePhaseSelfCheck(
  documents: AnyDocument[],
  packageId: string,
  phase: Phase,
): RuleEvaluation {
  const artifact = latestPhaseArtifact(documents, packageId, phase);
  if (!artifact) {
    return {
      ruleId: RULE_ID,
      blocking: true,
      outcome: "fail",
      message: "no phase artifact envelope present for self-check verification",
      evidence: [],
    };
  }
  const selfCheck = artifact.spec.selfCheck;
  if (selfCheck.result === "pass") {
    return {
      ruleId: RULE_ID,
      blocking: true,
      outcome: "pass",
      message: `phase artifact ${artifact.metadata.id} self-check passed`,
      evidence: [{
        kind: "ArtifactEnvelope",
        id: artifact.metadata.id,
        revision: artifact.metadata.revision,
        digest: artifact.spec.content.digest,
      }],
    };
  }
  return {
    ruleId: RULE_ID,
    blocking: true,
    outcome: "fail",
    message: `phase artifact ${artifact.metadata.id} self-check result=${selfCheck.result}`,
    evidence: [{
      kind: "ArtifactEnvelope",
      id: artifact.metadata.id,
      revision: artifact.metadata.revision,
      digest: artifact.spec.content.digest,
    }],
  };
}
