import { createHash } from "node:crypto";
import type { AnyDocument, Digest } from "../contracts/types.js";

/** Maximum number of elements accepted in canonical arrays. */
export const MAX_CANONICAL_ARRAY_LENGTH = 10_000;
/** Maximum number of nested object or array containers, including the root container. */
export const MAX_CANONICAL_NESTING_DEPTH = 100;

function incompatible(detail?: string): TypeError {
  return new TypeError(`values must be JSON-compatible${detail ? `: ${detail}` : ""}`);
}

function assertUnicodeScalarString(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (index + 1 >= value.length || nextCodeUnit < 0xdc00 || nextCodeUnit > 0xdfff) {
        throw incompatible("strings must contain only Unicode scalar values");
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw incompatible("strings must contain only Unicode scalar values");
    }
  }
}

function serializeString(value: string): string {
  assertUnicodeScalarString(value);
  return JSON.stringify(value);
}

function isArrayIndex(name: string, length: number): boolean {
  if (!/^(0|[1-9]\d*)$/.test(name)) return false;
  const index = Number(name);
  return Number.isSafeInteger(index) && index < length;
}

function serializeArray(value: unknown[], ancestors: WeakSet<object>, depth: number): string {
  if (value.length > MAX_CANONICAL_ARRAY_LENGTH) {
    throw incompatible(`arrays must contain at most ${MAX_CANONICAL_ARRAY_LENGTH} elements`);
  }

  const ownNames = Object.getOwnPropertyNames(value);
  const elementNames = ownNames.filter((name) => name !== "length");
  if (
    elementNames.length !== value.length ||
    elementNames.some((name) => !isArrayIndex(name, value.length)) ||
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
    elements.push(serialize(descriptor.value, ancestors, depth + 1));
  }
  return `[${elements.join(",")}]`;
}

function serializeObject(value: object, ancestors: WeakSet<object>, depth: number): string {
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
    members.push(`${serializeString(key)}:${serialize(descriptor.value, ancestors, depth + 1)}`);
  }
  return `{${members.join(",")}}`;
}

function serialize(value: unknown, ancestors: WeakSet<object>, depth: number): string {
  if (value === null) return "null";
  if (typeof value === "string") return serializeString(value);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("numbers must be finite");
    return JSON.stringify(value);
  }
  if (typeof value !== "object") throw incompatible();
  if (depth >= MAX_CANONICAL_NESTING_DEPTH) {
    throw incompatible(`nesting depth must not exceed ${MAX_CANONICAL_NESTING_DEPTH}`);
  }
  if (ancestors.has(value)) throw incompatible("cyclic values are not supported");

  ancestors.add(value);
  try {
    return Array.isArray(value)
      ? serializeArray(value, ancestors, depth)
      : serializeObject(value, ancestors, depth);
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalize(value: unknown): string {
  return serialize(value, new WeakSet(), 0);
}

export function sha256Digest(value: unknown): Digest {
  const hash = createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
  return `sha256:${hash}`;
}

export function digestDocument(document: AnyDocument): Digest {
  return sha256Digest(document);
}
