import { parse } from "yaml";
import type { AnyDocument } from "../contracts/types.js";
import { validateDocument } from "../validation/schema-registry.js";

export function loadDocument(content: string, sourceName: string): AnyDocument {
  let value: unknown;
  try {
    value = sourceName.endsWith(".json") ? JSON.parse(content) : parse(content);
  } catch (error) {
    throw new Error(`${sourceName}: unable to parse document`, { cause: error });
  }

  const result = validateDocument(value);
  if (!result.valid) {
    const details = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new Error(`${sourceName}: invalid contract document: ${details}`);
  }

  return value as AnyDocument;
}
