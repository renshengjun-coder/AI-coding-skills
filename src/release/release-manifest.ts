import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { sha256Digest } from "../kernel/canonical/canonicalize.js";
import type { Digest } from "../kernel/contracts/types.js";
import { digestForEvidenceReference } from "../kernel/graph/evidence-graph.js";
import {
  loadPackageContext,
  resolveLoopRoot,
} from "../loop/package-store.js";
import { buildPackageStatus } from "../loop/status-report.js";
import { loadProfile } from "../loop/package-store.js";

export interface ReleaseSubject {
  path: string;
  digest: Digest;
  bytes: number;
}

export interface ReleaseManifest {
  apiVersion: "loop.dev/v1";
  kind: "ReleaseManifest";
  packageId: string;
  createdAt: string;
  gitCommit: string;
  workflowRunId?: string;
  releaseGateId?: string;
  manifestDigest: Digest;
  subjects: ReleaseSubject[];
  evidenceSnapshot: Array<{
    kind: string;
    id: string;
    revision: number;
    digest: Digest;
  }>;
}

async function hashFile(path: string): Promise<{ digest: Digest; bytes: number }> {
  const content = await readFile(path);
  const hash = createHash("sha256").update(content).digest("hex");
  return { digest: `sha256:${hash}`, bytes: content.length };
}

async function collectFiles(dir: string, root: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(full, root));
    } else if (entry.isFile()) {
      files.push(relative(root, full));
    }
  }
  return files.sort();
}

export async function buildReleaseSubjects(
  baseDir: string,
  subjectRoots: string[],
): Promise<ReleaseSubject[]> {
  const subjects: ReleaseSubject[] = [];
  for (const root of subjectRoots) {
    const absoluteRoot = join(baseDir, root);
    try {
      const files = await collectFiles(absoluteRoot, baseDir);
      for (const file of files) {
        const { digest, bytes } = await hashFile(join(baseDir, file));
        subjects.push({ path: file.replace(/\\/g, "/"), digest, bytes });
      }
    } catch {
      const { digest, bytes } = await hashFile(absoluteRoot);
      subjects.push({ path: root.replace(/\\/g, "/"), digest, bytes });
    }
  }
  return subjects.sort((left, right) => left.path.localeCompare(right.path));
}

export function manifestDigest(manifest: Omit<ReleaseManifest, "manifestDigest">): Digest {
  return sha256Digest(manifest);
}

export async function buildReleaseManifest(options: {
  packageId: string;
  baseDir?: string;
  gitCommit: string;
  workflowRunId?: string;
  subjectRoots?: string[];
}): Promise<ReleaseManifest> {
  const baseDir = options.baseDir ?? process.cwd();
  const loopRootPath = resolveLoopRoot(baseDir);
  const context = await loadPackageContext(loopRootPath, options.packageId);
  const rootBundle = context.bundles.find((bundle) => bundle.package.metadata.id === options.packageId);
  if (!rootBundle) {
    throw new Error(`package ${options.packageId} not found`);
  }

  const profile = await loadProfile(loopRootPath, rootBundle.package.spec.profileId);
  const status = buildPackageStatus(context, rootBundle.package, profile);
  const releasePhase = status.phases.find((phase) => phase.phase === "release");
  const releaseGate = releasePhase?.latestGate;

  const subjects = await buildReleaseSubjects(
    baseDir,
    options.subjectRoots ?? ["dist", "package.json"],
  );

  const withoutDigest: Omit<ReleaseManifest, "manifestDigest"> = {
    apiVersion: "loop.dev/v1",
    kind: "ReleaseManifest",
    packageId: options.packageId,
    createdAt: new Date().toISOString(),
    gitCommit: options.gitCommit,
    ...(options.workflowRunId ? { workflowRunId: options.workflowRunId } : {}),
    ...(releaseGate ? { releaseGateId: releaseGate.metadata.id } : {}),
    subjects,
    evidenceSnapshot: context.documents.map((document) => ({
      kind: document.kind,
      id: document.metadata.id,
      revision: document.metadata.revision,
      digest: digestForEvidenceReference(document),
    })),
  };

  return {
    ...withoutDigest,
    manifestDigest: manifestDigest(withoutDigest),
  };
}

export function releaseManifestDir(loopRootPath: string, packageId: string): string {
  return join(loopRootPath, "releases", packageId);
}

export async function writeReleaseManifest(
  loopRootPath: string,
  manifest: ReleaseManifest,
): Promise<string> {
  const dir = releaseManifestDir(loopRootPath, manifest.packageId);
  await mkdir(dir, { recursive: true });
  const path = join(dir, "release-manifest.json");
  const content = JSON.stringify(manifest, null, 2) + "\n";
  await writeFile(path, content, "utf8");
  return path;
}

export function validateReleaseManifest(value: unknown): ReleaseManifest {
  if (!value || typeof value !== "object") throw new Error("release manifest must be an object");
  const record = value as Record<string, unknown>;
  if (record.apiVersion !== "loop.dev/v1" || record.kind !== "ReleaseManifest") {
    throw new Error("invalid release manifest apiVersion/kind");
  }
  if (typeof record.packageId !== "string" || typeof record.gitCommit !== "string") {
    throw new Error("release manifest requires packageId and gitCommit");
  }
  if (!Array.isArray(record.subjects)) {
    throw new Error("release manifest requires subjects array");
  }
  const manifest = record as unknown as ReleaseManifest;
  const { manifestDigest: recordedDigest, ...rest } = manifest;
  const expected = manifestDigest(rest);
  if (recordedDigest !== expected) {
    throw new Error("release manifest digest mismatch");
  }
  return manifest;
}

export async function readReleaseManifest(path: string): Promise<ReleaseManifest> {
  const content = await readFile(path, "utf8");
  return validateReleaseManifest(JSON.parse(content));
}

export function attestationSubjectPaths(manifest: ReleaseManifest, baseDir: string): string[] {
  return manifest.subjects.map((subject) => join(baseDir, subject.path));
}
