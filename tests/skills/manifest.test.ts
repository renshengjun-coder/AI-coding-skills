import { describe, expect, it } from "vitest";
import { PHASES } from "../../src/kernel/contracts/vocabulary.js";
import { loadPhaseSkillManifest } from "../../src/skills/contract/manifest.js";
import { PHASE_ARTIFACT_TYPES } from "../../src/skills/contract/types.js";

describe("phase skill manifests", () => {
  it.each(PHASES)("%s manifest loads and matches phase artifact type", async (phase) => {
    const manifest = await loadPhaseSkillManifest(phase);
    expect(manifest.spec.phase).toBe(phase);
    expect(manifest.spec.outputArtifactType).toBe(PHASE_ARTIFACT_TYPES[phase]);
    expect(manifest.spec.capabilities.length).toBeGreaterThan(0);
    expect(manifest.spec.selfCheckRules.length).toBeGreaterThan(0);
  });
});
