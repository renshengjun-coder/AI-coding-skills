import { describe, expect, it } from "vitest";
import { KERNEL_API_VERSION } from "../src/kernel/index.js";

describe("contract kernel", () => {
  it("exports its stable API version", () => {
    expect(KERNEL_API_VERSION).toBe("loop.dev/v1");
  });
});
