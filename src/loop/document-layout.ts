import type { ContractKind } from "../kernel/contracts/vocabulary.js";
import type { AnyDocumentKindDir } from "./paths.js";

const KIND_TO_DIR: Partial<Record<ContractKind, AnyDocumentKindDir>> = {
  ArtifactEnvelope: "artifacts",
  Finding: "findings",
  GateAttempt: "gates",
  ClassificationDecision: "decisions",
  Approval: "decisions",
  Waiver: "decisions",
};

export function storageDirForKind(kind: ContractKind): AnyDocumentKindDir | null {
  return KIND_TO_DIR[kind] ?? null;
}

export function isPackageScopedKind(kind: ContractKind): boolean {
  return kind !== "WorkflowProfile" && kind !== "GatePolicy";
}
