import type { Finding } from "../kernel/contracts/types.js";
import { verifyPackage } from "../ci/verify-package.js";
import {
  loadPackageBundle,
  nextDocumentRevision,
  nextSequentialId,
  resolveLoopRoot,
  savePackageDocument,
} from "../loop/package-store.js";
import {
  attestationSubjectPaths,
  buildReleaseManifest,
  writeReleaseManifest,
} from "./release-manifest.js";

export interface PrepareReleaseOptions {
  packageId: string;
  baseDir?: string;
  gitCommit: string;
  workflowRunId?: string;
  subjectRoots?: string[];
}

export interface PrepareReleaseResult {
  manifestPath: string;
  provenanceFindingPath: string;
  subjectPaths: string[];
}

export async function prepareRelease(options: PrepareReleaseOptions): Promise<PrepareReleaseResult> {
  const baseDir = options.baseDir ?? process.cwd();
  const loopRootPath = resolveLoopRoot(baseDir);

  const verify = await verifyPackage({
    packageId: options.packageId,
    baseDir,
  });
  const blocking = verify.issues.filter((item) => item.blocking);
  if (blocking.length > 0) {
    const summary = blocking.map((item) => item.message).join("; ");
    throw new Error(`package not ready for release: ${summary}`);
  }

  const manifest = await buildReleaseManifest({
    packageId: options.packageId,
    baseDir,
    gitCommit: options.gitCommit,
    ...(options.workflowRunId ? { workflowRunId: options.workflowRunId } : {}),
    ...(options.subjectRoots ? { subjectRoots: options.subjectRoots } : {}),
  });

  const manifestPath = await writeReleaseManifest(loopRootPath, manifest);
  const bundle = await loadPackageBundle(loopRootPath, options.packageId);
  const now = new Date().toISOString();
  const findingId = nextSequentialId(bundle.documents, "Finding", "FND");
  const revision = nextDocumentRevision(bundle.documents, "Finding", findingId);

  const provenance: Finding = {
    apiVersion: "loop.dev/v1",
    kind: "Finding",
    metadata: { id: findingId, revision, createdAt: now },
    spec: {
      packageId: options.packageId,
      phase: "release",
      sourceEvaluator: "loop-release",
      ruleId: "release-provenance",
      severity: "info",
      status: "resolved",
      message: `Release manifest ${manifest.manifestDigest} written for commit ${options.gitCommit}`,
      affectedEvidence: [],
      recommendedAction: "Attach GitHub Artifact Attestations to manifest subjects.",
    },
  };

  const provenanceFindingPath = await savePackageDocument(loopRootPath, options.packageId, provenance);
  const subjectPaths = attestationSubjectPaths(manifest, baseDir);

  return { manifestPath, provenanceFindingPath, subjectPaths };
}
