import { extname } from "node:path";
import { parse } from "yaml";
import type { AnyDocument } from "../contracts/types.js";
import { validateDocument } from "../validation/schema-registry.js";

export function loadDocument(content: string, sourceName: string): AnyDocument {
  const extension = extname(sourceName).toLowerCase();
  if (![".json", ".yaml", ".yml"].includes(extension)) {
    throw new Error(
      `${sourceName}: unsupported document extension "${extension || "(none)"}"; expected .json, .yaml, or .yml`,
    );
  }

  let value: unknown;
  try {
    value = extension === ".json" ? JSON.parse(content) : parse(content);
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
