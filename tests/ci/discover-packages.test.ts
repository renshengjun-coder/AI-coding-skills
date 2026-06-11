import { describe, expect, it } from "vitest";
import { discoverPackageIdsFromPaths } from "../../src/ci/discover-packages.js";

describe("discoverPackageIdsFromPaths", () => {
  it("extracts package ids from loop package paths", () => {
    expect(discoverPackageIdsFromPaths([
      ".loop/packages/CHG-FEAT-0001/package.yaml",
      ".loop/packages/CHG-FEAT-0001/artifacts/requirements.md",
      "src/kernel/index.ts",
    ])).toEqual(["CHG-FEAT-0001"]);
  });

  it("returns sorted unique ids", () => {
    expect(discoverPackageIdsFromPaths([
      ".loop/packages/CHG-TASK-0002/gates/GATE-0001@1.yaml",
      ".loop/packages/CHG-FEAT-0001/package.yaml",
      ".loop/packages/CHG-FEAT-0001/findings/FND-0001@1.yaml",
    ])).toEqual(["CHG-FEAT-0001", "CHG-TASK-0002"]);
  });
});
