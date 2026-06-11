import { describe, expect, it } from "vitest";
import { digestDocument } from "../../src/kernel/canonical/canonicalize.js";
import { evaluateFreshness } from "../../src/kernel/freshness/evaluate-freshness.js";
import { evaluateGate } from "../../src/kernel/policy/evaluate-gate.js";
import {
  artifactEnvelope,
  changePackage,
  gateAttempt,
  gatePolicy,
  workflowProfile,
} from "../fixtures/builders.js";

describe("evaluateFreshness", () => {
  it("is fresh when every bound exact revision and digest matches", () => {
    const artifact = artifactEnvelope();
    const gate = gateAttempt({
      spec: {
        boundEvidence: [{
          kind: artifact.kind,
          id: artifact.metadata.id,
          revision: artifact.metadata.revision,
          digest: digestDocument(artifact),
        }],
      },
    });
    expect(evaluateFreshness(gate, [artifact])).toEqual({ status: "fresh", issues: [] });
  });

  it("is stale when a bound document digest changes", () => {
    const artifact = artifactEnvelope();
    const gate = gateAttempt({
      spec: {
        boundEvidence: [{
          kind: artifact.kind,
          id: artifact.metadata.id,
          revision: artifact.metadata.revision,
          digest: digestDocument(artifact),
        }],
      },
    });
    const changed = artifactEnvelope({ spec: { content: { digest: `sha256:${"9".repeat(64)}` } } });
    expect(evaluateFreshness(gate, [changed]).status).toBe("stale");
  });

  it("is stale when a bound document is missing", () => {
    const gate = gateAttempt({
      spec: {
        boundEvidence: [{
          kind: "ArtifactEnvelope",
          id: "ART-MISSING",
          revision: 1,
          digest: `sha256:${"1".repeat(64)}`,
        }],
      },
    });
    expect(evaluateFreshness(gate, []).status).toBe("stale");
  });

  it("prevents a parent gate from accepting a stale child pass", () => {
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
    const childArtifact = artifactEnvelope({ spec: { packageId: child.metadata.id } });
    const staleChildGate = gateAttempt({
      spec: {
        packageId: child.metadata.id,
        result: "pass",
        boundEvidence: [{
          kind: childArtifact.kind,
          id: childArtifact.metadata.id,
          revision: childArtifact.metadata.revision,
          digest: `sha256:${"0".repeat(64)}`,
        }],
      },
    });
    const profile = workflowProfile({
      spec: {
        phases: [{
          phase: "requirements",
          required: true,
          requiredArtifactTypes: [],
          requiredTraceRelations: [],
          humanApproval: "none",
          minimumApprovals: 0,
          enabledRuleIds: ["child-gates-pass"],
        }],
      },
    });
    const result = evaluateGate({
      package: parent,
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies: [gatePolicy()],
      documents: [parent, child, childArtifact, staleChildGate],
    });
    expect(result.evaluations).toContainEqual(expect.objectContaining({
      ruleId: "child-gates-pass",
      outcome: "fail",
    }));
  });
});
