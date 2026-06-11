import { describe, expect, it } from "vitest";
import {
  digestDocument,
  evaluateFreshness,
  evaluateGate,
  validateDocument,
  validateGraphIntegrity,
} from "../../src/kernel/index.js";
import {
  approval,
  artifactEnvelope,
  changePackage,
  gateAttempt,
  gatePolicy,
  workflowProfile,
} from "../fixtures/builders.js";

describe("contract kernel integration", () => {
  it("validates, evaluates, records, and invalidates a phase gate", () => {
    const packageDocument = changePackage();
    const requirement = artifactEnvelope();
    const reviewerApproval = approval();
    const profile = workflowProfile();
    const policy = gatePolicy();
    const documents = [packageDocument, requirement, reviewerApproval, profile, policy];

    for (const document of documents) expect(validateDocument(document).valid).toBe(true);
    expect(validateGraphIntegrity(documents)).toEqual([]);

    const evaluation = evaluateGate({
      package: packageDocument,
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies: [policy],
      documents,
    });
    expect(evaluation.result).toBe("pass");

    const gate = gateAttempt({
      spec: {
        boundEvidence: documents.map((document) => ({
          kind: document.kind,
          id: document.metadata.id,
          revision: document.metadata.revision,
          digest: digestDocument(document),
        })),
        evaluations: evaluation.evaluations,
        result: evaluation.result,
      },
    });
    expect(evaluateFreshness(gate, documents).status).toBe("fresh");

    const changedRequirement = artifactEnvelope({
      spec: { content: { digest: `sha256:${"f".repeat(64)}` } },
    });
    expect(evaluateFreshness(gate, [
      packageDocument,
      changedRequirement,
      reviewerApproval,
      profile,
      policy,
    ]).status).toBe("stale");
  });
});
