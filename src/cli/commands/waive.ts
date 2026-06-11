import type { Waiver } from "../../kernel/contracts/types.js";
import type { Phase } from "../../kernel/contracts/vocabulary.js";
import { isPhase } from "../../kernel/contracts/vocabulary.js";
import {
  loadPackageBundle,
  nextDocumentRevision,
  nextSequentialId,
  resolveLoopRoot,
  savePackageDocument,
} from "../../loop/package-store.js";
import { failure, success, type CommandResult } from "../types.js";

export interface WaiveOptions {
  packageId: string;
  phase: Phase;
  conditionId: string;
  approver: string;
  reason: string;
  expiresAt: string;
  baseDir?: string;
}

export async function runWaive(options: WaiveOptions): Promise<CommandResult> {
  if (!isPhase(options.phase)) {
    return failure(`invalid phase: ${options.phase}`);
  }
  const loopRootPath = resolveLoopRoot(options.baseDir);
  const bundle = await loadPackageBundle(loopRootPath, options.packageId);
  const now = new Date().toISOString();
  const waiverId = nextSequentialId(bundle.documents, "Waiver", "WVR");
  const revision = nextDocumentRevision(bundle.documents, "Waiver", waiverId);

  const waiver: Waiver = {
    apiVersion: "loop.dev/v1",
    kind: "Waiver",
    metadata: { id: waiverId, revision, createdAt: now },
    spec: {
      packageId: options.packageId,
      phase: options.phase,
      conditionId: options.conditionId,
      reason: options.reason,
      approver: options.approver,
      status: "active",
      expiresAt: options.expiresAt,
      scope: [],
    },
  };

  const path = await savePackageDocument(loopRootPath, options.packageId, waiver);
  return success(`Recorded waiver ${waiverId}@${revision} for condition ${options.conditionId}\n${path}`);
}
