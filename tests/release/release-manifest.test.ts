import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Digest } from "../../src/kernel/contracts/types.js";
import { runStart } from "../../src/cli/commands/start.js";
import {
  buildReleaseManifest,
  manifestDigest,
  readReleaseManifest,
  validateReleaseManifest,
  writeReleaseManifest,
} from "../../src/release/release-manifest.js";
import { createTestLoopRoot } from "../loop/test-loop-root.js";

describe("release manifest", () => {
  it("builds a hashed manifest with subject digests", async () => {
    const temp = await mkdtemp(join(tmpdir(), "release-manifest-"));
    try {
      const loopSeed = await createTestLoopRoot();
      await cp(loopSeed, join(temp, ".loop"), { recursive: true });
      await rm(loopSeed, { recursive: true, force: true });
      const packageId = "CHG-FEAT-REL1";
      await runStart({
        baseDir: temp,
        type: "feature",
        title: "Release manifest test",
        owner: "platform-team",
        profileId: "routine",
        packageId,
      });
      await writeFile(join(temp, "package.json"), '{"name":"test"}\n', "utf8");
      await mkdir(join(temp, "dist"), { recursive: true });
      await writeFile(join(temp, "dist", "index.js"), "export {}\n", "utf8");

      const manifest = await buildReleaseManifest({
        packageId,
        baseDir: temp,
        gitCommit: "abc123",
        subjectRoots: ["package.json", "dist"],
      });

      expect(manifest.kind).toBe("ReleaseManifest");
      expect(manifest.subjects.length).toBeGreaterThanOrEqual(2);
      expect(manifest.manifestDigest).toMatch(/^sha256:/);
      validateReleaseManifest(manifest);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("writes and reads manifest with digest validation", async () => {
    const temp = await mkdtemp(join(tmpdir(), "release-manifest-"));
    try {
      const manifest = {
        apiVersion: "loop.dev/v1" as const,
        kind: "ReleaseManifest" as const,
        packageId: "CHG-FEAT-TEST",
        createdAt: "2026-06-11T12:00:00.000Z",
        gitCommit: "deadbeef",
        subjects: [{
          path: "package.json",
          digest: `sha256:${"a".repeat(64)}` as Digest,
          bytes: 10,
        }],
        evidenceSnapshot: [],
      };
      const withDigest = {
        ...manifest,
        manifestDigest: manifestDigest(manifest),
      };
      const path = await writeReleaseManifest(join(temp, ".loop"), withDigest);
      const loaded = await readReleaseManifest(path);
      expect(loaded.manifestDigest).toBe(withDigest.manifestDigest);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
});
