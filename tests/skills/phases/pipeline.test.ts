import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runPhaseSkill } from "../../../src/cli/commands/run.js";
import { runStart } from "../../../src/cli/commands/start.js";
import { PHASES } from "../../../src/kernel/contracts/vocabulary.js";
import { loadPackageBundle } from "../../../src/loop/package-store.js";
import { createTestLoopRoot } from "../../loop/test-loop-root.js";

describe("phase skill pipeline", () => {
  let tempRoot: string;

  afterEach(async () => {
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
  });

  async function setupRepo(): Promise<{ baseDir: string; packageId: string }> {
    tempRoot = await mkdtemp(join(tmpdir(), "loop-pipeline-"));
    const loopSeed = await createTestLoopRoot();
    await cp(loopSeed, join(tempRoot, ".loop"), { recursive: true });
    await cp(join(process.cwd(), "skills"), join(tempRoot, "skills"), { recursive: true });
    await rm(loopSeed, { recursive: true, force: true });

    const packageId = "CHG-FEAT-PIPE1";
    await runStart({
      baseDir: tempRoot,
      type: "feature",
      title: "Pipeline phase skills",
      owner: "platform-team",
      profileId: "standard",
      packageId,
    });
    return { baseDir: tempRoot, packageId };
  }

  it("runs all phases with dedicated local producers and records trace links", async () => {
    const { baseDir, packageId } = await setupRepo();
    const loopRoot = join(baseDir, ".loop");

    for (const phase of PHASES) {
      const result = await runPhaseSkill({
        baseDir,
        packageId,
        phase,
        runtimeId: "codex",
        actor: "pipeline-test",
      });
      expect(result.code).toBe(0);
      expect(result.output).toContain(`Ran ${phase}`);
    }

    const bundle = await loadPackageBundle(loopRoot, packageId);
    const envelopes = bundle.documents.filter((document) => document.kind === "ArtifactEnvelope");
    expect(envelopes.length).toBe(PHASES.length);

    const design = envelopes.find((document) => document.spec.phase === "design");
    const requirements = envelopes.find((document) => document.spec.phase === "requirements");
    expect(design?.spec.trace).toEqual(expect.arrayContaining([
      expect.objectContaining({
        relation: "derives-from",
        target: expect.objectContaining({ id: requirements?.metadata.id }),
      }),
    ]));
  });
});
