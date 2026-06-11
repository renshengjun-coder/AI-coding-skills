import { describe, expect, it } from "vitest";
import { runLifecycleLoopGateEvaluation } from "../../src/lifecycle-loop/final-evaluation.js";
import {
  approval,
  artifactEnvelope,
  changePackage,
  classificationDecision,
  gatePolicy,
  waiver,
  workflowProfile,
} from "../fixtures/builders.js";

const profile = workflowProfile();
const policies = [gatePolicy()];

describe("lifecycle loop final evaluation", () => {
  it("fails when phase artifact self-check did not pass", () => {
    const pkg = changePackage();
    const artifact = artifactEnvelope({
      spec: {
        packageId: pkg.metadata.id,
        phase: "requirements",
        selfCheck: { result: "fail", findingIds: ["FND-0001"] },
      },
    });
    const result = runLifecycleLoopGateEvaluation({
      package: pkg,
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies,
      documents: [pkg, artifact],
    });
    expect(result.result).toBe("fail");
    expect(result.evaluations.some((item) => item.ruleId === "lifecycle-phase-self-check" && item.outcome === "fail")).toBe(true);
  });

  it("passes requirements gate with artifact, approval, and passing self-check", () => {
    const pkg = changePackage();
    const artifact = artifactEnvelope({ spec: { packageId: pkg.metadata.id, phase: "requirements" } });
    const apr = approval({ spec: { packageId: pkg.metadata.id, phase: "requirements" } });
    const result = runLifecycleLoopGateEvaluation({
      package: pkg,
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies,
      documents: [pkg, artifact, apr],
    });
    expect(result.result).toBe("pass");
  });

  it("marks gate waived when active waiver covers blocking failures", () => {
    const pkg = changePackage();
    const artifact = artifactEnvelope({ spec: { packageId: pkg.metadata.id, phase: "requirements" } });
    const wvr = waiver({
      spec: {
        packageId: pkg.metadata.id,
        phase: "requirements",
        conditionId: "required-approvals",
        expiresAt: "2026-06-12T00:00:00.000Z",
      },
    });
    const result = runLifecycleLoopGateEvaluation({
      package: pkg,
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies,
      documents: [pkg, artifact, wvr],
    });
    expect(result.result).toBe("waived");
  });

  it("requires escalation approval after classification override", () => {
    const pkg = changePackage();
    const artifact = artifactEnvelope({ spec: { packageId: pkg.metadata.id, phase: "requirements" } });
    const cls = classificationDecision({
      spec: {
        packageId: pkg.metadata.id,
        override: { actor: "lead@example.com", reason: "Pilot override" },
      },
    });
    const withoutApproval = runLifecycleLoopGateEvaluation({
      package: pkg,
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies,
      documents: [pkg, artifact, cls],
    });
    expect(withoutApproval.escalations.some((item) => item.trigger === "classification-override")).toBe(true);
    expect(withoutApproval.result).toBe("fail");

    const apr = approval({ spec: { packageId: pkg.metadata.id, phase: "requirements" } });
    const withApproval = runLifecycleLoopGateEvaluation({
      package: pkg,
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies,
      documents: [pkg, artifact, cls, apr],
    });
    expect(withApproval.result).toBe("pass");
  });

  it("recommends controlled re-entry when gate fails without exhausting budget", () => {
    const pkg = changePackage();
    const result = runLifecycleLoopGateEvaluation({
      package: pkg,
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies,
      documents: [pkg],
    });
    expect(result.result).toBe("fail");
    expect(result.reentry?.phase).toBe("requirements");
    expect(result.reentry?.reason).toContain("re-run");
  });
});
