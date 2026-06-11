import type { ArtifactEnvelope } from "../../kernel/contracts/types.js";
import type { ArtifactType, Phase } from "../../kernel/contracts/vocabulary.js";
import type { SkillInvocationContext } from "../contract/types.js";

export function packageArtifacts(context: SkillInvocationContext): ArtifactEnvelope[] {
  return context.documents.filter((document): document is ArtifactEnvelope =>
    document.kind === "ArtifactEnvelope" &&
    document.spec.packageId === context.package.metadata.id);
}

export function latestArtifactByPhase(context: SkillInvocationContext, phase: Phase): ArtifactEnvelope | undefined {
  return packageArtifacts(context)
    .filter((artifact) => artifact.spec.phase === phase)
    .sort((left, right) => right.metadata.revision - left.metadata.revision)[0];
}

export function latestArtifactByType(
  context: SkillInvocationContext,
  artifactType: ArtifactType,
): ArtifactEnvelope | undefined {
  return packageArtifacts(context)
    .filter((artifact) => artifact.spec.artifactType === artifactType)
    .sort((left, right) => right.metadata.revision - left.metadata.revision)[0];
}

export function openFindingsForPhase(context: SkillInvocationContext, phase: Phase): number {
  return context.documents.filter((document) =>
    document.kind === "Finding" &&
    document.spec.packageId === context.package.metadata.id &&
    document.spec.phase === phase &&
    document.spec.status === "open").length;
}
