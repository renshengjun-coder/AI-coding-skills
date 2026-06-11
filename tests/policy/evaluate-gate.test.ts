import { describe, expect, it } from "vitest";
import { digestDocument } from "../../src/kernel/canonical/canonicalize.js";
import {
  evaluateGate,
  validateProfileConfiguration,
} from "../../src/kernel/policy/evaluate-gate.js";
import {
  approval,
  artifactEnvelope,
  changePackage,
  finding,
  gateAttempt,
  gatePolicy,
  workflowProfile,
} from "../fixtures/builders.js";

describe("evaluateGate", () => {
  it("validates profile and policy binding", () => {
    expect(validateProfileConfiguration(workflowProfile(), [gatePolicy()])).toEqual([]);
    expect(validateProfileConfiguration(workflowProfile({
      spec: {
        phases: [{
          phase: "requirements",
          required: true,
          requiredArtifactTypes: [],
          requiredTraceRelations: [],
          humanApproval: "none",
          minimumApprovals: 1,
          enabledRuleIds: ["missing-rule"],
        }],
      },
    }), [gatePolicy()])).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "approval-configuration" }),
      expect.objectContaining({ ruleId: "undefined-rule" }),
    ]));
  });

  it("passes when every enabled rule passes", () => {
    const result = evaluateGate({
      package: changePackage(),
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile: workflowProfile(),
      policies: [gatePolicy()],
      documents: [changePackage(), artifactEnvelope(), approval()],
    });
    expect(result.result).toBe("pass");
    expect(result.evaluations.every((evaluation) => evaluation.outcome === "pass")).toBe(true);
  });

  it("fails when a required artifact is missing", () => {
    const result = evaluateGate({
      package: changePackage(),
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile: workflowProfile(),
      policies: [gatePolicy()],
      documents: [changePackage(), approval()],
    });
    expect(result.result).toBe("fail");
    expect(result.evaluations).toContainEqual(expect.objectContaining({
      ruleId: "required-artifacts",
      outcome: "fail",
    }));
  });

  it("does not require approval when the profile mode is none", () => {
    const profile = workflowProfile({
      spec: {
        phases: [{
          phase: "requirements",
          required: true,
          requiredArtifactTypes: ["requirement-spec"],
          requiredTraceRelations: [],
          humanApproval: "none",
          minimumApprovals: 0,
          enabledRuleIds: ["graph-integrity", "required-artifacts"],
        }],
      },
    });
    expect(evaluateGate({
      package: changePackage(),
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies: [gatePolicy()],
      documents: [changePackage(), artifactEnvelope()],
    }).result).toBe("pass");
  });

  it("does not count an expired approval", () => {
    const result = evaluateGate({
      package: changePackage(),
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile: workflowProfile(),
      policies: [gatePolicy()],
      documents: [
        changePackage(),
        artifactEnvelope(),
        approval({ spec: { expiresAt: "2026-06-11T11:59:59.000Z" } }),
      ],
    });
    expect(result.evaluations).toContainEqual(expect.objectContaining({
      ruleId: "required-approvals",
      outcome: "fail",
    }));
  });

  it("fails when a blocking finding remains open", () => {
    const result = evaluateGate({
      package: changePackage(),
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile: workflowProfile(),
      policies: [gatePolicy()],
      documents: [
        changePackage(),
        artifactEnvelope(),
        approval(),
        finding({ spec: { severity: "blocking", status: "open" } }),
      ],
    });
    expect(result.evaluations).toContainEqual(expect.objectContaining({
      ruleId: "no-open-blocking-findings",
      outcome: "fail",
    }));
  });

  it("uses the latest child gate attempt rather than any historical pass", () => {
    const child = changePackage({ metadata: { id: "CHG-TASK-CHILD" } });
    const parent = changePackage({
      metadata: { id: "CHG-FEAT-PARENT" },
      spec: {
        relationships: [{
          relation: "decomposes-into",
          target: {
            kind: "ChangePackage",
            id: child.metadata.id,
            revision: child.metadata.revision,
            digest: digestDocument(child),
          },
        }],
      },
    });
    const result = evaluateGate({
      package: parent,
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile: workflowProfile(),
      policies: [gatePolicy()],
      documents: [
        parent,
        child,
        artifactEnvelope({ spec: { packageId: parent.metadata.id } }),
        approval({ spec: { packageId: parent.metadata.id } }),
        gateAttempt({ metadata: { id: "GATE-CHILD-1", revision: 1 }, spec: { packageId: child.metadata.id, result: "pass" } }),
        gateAttempt({ metadata: { id: "GATE-CHILD-2", revision: 2 }, spec: { packageId: child.metadata.id, result: "fail" } }),
      ],
    });
    expect(result.evaluations).toContainEqual(expect.objectContaining({
      ruleId: "child-gates-pass",
      outcome: "fail",
    }));
  });

  it("errors when the profile enables an undefined rule", () => {
    const profile = workflowProfile({
      spec: {
        phases: [{
          phase: "requirements",
          required: true,
          requiredArtifactTypes: [],
          requiredTraceRelations: [],
          humanApproval: "none",
          minimumApprovals: 0,
          enabledRuleIds: ["missing-rule"],
        }],
      },
    });
    expect(evaluateGate({
      package: changePackage(),
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies: [gatePolicy()],
      documents: [changePackage(), artifactEnvelope(), approval()],
    }).result).toBe("error");
  });

  it("reports but does not fail a non-blocking rule", () => {
    const policy = gatePolicy({
      spec: {
        rules: [{ id: "required-approvals", type: "required-approvals", blocking: false }],
      },
    });
    const profile = workflowProfile({
      spec: {
        phases: [{
          phase: "requirements",
          required: true,
          requiredArtifactTypes: [],
          requiredTraceRelations: [],
          humanApproval: "conditional",
          minimumApprovals: 1,
          enabledRuleIds: ["required-approvals"],
        }],
      },
    });
    const result = evaluateGate({
      package: changePackage(),
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies: [policy],
      documents: [changePackage()],
    });
    expect(result.result).toBe("pass");
    expect(result.evaluations[0]).toMatchObject({ blocking: false, outcome: "fail" });
  });
});
