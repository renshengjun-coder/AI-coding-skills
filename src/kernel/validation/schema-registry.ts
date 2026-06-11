import Ajv2020Module, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { schemasByKind } from "../contracts/schemas.js";
import type { AnyDocument, ContractDocument } from "../contracts/types.js";
import { isContractKind, type ContractKind } from "../contracts/vocabulary.js";

export interface ValidationIssue {
  path: string;
  keyword: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

const ajv = new Ajv2020Module.default({ allErrors: true, ownProperties: true, strict: true });
addFormatsModule.default(ajv);

const validators = new Map<ContractKind, ValidateFunction>();
for (const [kind, schema] of Object.entries(schemasByKind)) {
  validators.set(kind as ContractKind, ajv.compile(schema));
}

const issueFromError = (error: ErrorObject): ValidationIssue => ({
  path: error.instancePath || "/",
  keyword: error.keyword,
  message: error.message ?? "schema validation failed",
});

export function validateDocument(value: unknown): ValidationResult {
  const candidate = value as Partial<ContractDocument<ContractKind, unknown>> | null;
  if (!isContractKind(candidate?.kind)) {
    return {
      valid: false,
      issues: [{ path: "/kind", keyword: "kind", message: "unsupported contract kind" }],
    };
  }

  const validator = validators.get(candidate.kind);
  if (!validator) {
    return {
      valid: false,
      issues: [{ path: "/kind", keyword: "kind", message: "missing schema validator" }],
    };
  }

  if (validator(value)) {
    return { valid: true, issues: [] };
  }

  return { valid: false, issues: (validator.errors ?? []).map(issueFromError) };
}

export function assertValidDocument(value: unknown): asserts value is AnyDocument {
  const result = validateDocument(value);
  if (!result.valid) {
    throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  }
}
