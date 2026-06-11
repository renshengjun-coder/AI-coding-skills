import { describe, expect, it } from "vitest";
import { PHASES } from "../../../src/kernel/contracts/vocabulary.js";
import { buildSkillInvocationResult } from "../../../src/skills/contract/build-result.js";
import { loadPhaseSkillManifest } from "../../../src/skills/contract/manifest.js";
import type { SkillInvocationContext } from "../../../src/skills/contract/types.js";
import { runDedicatedPhaseSkill } from "../../../src/skills/phases/run-phase-skill.js";
import { changePackage } from "../../fixtures/builders.js";

function invocationContext(
  documents: SkillInvocationContext["documents"] = [changePackage()],
): SkillInvocationContext {
  return {
    workspaceRoot: process.cwd(),
    loopRoot: `${process.cwd()}/.loop`,
    package: changePackage(),
    documents,
    phase: "requirements",
    actor: "phase-test",
  };
}

describe("dedicated phase skill producers", () => {
  it("produces requirements artifact with passing self-check", async () => {
    const manifest = await loadPhaseSkillManifest("requirements");
    const context = { ...invocationContext(), phase: "requirements" as const };
    const output = runDedicatedPhaseSkill(manifest, context);

    expect(output.artifactRelativePath).toBe("requirements.md");
    expect(output.artifactMarkdown).toContain("Requirement Specification");
    expect(output.selfCheck.result).toBe("pass");
    expect(output.traceSuggestions).toEqual([]);
  });

  it("links design artifact to requirements via trace suggestions", async () => {
    const requirementsManifest = await loadPhaseSkillManifest("requirements");
    const designManifest = await loadPhaseSkillManifest("design");
    const baseContext = invocationContext();

    const requirementsOutput = runDedicatedPhaseSkill(requirementsManifest, {
      ...baseContext,
      phase: "requirements",
    });
    const requirementsResult = buildSkillInvocationResult(
      requirementsManifest,
      baseContext,
      { runtime: "codex", actor: "phase-test" },
      requirementsOutput,
      `${baseContext.loopRoot}/packages/${baseContext.package.metadata.id}/artifacts/requirements.md`,
    );

    const designContext: SkillInvocationContext = {
      ...baseContext,
      documents: [...baseContext.documents, requirementsResult.envelope],
      phase: "design",
    };
    const designOutput = runDedicatedPhaseSkill(designManifest, designContext);
    const designResult = buildSkillInvocationResult(
      designManifest,
      designContext,
      { runtime: "codex", actor: "phase-test" },
      designOutput,
      `${designContext.loopRoot}/packages/${designContext.package.metadata.id}/artifacts/design.md`,
    );

    expect(designOutput.traceSuggestions).toEqual([{
      relation: "derives-from",
      upstreamArtifactId: requirementsResult.envelope.metadata.id,
    }]);
    expect(designResult.suggestedTrace).toHaveLength(1);
    const trace = designResult.suggestedTrace[0]!;
    expect(trace.relation).toBe("derives-from");
    expect(trace.source.id).toBe(designResult.envelope.metadata.id);
    expect(trace.target.id).toBe(requirementsResult.envelope.metadata.id);
    expect(designResult.envelope.spec.trace).toEqual(designResult.suggestedTrace);
  });

  it.each(PHASES.filter((phase) => phase !== "requirements"))(
    "requires upstream artifacts for %s when none exist",
    async (phase) => {
      const manifest = await loadPhaseSkillManifest(phase);
      const context: SkillInvocationContext = {
        ...invocationContext(),
        phase,
      };
      expect(() => runDedicatedPhaseSkill(manifest, context)).toThrow(/upstream artifacts missing/);
    },
  );
});
