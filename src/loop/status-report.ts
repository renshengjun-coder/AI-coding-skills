import { evaluateFreshness } from "../kernel/freshness/evaluate-freshness.js";
import type { ChangePackage, GateAttempt, WorkflowProfile } from "../kernel/contracts/types.js";
import type { Phase } from "../kernel/contracts/vocabulary.js";
import type { LoopContext } from "./package-store.js";

export interface PhaseStatus {
  phase: Phase;
  required: boolean;
  latestGate?: GateAttempt;
  gateResult?: GateAttempt["spec"]["result"];
  freshness?: "fresh" | "stale";
  openBlockingFindings: number;
}

export interface PackageStatus {
  packageId: string;
  profileId: string;
  phases: PhaseStatus[];
  childPackageIds: string[];
}

function openBlockingFindings(context: LoopContext, packageId: string, phase: Phase): number {
  return context.documents.filter((document) =>
    document.kind === "Finding" &&
    document.spec.packageId === packageId &&
    document.spec.phase === phase &&
    document.spec.severity === "blocking" &&
    document.spec.status === "open").length;
}

function latestGateForPhase(
  context: LoopContext,
  packageId: string,
  phase: Phase,
): GateAttempt | undefined {
  const gates = context.documents
    .filter((document): document is GateAttempt =>
      document.kind === "GateAttempt" &&
      document.spec.packageId === packageId &&
      document.spec.phase === phase)
    .sort((left, right) => right.metadata.revision - left.metadata.revision);
  return gates[0];
}

export function buildPackageStatus(
  context: LoopContext,
  packageDocument: ChangePackage,
  profile: WorkflowProfile,
): PackageStatus {
  const packageId = packageDocument.metadata.id;
  const phases: PhaseStatus[] = profile.spec.phases.map((phaseProfile) => {
    const latestGate = latestGateForPhase(context, packageId, phaseProfile.phase);
    const base: PhaseStatus = {
      phase: phaseProfile.phase,
      required: phaseProfile.required,
      openBlockingFindings: openBlockingFindings(context, packageId, phaseProfile.phase),
    };
    if (!latestGate) return base;
    return {
      ...base,
      latestGate,
      gateResult: latestGate.spec.result,
      freshness: evaluateFreshness(latestGate, context.documents).status,
    };
  });

  return {
    packageId,
    profileId: packageDocument.spec.profileId,
    phases,
    childPackageIds: packageDocument.spec.relationships
      .filter((link) => link.relation === "decomposes-into")
      .map((link) => link.target.id),
  };
}

export function formatPackageStatus(status: PackageStatus): string {
  const lines = [
    `Package ${status.packageId} (profile: ${status.profileId})`,
    `Children: ${status.childPackageIds.length === 0 ? "none" : status.childPackageIds.join(", ")}`,
    "",
  ];
  for (const phase of status.phases) {
    const gate = phase.gateResult ?? "no-gate";
    const fresh = phase.freshness ?? "n/a";
    const blockers = phase.openBlockingFindings;
    lines.push(
      `- ${phase.phase}: required=${phase.required} gate=${gate} freshness=${fresh} open_blocking=${blockers}`,
    );
  }
  return lines.join("\n");
}
