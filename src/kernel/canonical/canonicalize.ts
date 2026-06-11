import { createHash } from "node:crypto";
import type { AnyDocument, Digest } from "../contracts/types.js";

function incompatible(detail?: string): TypeError {
  return new TypeError(`values must be JSON-compatible${detail ? `: ${detail}` : ""}`);
}

function serializeString(value: string): string {
  return JSON.stringify(value);
}

function serializeArray(value: unknown[], ancestors: WeakSet<object>): string {
  const expectedNames = new Set(["length"]);
  for (let index = 0; index < value.length; index += 1) expectedNames.add(String(index));

  if (
    Object.getOwnPropertyNames(value).some((name) => !expectedNames.has(name)) ||
    Object.getOwnPropertySymbols(value).length > 0
  ) {
    throw incompatible("arrays must be dense and contain no extra properties");
  }

  const elements: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable) {
      throw incompatible("arrays must be dense and contain no extra properties");
    }
    if (!("value" in descriptor)) {
      throw incompatible("array elements must be enumerable data properties");
    }
    elements.push(serialize(descriptor.value, ancestors));
  }
  return `[${elements.join(",")}]`;
}

function serializeObject(value: object, ancestors: WeakSet<object>): string {
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) {
    throw incompatible("objects must be plain objects");
  }

  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw incompatible("object keys must be strings");
  }

  const members: string[] = [];
  for (const key of Object.getOwnPropertyNames(value).sort()) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      throw incompatible("object properties must be enumerable data properties");
    }
    members.push(`${serializeString(key)}:${serialize(descriptor.value, ancestors)}`);
  }
  return `{${members.join(",")}}`;
}

function serialize(value: unknown, ancestors: WeakSet<object>): string {
  if (value === null) return "null";
  if (typeof value === "string") return serializeString(value);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("numbers must be finite");
    return JSON.stringify(value);
  }
  if (typeof value !== "object") throw incompatible();
  if (ancestors.has(value)) throw incompatible("cyclic values are not supported");

  ancestors.add(value);
  try {
    return Array.isArray(value)
      ? serializeArray(value, ancestors)
      : serializeObject(value, ancestors);
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalize(value: unknown): string {
  return serialize(value, new WeakSet());
}

export function sha256Digest(value: unknown): Digest {
  const hash = createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
  return `sha256:${hash}`;
}

export function digestDocument(document: AnyDocument): Digest {
  return sha256Digest(document);
}
