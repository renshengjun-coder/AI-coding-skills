import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadDocument } from "../../src/kernel/io/load-document.js";
import { validateProfileConfiguration } from "../../src/kernel/policy/evaluate-gate.js";

describe("committed profiles and policies", () => {
  it.each([
    ".loop/policies/v1/base.yaml",
    ".loop/profiles/routine.yaml",
    ".loop/profiles/standard.yaml",
    ".loop/profiles/high-risk.yaml",
  ])("%s is a valid contract document", async (path) => {
    const document = loadDocument(await readFile(path, "utf8"), path);
    expect(document.apiVersion).toBe("loop.dev/v1");
  });

  it("binds every committed profile to valid policy rules", async () => {
    const policy = loadDocument(
      await readFile(".loop/policies/v1/base.yaml", "utf8"),
      ".loop/policies/v1/base.yaml",
    );
    if (policy.kind !== "GatePolicy") throw new Error("base policy has the wrong kind");

    for (const path of [
      ".loop/profiles/routine.yaml",
      ".loop/profiles/standard.yaml",
      ".loop/profiles/high-risk.yaml",
    ]) {
      const profile = loadDocument(await readFile(path, "utf8"), path);
      if (profile.kind !== "WorkflowProfile") throw new Error(`${path} has the wrong kind`);
      expect(validateProfileConfiguration(profile, [policy])).toEqual([]);
    }
  });
});
