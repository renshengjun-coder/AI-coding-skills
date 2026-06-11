import { describe, expect, it } from "vitest";
import { sha256Digest } from "../../src/kernel/canonical/canonicalize.js";
import { validateGraphIntegrity } from "../../src/kernel/graph/evidence-graph.js";
import { artifactEnvelope, changePackage } from "../fixtures/builders.js";

describe("trace graph integrity", () => {
  it("accepts artifact envelope trace edges that bind content digests", () => {
    const requirements = artifactEnvelope({
      metadata: { id: "ART-REQ-TRACE" },
      spec: { phase: "requirements", artifactType: "requirement-spec" },
    });
    const designMarkdown = "# Design\n\nDerived from requirements.";
    const design = artifactEnvelope({
      metadata: { id: "ART-DES-TRACE" },
      spec: {
        phase: "design",
        artifactType: "design-document",
        content: { path: "design.md", digest: sha256Digest(designMarkdown) },
        trace: [{
          relation: "derives-from",
          source: {
            kind: "ArtifactEnvelope",
            id: "ART-DES-TRACE",
            revision: 1,
            digest: sha256Digest(designMarkdown),
          },
          target: {
            kind: "ArtifactEnvelope",
            id: "ART-REQ-TRACE",
            revision: 1,
            digest: requirements.spec.content.digest,
          },
        }],
      },
    });

    expect(validateGraphIntegrity([changePackage(), requirements, design])).toEqual([]);
  });
});
