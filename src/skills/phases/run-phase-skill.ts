import type { PhaseSkillManifest } from "../contract/manifest.js";
import type { SkillInvocationContext, SkillStructuredOutput } from "../contract/types.js";
import { artifactFileForPhase, PHASE_PRODUCERS } from "./phase-producers.js";
import { runSelfCheckRules } from "./self-check.js";

export function runDedicatedPhaseSkill(
  manifest: PhaseSkillManifest,
  context: SkillInvocationContext,
): SkillStructuredOutput {
  if (manifest.spec.phase !== context.phase) {
    throw new Error(`skill phase ${manifest.spec.phase} does not match context phase ${context.phase}`);
  }

  for (const required of manifest.spec.requiredContext) {
    if (required === "changePackage") continue;
    if (required === "upstreamArtifacts") {
      const hasUpstream = context.documents.some((document) =>
        document.kind === "ArtifactEnvelope" &&
        document.spec.packageId === context.package.metadata.id &&
        document.spec.phase !== context.phase);
      if (!hasUpstream && context.phase !== "requirements") {
        throw new Error(`required upstream artifacts missing for ${context.phase}`);
      }
    }
  }

  const producer = PHASE_PRODUCERS[context.phase];
  const produced = producer(context);
  const selfCheck = runSelfCheckRules(manifest.spec.selfCheckRules, produced.markdown, context);

  return {
    artifactMarkdown: produced.markdown,
    artifactRelativePath: artifactFileForPhase(context.phase),
    selfCheck: {
      result: selfCheck.result,
      messages: selfCheck.messages,
    },
    findings: [...selfCheck.findings],
    traceSuggestions: produced.traceSuggestions,
  };
}
