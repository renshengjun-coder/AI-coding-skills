import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runPhaseSkill } from "../../src/cli/commands/run.js";
import { runStart } from "../../src/cli/commands/start.js";
import { loadPackageBundle } from "../../src/loop/package-store.js";
import { StubRuntimeExecutor } from "../../src/skills/runtime/stub-executor.js";
import { createTestLoopRoot } from "../loop/test-loop-root.js";

describe("loop run", () => {
  let tempRoot: string;

  afterEach(async () => {
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
  });

  async function setupRepo(): Promise<string> {
    tempRoot = await mkdtemp(join(tmpdir(), "loop-run-"));
    const loopSeed = await createTestLoopRoot();
    await cp(loopSeed, join(tempRoot, ".loop"), { recursive: true });
    await cp(join(process.cwd(), "skills"), join(tempRoot, "skills"), { recursive: true });
    await rm(loopSeed, { recursive: true, force: true });
    return tempRoot;
  }

  it("runs dedicated phase skills by default through codex adapter", async () => {
    const baseDir = await setupRepo();
    const packageId = "CHG-TASK-RUN2";
    await runStart({
      baseDir,
      type: "development-task",
      title: "Dedicated run test",
      owner: "platform-team",
      profileId: "standard",
      packageId,
    });

    const result = await runPhaseSkill({
      baseDir,
      packageId,
      phase: "requirements",
      runtimeId: "codex",
      actor: "tester",
    });
    expect(result.code).toBe(0);
    expect(result.output).toContain("Ran requirements");

    const bundle = await loadPackageBundle(join(baseDir, ".loop"), packageId);
    const envelope = bundle.documents.find((document) => document.kind === "ArtifactEnvelope");
    expect(envelope?.spec.artifactType).toBe("requirement-spec");
  });

  it("invokes a phase skill through codex and claude adapters with --stub", async () => {
    const baseDir = await setupRepo();
    const packageId = "CHG-TASK-RUN1";
    await runStart({
      baseDir,
      type: "development-task",
      title: "Run test",
      owner: "platform-team",
      profileId: "standard",
      packageId,
    });

    for (const runtimeId of ["codex", "claude"] as const) {
      const result = await runPhaseSkill({
        baseDir,
        packageId,
        phase: "requirements",
        runtimeId,
        actor: "tester",
        executor: new StubRuntimeExecutor(runtimeId),
      });
      expect(result.code).toBe(0);
      expect(result.output).toContain(runtimeId);
    }

    const bundle = await loadPackageBundle(join(baseDir, ".loop"), packageId);
    expect(bundle.documents.filter((document) => document.kind === "ArtifactEnvelope").length).toBe(2);
  });
});
