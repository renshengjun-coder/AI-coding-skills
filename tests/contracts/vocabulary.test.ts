import { describe, expect, it } from "vitest";
import {
  ARTIFACT_RELATIONSHIPS,
  ARTIFACT_TYPES,
  CONTRACT_KINDS,
  FINDING_SEVERITIES,
  FINDING_STATUSES,
  GATE_RESULTS,
  HUMAN_APPROVAL_MODES,
  PACKAGE_RELATIONSHIPS,
  PHASES,
  PROFILE_TIERS,
  RULE_TYPES,
  isContractKind,
} from "../../src/kernel/contracts/vocabulary.js";

describe("contract vocabulary", () => {
  it("defines the exact contract kinds", () => {
    expect(CONTRACT_KINDS).toEqual([
      "ChangePackage",
      "ArtifactEnvelope",
      "Finding",
      "ClassificationDecision",
      "Approval",
      "Waiver",
      "GateAttempt",
      "WorkflowProfile",
      "GatePolicy",
    ]);
  });

  it("defines the exact lifecycle phases and artifact types", () => {
    expect(PHASES).toEqual([
      "requirements",
      "design",
      "test-planning",
      "implementation",
      "review",
      "validation",
      "release",
    ]);
    expect(ARTIFACT_TYPES).toEqual([
      "requirement-spec",
      "design-document",
      "test-plan",
      "implementation-record",
      "review-report",
      "validation-report",
      "release-record",
    ]);
  });

  it("defines the exact package and artifact relationships", () => {
    expect(PACKAGE_RELATIONSHIPS).toEqual([
      "decomposes-into",
      "child-of",
      "depends-on",
      "blocks",
      "supersedes",
    ]);
    expect(ARTIFACT_RELATIONSHIPS).toEqual([
      "satisfies",
      "derives-from",
      "implements",
      "verifies",
      "reviews",
      "validates",
      "releases",
      "supersedes",
    ]);
  });

  it("defines the exact gate, finding, profile, and approval states", () => {
    expect(GATE_RESULTS).toEqual(["pass", "fail", "error", "stale", "waived"]);
    expect(FINDING_SEVERITIES).toEqual(["info", "warning", "blocking"]);
    expect(FINDING_STATUSES).toEqual(["open", "resolved", "accepted"]);
    expect(PROFILE_TIERS).toEqual(["routine", "standard", "high-risk"]);
    expect(HUMAN_APPROVAL_MODES).toEqual(["none", "conditional", "required"]);
  });

  it("defines the exact deterministic rule types", () => {
    expect(RULE_TYPES).toEqual([
      "graph-integrity",
      "required-artifacts",
      "required-trace-relations",
      "no-open-blocking-findings",
      "required-approvals",
      "child-gates-pass",
    ]);
  });

  it("recognizes only supported contract kinds", () => {
    expect(isContractKind("WorkflowProfile")).toBe(true);
    expect(isContractKind("UnknownKind")).toBe(false);
  });
});
