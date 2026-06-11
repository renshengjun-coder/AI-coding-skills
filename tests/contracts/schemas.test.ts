import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ajv2020Module from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { describe, expect, it } from "vitest";
import { generateSchemas } from "../../scripts/generate-schemas.js";
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

  it("compiles every schema with Ajv2020 strict mode", () => {
    const ajv = new Ajv2020Module.default({ strict: true });
    addFormatsModule.default(ajv);

    for (const schema of Object.values(schemasByKind)) {
      expect(() => ajv.compile(schema)).not.toThrow();
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
    const alternatives = content.anyOf as Schema[];
    expect(alternatives.map((alternative) => alternative.required)).toEqual([
      ["path", "digest"],
      ["url", "digest"],
    ]);
    expect(alternatives.every((alternative) => alternative.additionalProperties === false)).toBe(true);
  });

  it("requires blocking on every rule evaluation", () => {
    const evaluations = propertyOf(specOf("GateAttempt"), "evaluations");
    const ruleEvaluation = evaluations.items as Schema;
    expect(ruleEvaluation.required).toContain("blocking");
    expect(propertiesOf(ruleEvaluation).blocking).toEqual({ type: "boolean" });
  });

  it("keeps committed schema files synchronized with source definitions", async () => {
    const rendered = renderSchemas();
    const committedFilenames = (await readdir(".loop/schemas/v1"))
      .filter((filename) => filename.endsWith(".schema.json"))
      .sort();
    expect(committedFilenames).toEqual(Object.keys(rendered).sort());

    for (const [filename, expected] of Object.entries(rendered)) {
      const actual = await readFile(`.loop/schemas/v1/${filename}`, "utf8");
      expect(actual).toBe(expected);
    }
  });

  it("removes stale managed schemas while preserving unrelated files", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "loop-schemas-"));
    try {
      await writeFile(join(outputDirectory, "stale.schema.json"), "{}\n", "utf8");
      await writeFile(join(outputDirectory, "README.md"), "keep\n", "utf8");

      await generateSchemas(outputDirectory);

      expect((await readdir(outputDirectory)).sort()).toEqual([
        "README.md",
        ...Object.keys(renderSchemas()).sort(),
      ]);
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });
});
