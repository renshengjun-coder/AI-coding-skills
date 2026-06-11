import { describe, expect, it } from "vitest";
import {
  canonicalize,
  digestDocument,
  sha256Digest,
} from "../../src/kernel/canonical/canonicalize.js";
import { changePackage } from "../fixtures/builders.js";

describe("canonicalize", () => {
  it("sorts object keys recursively while preserving array order", () => {
    expect(canonicalize({ z: 1, a: { y: 2, x: 3 }, list: [2, 1] })).toBe(
      '{"a":{"x":3,"y":2},"list":[2,1],"z":1}',
    );
  });

  it("gives formatting- and key-order-independent SHA-256 digests", () => {
    const compact = JSON.parse('{"b":2,"a":{"d":4,"c":3}}') as unknown;
    const formatted = JSON.parse(`{
      "a": {
        "c": 3,
        "d": 4
      },
      "b": 2
    }`) as unknown;

    expect(sha256Digest(compact)).toBe(sha256Digest(formatted));
    expect(sha256Digest(compact)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it.each([
    ["NaN", { value: Number.NaN }, "finite"],
    ["positive infinity", { value: Number.POSITIVE_INFINITY }, "finite"],
    ["undefined object property", { value: undefined }, "JSON-compatible"],
    ["undefined array element", [undefined], "JSON-compatible"],
    ["a sparse array", Array(1), "JSON-compatible"],
    ["a bigint", { value: 1n }, "JSON-compatible"],
    ["a function", { value: () => "not JSON" }, "JSON-compatible"],
    ["a symbol", { value: Symbol("not JSON") }, "JSON-compatible"],
    ["a date", { value: new Date("2026-06-11T00:00:00.000Z") }, "plain object"],
  ])("rejects %s", (_label, value, message) => {
    expect(() => canonicalize(value)).toThrow(message);
  });

  it("rejects cyclic values", () => {
    const value: Record<string, unknown> = {};
    value.self = value;

    expect(() => canonicalize(value)).toThrow("cyclic");
  });

  it("rejects accessor-backed array elements", () => {
    const value: unknown[] = [];
    Object.defineProperty(value, "0", {
      enumerable: true,
      get: () => "computed",
    });
    value.length = 1;

    expect(() => canonicalize(value)).toThrow("data properties");
  });

  it("digests a complete contract document", () => {
    expect(digestDocument(changePackage())).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
