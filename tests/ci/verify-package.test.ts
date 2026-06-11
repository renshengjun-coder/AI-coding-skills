import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyPackage } from "../../src/ci/verify-package.js";
import { runStart } from "../../src/cli/commands/start.js";
import { createTestLoopRoot } from "../loop/test-loop-root.js";

describe("verifyPackage", () => {
  it("reports missing required gates for a new package", async () => {
    const temp = await mkdtemp(join(tmpdir(), "verify-pkg-"));
    try {
      const loopSeed = await createTestLoopRoot();
      await cp(loopSeed, join(temp, ".loop"), { recursive: true });
      await rm(loopSeed, { recursive: true, force: true });
      const packageId = "CHG-TASK-VERIFY1";
      await runStart({
        baseDir: temp,
        type: "development-task",
        title: "Verify test",
        owner: "platform-team",
        profileId: "routine",
        packageId,
      });

      const result = await verifyPackage({ packageId, baseDir: temp });
      expect(result.passed).toBe(false);
      expect(result.issues.some((issue) => issue.ruleId === "required-gate")).toBe(true);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
});
