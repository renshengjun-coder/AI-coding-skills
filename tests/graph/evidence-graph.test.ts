import { describe, expect, it } from "vitest";
import { digestDocument } from "../../src/kernel/canonical/canonicalize.js";
import {
  buildEvidenceGraph,
  validateGraphIntegrity,
} from "../../src/kernel/graph/evidence-graph.js";
import { artifactEnvelope, changePackage } from "../fixtures/builders.js";

describe("evidence graph", () => {
  it("indexes exact document revisions", () => {
    const document = changePackage();
    const graph = buildEvidenceGraph([document]);
    expect(graph.byKey.get("ChangePackage:CHG-TASK-0001@1")).toEqual(document);
  });

  it("reports duplicate exact revisions", () => {
    const document = changePackage();
    const issues = validateGraphIntegrity([document, structuredClone(document)]);
    expect(issues).toContainEqual(expect.objectContaining({ ruleId: "duplicate-document" }));
  });

  it("reports unresolved exact evidence references", () => {
    const artifact = artifactEnvelope({
      spec: {
        inputs: [{
          kind: "ArtifactEnvelope",
          id: "ART-MISSING",
          revision: 1,
          digest: `sha256:${"1".repeat(64)}`,
        }],
      },
    });
    const issues = validateGraphIntegrity([changePackage(), artifact]);
    expect(issues).toContainEqual(expect.objectContaining({ ruleId: "unresolved-reference" }));
  });

  it("reports artifacts whose owning package is missing", () => {
    const issues = validateGraphIntegrity([artifactEnvelope()]);
    expect(issues).toContainEqual(expect.objectContaining({ ruleId: "missing-package" }));
  });

  it("reports evidence-reference digest mismatches", () => {
    const requirement = artifactEnvelope();
    const design = artifactEnvelope({
      metadata: { id: "ART-DES-0001" },
      spec: {
        phase: "design",
        artifactType: "design-document",
        inputs: [{
          kind: "ArtifactEnvelope",
          id: requirement.metadata.id,
          revision: requirement.metadata.revision,
          digest: `sha256:${"0".repeat(64)}`,
        }],
      },
    });
    expect(validateGraphIntegrity([changePackage(), requirement, design]))
      .toContainEqual(expect.objectContaining({ ruleId: "digest-mismatch" }));
  });

  it("accepts a resolved exact reference with the current digest", () => {
    const requirement = artifactEnvelope();
    const design = artifactEnvelope({
      metadata: { id: "ART-DES-0001" },
      spec: {
        phase: "design",
        artifactType: "design-document",
        inputs: [{
          kind: "ArtifactEnvelope",
          id: requirement.metadata.id,
          revision: requirement.metadata.revision,
          digest: requirement.spec.content.digest,
        }],
      },
    });
    expect(validateGraphIntegrity([changePackage(), requirement, design])).toEqual([]);
  });

  it("reports parent-child package cycles", () => {
    const parent = changePackage({ metadata: { id: "CHG-FEAT-1" } });
    const child = changePackage({ metadata: { id: "CHG-TASK-1" } });
    parent.spec.relationships = [{
      relation: "decomposes-into",
      target: {
        kind: "ChangePackage",
        id: child.metadata.id,
        revision: 1,
        digest: digestDocument(child),
      },
    }];
    child.spec.relationships = [{
      relation: "decomposes-into",
      target: {
        kind: "ChangePackage",
        id: parent.metadata.id,
        revision: 1,
        digest: digestDocument(parent),
      },
    }];
    expect(validateGraphIntegrity([parent, child]))
      .toContainEqual(expect.objectContaining({ ruleId: "package-cycle" }));
  });
});
