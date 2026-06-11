import type { Approval } from "../../kernel/contracts/types.js";
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

export interface ApproveOptions {
  packageId: string;
  phase: Phase;
  actor: string;
  reason: string;
  expiresAt?: string;
  baseDir?: string;
}

export async function runApprove(options: ApproveOptions): Promise<CommandResult> {
  if (!isPhase(options.phase)) {
    return failure(`invalid phase: ${options.phase}`);
  }
  const loopRootPath = resolveLoopRoot(options.baseDir);
  const bundle = await loadPackageBundle(loopRootPath, options.packageId);
  const now = new Date().toISOString();
  const approvalId = nextSequentialId(bundle.documents, "Approval", "APR");
  const revision = nextDocumentRevision(bundle.documents, "Approval", approvalId);

  const approval: Approval = {
    apiVersion: "loop.dev/v1",
    kind: "Approval",
    metadata: { id: approvalId, revision, createdAt: now },
    spec: {
      packageId: options.packageId,
      phase: options.phase,
      actor: options.actor,
      decision: "approved",
      reason: options.reason,
      ...(options.expiresAt ? { expiresAt: options.expiresAt } : {}),
    },
  };

  const path = await savePackageDocument(loopRootPath, options.packageId, approval);
  return success(`Recorded approval ${approvalId}@${revision} for ${options.phase}\n${path}`);
}
