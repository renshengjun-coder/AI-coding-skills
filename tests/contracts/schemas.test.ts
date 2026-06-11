import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { renderSchemas, schemasByKind } from "../../src/kernel/contracts/schemas.js";
import { CONTRACT_KINDS } from "../../src/kernel/contracts/vocabulary.js";

type Schema = Record<string, unknown>;

const propertiesOf = (schema: Schema): Record<string, Schema> =>
  schema.properties as Record<string, Schema>;

const propertyOf = (schema: Schema, name: string): Schema => {
  const property = propertiesOf(schema)[name];
  if (property === undefined) {
    throw new Error(`Schema property is missing: ${name}`);
  }
  return property;
};

const nestedSchemas = (value: unknown): Schema[] => {
  if (Array.isArray(value)) {
    return value.flatMap(nestedSchemas);
  }
  if (typeof value !== "object" || value === null) {
    return [];
  }

  const schema = value as Schema;
  return [schema, ...Object.values(schema).flatMap(nestedSchemas)];
};

const specOf = (kind: keyof typeof schemasByKind): Schema =>
  propertyOf(schemasByKind[kind], "spec");

describe("generated contract schemas", () => {
  it("defines one closed draft 2020-12 schema for every contract kind", () => {
    expect(Object.keys(schemasByKind).sort()).toEqual([...CONTRACT_KINDS].sort());

    for (const schema of Object.values(schemasByKind)) {
      expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      for (const nested of nestedSchemas(schema).filter((candidate) => candidate.type === "object")) {
        expect(nested.additionalProperties).toBe(false);
      }
    }
  });

  it("restricts package and artifact references to their exact document kinds", () => {
    const relationships = propertyOf(specOf("ChangePackage"), "relationships");
    const packageTarget = propertyOf(relationships.items as Schema, "target");
    expect(propertiesOf(packageTarget).kind).toEqual({ const: "ChangePackage" });

    const artifactSpec = specOf("ArtifactEnvelope");
    const inputs = propertyOf(artifactSpec, "inputs");
    const artifactRef = inputs.items as Schema;
    expect(propertiesOf(artifactRef).kind).toEqual({ const: "ArtifactEnvelope" });
  });

  it("requires artifact content to have a digest and either a path or URL", () => {
    const content = propertyOf(specOf("ArtifactEnvelope"), "content");
    expect(content.required).toEqual(["digest"]);
    expect(content.anyOf).toEqual([{ required: ["path"] }, { required: ["url"] }]);
    expect(content.additionalProperties).toBe(false);
  });

  it("requires blocking on every rule evaluation", () => {
    const evaluations = propertyOf(specOf("GateAttempt"), "evaluations");
    const ruleEvaluation = evaluations.items as Schema;
    expect(ruleEvaluation.required).toContain("blocking");
    expect(propertiesOf(ruleEvaluation).blocking).toEqual({ type: "boolean" });
  });

  it("keeps committed schema files synchronized with source definitions", async () => {
    for (const [filename, expected] of Object.entries(renderSchemas())) {
      const actual = await readFile(`.loop/schemas/v1/${filename}`, "utf8");
      expect(actual).toBe(expected);
    }
  });
});
