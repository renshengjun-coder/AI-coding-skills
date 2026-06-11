import type { ClassificationDecision } from "../../kernel/contracts/types.js";
import type { ProfileTier } from "../../kernel/contracts/vocabulary.js";
import {
  loadPackageBundle,
  nextDocumentRevision,
  nextSequentialId,
  resolveLoopRoot,
  savePackageDocument,
} from "../../loop/package-store.js";
import { parseProfileTier } from "./start.js";
import { success, type CommandResult } from "../types.js";

export interface ClassifyOptions {
  packageId: string;
  selectedTier: ProfileTier;
  initialTier?: ProfileTier;
  overrideActor?: string;
  overrideReason?: string;
  baseDir?: string;
}

export async function runClassify(options: ClassifyOptions): Promise<CommandResult> {
  const loopRootPath = resolveLoopRoot(options.baseDir);
  const bundle = await loadPackageBundle(loopRootPath, options.packageId);
  const initialTier = options.initialTier
    ?? parseProfileTier(bundle.package.spec.profileId)
    ?? options.selectedTier;
  const now = new Date().toISOString();
  const decisionId = nextSequentialId(bundle.documents, "ClassificationDecision", "CLS");
  const revision = nextDocumentRevision(bundle.documents, "ClassificationDecision", decisionId);

  const decision: ClassificationDecision = {
    apiVersion: "loop.dev/v1",
    kind: "ClassificationDecision",
    metadata: { id: decisionId, revision, createdAt: now },
    spec: {
      packageId: options.packageId,
      initialTier,
      selectedTier: options.selectedTier,
      classifier: { type: "rules", id: "loop-cli", version: "1.0.0" },
      ...(options.overrideActor && options.overrideReason
        ? { override: { actor: options.overrideActor, reason: options.overrideReason } }
        : {}),
    },
  };

  const updatedPackage: typeof bundle.package = {
    ...bundle.package,
    metadata: {
      ...bundle.package.metadata,
      revision: bundle.package.metadata.revision + 1,
      updatedAt: now,
    },
    spec: {
      ...bundle.package.spec,
      profileId: options.selectedTier,
    },
  };

  await savePackageDocument(loopRootPath, options.packageId, updatedPackage);
  const decisionPath = await savePackageDocument(loopRootPath, options.packageId, decision);
  return success(
    `Recorded classification ${decisionId}@${revision} and updated profile to ${options.selectedTier}\n${decisionPath}`,
  );
}
