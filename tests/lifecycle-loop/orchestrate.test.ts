import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runApprove } from "../../src/cli/commands/approve.js";
import { runLifecycleGate } from "../../src/cli/commands/gate.js";
import { runPhaseSkill } from "../../src/cli/commands/run.js";
import { runStart } from "../../src/cli/commands/start.js";
import { orchestratePackage } from "../../src/lifecycle-loop/orchestrate.js";
import { loadPackageBundle } from "../../src/loop/package-store.js";
import { createTestLoopRoot } from "../loop/test-loop-root.js";

describe("lifecycle loop orchestration", () => {
  let tempRoot: string;

  afterEach(async () => {
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
  });

  async function setupRepo(): Promise<{ baseDir: string; packageId: string }> {
    tempRoot = await mkdtemp(join(tmpdir(), "loop-orchestrate-"));
    const loopSeed = await createTestLoopRoot();
    await cp(loopSeed, join(tempRoot, ".loop"), { recursive: true });
    await cp(join(process.cwd(), "skills"), join(tempRoot, "skills"), { recursive: true });
    await rm(loopSeed, { recursive: true, force: true });

    const packageId = "CHG-FEAT-ORCH1";
    await runStart({
      baseDir: tempRoot,
      type: "feature",
      title: "Orchestration test",
      owner: "platform-team",
      profileId: "standard",
      packageId,
    });
    return { baseDir: tempRoot, packageId };
  }

  it("passes design gate after requirements gate in sequence", async () => {
    const { baseDir, packageId } = await setupRepo();
    await runApprove({
      baseDir,
      packageId,
      phase: "requirements",
      actor: "reviewer@example.com",
      reason: "Pre-approved.",
    });
    await runPhaseSkill({ baseDir, packageId, phase: "requirements", runtimeId: "codex", actor: "t" });
    await runLifecycleGate({ baseDir, packageId, phase: "requirements" });
    await runPhaseSkill({ baseDir, packageId, phase: "design", runtimeId: "codex", actor: "t" });
    const designGate = await runLifecycleGate({ baseDir, packageId, phase: "design" });
    expect(designGate.output).toContain("result=pass");
  });

  it("orchestrates through design on standard profile", async () => {
    const { baseDir, packageId } = await setupRepo();
    await runApprove({
      baseDir,
      packageId,
      phase: "requirements",
      actor: "reviewer@example.com",
      reason: "Pre-approved for orchestration test.",
    });
    const result = await orchestratePackage({
      baseDir,
      packageId,
      runtimeId: "codex",
      actor: "orchestrate-test",
      throughPhase: "design",
    });
    if (result.code !== 0) {
      throw new Error(result.output);
    }

    const bundle = await loadPackageBundle(join(baseDir, ".loop"), packageId);
    const envelopes = bundle.documents.filter((document) => document.kind === "ArtifactEnvelope");
    const gates = bundle.documents.filter((document) => document.kind === "GateAttempt");
    expect(envelopes.length).toBeGreaterThanOrEqual(2);
    expect(gates.length).toBeGreaterThanOrEqual(2);
    expect(gates.every((gate) => gate.spec.issuedBy === "lifecycle-loop")).toBe(true);
  });
});
