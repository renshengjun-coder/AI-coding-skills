import { describe, expect, it } from "vitest";
import {
  assertValidDocument,
  validateDocument,
} from "../../src/kernel/validation/schema-registry.js";
import { changePackage, DIGEST_A, validDocuments } from "../fixtures/builders.js";

describe("validateDocument", () => {
  it("accepts a valid fixture for every contract kind", () => {
    for (const document of validDocuments()) {
      expect(validateDocument(document)).toEqual({ valid: true, issues: [] });
    }
  });

  it("rejects an invalid fixture for every contract kind", () => {
    for (const document of validDocuments()) {
      const invalid = structuredClone(document) as unknown as Record<string, unknown>;
      delete invalid.apiVersion;

      const result = validateDocument(invalid);

      expect(result.valid).toBe(false);
      expect(result.issues[0]?.keyword).toBe("required");
    }
  });

  it("rejects an unsupported kind before schema lookup", () => {
    const result = validateDocument({ apiVersion: "loop.dev/v1", kind: "Other" });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.keyword).toBe("kind");
  });

  it("asserts valid documents and reports all invalid-document issues", () => {
    expect(() => assertValidDocument(changePackage())).not.toThrow();
    expect(() => assertValidDocument({ kind: "Other" })).toThrow(
      "/kind: unsupported contract kind",
    );
  });

  it("requires package relationships to target change packages", () => {
    const result = validateDocument(
      changePackage({
        spec: {
          relationships: [
            {
              relation: "depends-on",
              target: { kind: "Approval", id: "APR-1", revision: 1, digest: DIGEST_A },
            },
          ],
        },
      } as never),
    );

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ path: expect.stringContaining("/kind") }),
    );
  });
});
