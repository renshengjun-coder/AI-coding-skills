import { describe, expect, it } from "vitest";
import {
  ARTIFACT_RELATIONSHIPS,
  CONTRACT_KINDS,
  GATE_RESULTS,
  PACKAGE_RELATIONSHIPS,
  PHASES,
  isContractKind,
} from "../../src/kernel/contracts/vocabulary.js";

describe("contract vocabulary", () => {
  it("defines all lifecycle phases", () => {
    expect(PHASES).toEqual([
      "requirements",
      "design",
      "test-planning",
      "implementation",
      "review",
      "validation",
      "release",
    ]);
  });

  it("defines approved contract kinds and gate states", () => {
    expect(CONTRACT_KINDS).toContain("ChangePackage");
    expect(CONTRACT_KINDS).toContain("GateAttempt");
    expect(GATE_RESULTS).toEqual(["pass", "fail", "error", "stale", "waived"]);
  });

  it("keeps package and artifact relationships distinct", () => {
    expect(PACKAGE_RELATIONSHIPS).toContain("decomposes-into");
    expect(ARTIFACT_RELATIONSHIPS).toContain("implements");
    expect(ARTIFACT_RELATIONSHIPS).not.toContain("decomposes-into");
  });

  it("recognizes only supported contract kinds", () => {
    expect(isContractKind("WorkflowProfile")).toBe(true);
    expect(isContractKind("UnknownKind")).toBe(false);
  });
});
