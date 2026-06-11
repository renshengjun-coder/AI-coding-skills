import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runAudit } from "../../src/cli/commands/audit.js";
import { runClassify } from "../../src/cli/commands/classify.js";
import { runCheck } from "../../src/cli/commands/check.js";
import { runGate } from "../../src/cli/commands/gate.js";
import { runStart } from "../../src/cli/commands/start.js";
import { runStatus } from "../../src/cli/commands/status.js";
import { artifactEnvelope, approval } from "../fixtures/builders.js";
import { createTestLoopRoot } from "../loop/test-loop-root.js";
import { loadPackageBundle, savePackageDocument } from "../../src/loop/package-store.js";

describe("loop cli workflow", () => {
  let tempRoot: string;

  afterEach(async () => {
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
  });

  async function setupRepo(): Promise<string> {
    tempRoot = await mkdtemp(join(tmpdir(), "loop-cli-"));
    const loopSeed = await createTestLoopRoot();
    await cp(loopSeed, join(tempRoot, ".loop"), { recursive: true });
    await rm(loopSeed, { recursive: true, force: true });
    return tempRoot;
  }

  it("runs start, classify, check, gate, status, and audit", async () => {
    const baseDir = await setupRepo();
    const packageId = "CHG-TASK-0099";

    expect((await runStart({
      baseDir,
      type: "development-task",
      title: "CLI workflow",
      owner: "platform-team",
      profileId: "standard",
      packageId,
    })).code).toBe(0);

    expect((await runClassify({
      baseDir,
      packageId,
      selectedTier: "routine",
      overrideActor: "lead@example.com",
      overrideReason: "Low risk pilot slice",
    })).code).toBe(0);

    const loopRootPath = join(baseDir, ".loop");
    const bundle = await loadPackageBundle(loopRootPath, packageId);
    await savePackageDocument(loopRootPath, packageId, artifactEnvelope({
      metadata: { id: "ART-REQ-CLI" },
      spec: { packageId },
    }));
    await savePackageDocument(loopRootPath, packageId, approval({
      metadata: { id: "APR-CLI" },
      spec: { packageId },
    }));

    expect((await runCheck({ baseDir, packageId })).code).toBe(0);

    const gate = await runGate({
      baseDir,
      packageId,
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
    });
    expect(gate.code).toBe(0);
    expect(gate.output).toContain("result=pass");
    expect(gate.output).toContain("lifecycle-phase-self-check");

    const status = await runStatus({ baseDir, packageId });
    expect(status.code).toBe(0);
    expect(status.output).toContain("requirements");

    const audit = await runAudit({ baseDir, packageId });
    expect(audit.code).toBe(0);
    expect(audit.output).toContain("# Audit report");
    expect(audit.output).toContain(packageId);
    expect(audit.output).toContain("ClassificationDecision");
    expect(audit.output).toContain("GateAttempt");
  });
});
