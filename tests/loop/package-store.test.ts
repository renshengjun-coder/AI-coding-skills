import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLinkPackage } from "../../src/cli/commands/link.js";
import { runStart } from "../../src/cli/commands/start.js";
import {
  listPackageIds,
  loadPackageBundle,
  loadPackageContext,
  resolveLoopRoot,
} from "../../src/loop/package-store.js";
import { createTestLoopRoot } from "./test-loop-root.js";

describe("package store", () => {
  let tempRoot: string;

  afterEach(async () => {
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
  });

  async function setupRepo(): Promise<string> {
    tempRoot = await mkdtemp(join(tmpdir(), "loop-store-"));
    const loopSeed = await createTestLoopRoot();
    await cp(loopSeed, join(tempRoot, ".loop"), { recursive: true });
    await rm(loopSeed, { recursive: true, force: true });
    return tempRoot;
  }

  it("creates and loads a package layout", async () => {
    const baseDir = await setupRepo();
    const start = await runStart({
      baseDir,
      type: "feature",
      title: "Pilot feature",
      owner: "team-a",
      profileId: "standard",
    });
    expect(start.code).toBe(0);

    const ids = await listPackageIds(resolveLoopRoot(baseDir));
    expect(ids).toEqual(["CHG-FEAT-0001"]);

    const bundle = await loadPackageBundle(resolveLoopRoot(baseDir), "CHG-FEAT-0001");
    expect(bundle.package.spec.title).toBe("Pilot feature");
    expect(bundle.documents.length).toBe(1);
  });

  it("loads child packages in context", async () => {
    const baseDir = await setupRepo();
    await runStart({ baseDir, type: "feature", title: "Parent", owner: "team-a", profileId: "standard", packageId: "CHG-FEAT-0001" });
    await runStart({ baseDir, type: "development-task", title: "Child", owner: "team-a", profileId: "routine", packageId: "CHG-TASK-0001" });
    await runLinkPackage({
      baseDir,
      fromPackageId: "CHG-FEAT-0001",
      toPackageId: "CHG-TASK-0001",
      relation: "decomposes-into",
    });

    const context = await loadPackageContext(resolveLoopRoot(baseDir), "CHG-FEAT-0001");
    expect(context.bundles.length).toBe(2);
    expect(context.documents.some((document) => document.metadata.id === "CHG-TASK-0001")).toBe(true);
  });
});
