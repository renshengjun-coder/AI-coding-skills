import type {
  ArtifactRelationship,
  ArtifactType,
  ContractKind,
  FindingSeverity,
  FindingStatus,
  GateResult,
  HumanApprovalMode,
  PackageRelationship,
  Phase,
  ProfileTier,
  RuleType,
} from "./vocabulary.js";

export type Digest = `sha256:${string}`;

export interface Metadata {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt?: string;
}

export interface EvidenceRef {
  kind: ContractKind;
  id: string;
  revision: number;
  digest: Digest;
}

export interface ContractDocument<K extends ContractKind, S> {
  apiVersion: "loop.dev/v1";
  kind: K;
  metadata: Metadata;
  spec: S;
}

export interface PackageLink {
  relation: PackageRelationship;
  target: EvidenceRef;
}

export interface ChangePackageSpec {
  workItemType: "feature" | "requirement" | "bug-fix" | "development-task";
  title: string;
  owner: string;
  profileId: string;
  status: "active" | "complete" | "cancelled";
  relationships: PackageLink[];
}

export interface Producer {
  skill: string;
  skillVersion: string;
  runtime: string;
  actor: string;
  modelId?: string;
}

export interface TraceEdge {
  relation: ArtifactRelationship;
  source: EvidenceRef;
  target: EvidenceRef;
}

export interface ArtifactEnvelopeSpec {
  packageId: string;
  phase: Phase;
  artifactType: ArtifactType;
  content: { path?: string; url?: string; digest: Digest };
  producer: Producer;
  inputs: EvidenceRef[];
  outputs: EvidenceRef[];
  trace: TraceEdge[];
  selfCheck: { result: "pass" | "fail" | "error"; findingIds: string[] };
}

export interface FindingSpec {
  packageId: string;
  phase: Phase;
  sourceEvaluator: string;
  ruleId: string;
  severity: FindingSeverity;
  status: FindingStatus;
  message: string;
  affectedEvidence: EvidenceRef[];
  recommendedAction: string;
  resolutionEvidence?: EvidenceRef[];
}

export interface ClassificationDecisionSpec {
  packageId: string;
  initialTier: ProfileTier;
  selectedTier: ProfileTier;
  classifier: { type: "rules" | "automatic"; id: string; version: string };
  override?: { actor: string; reason: string };
}

export interface ApprovalSpec {
  packageId: string;
  phase: Phase;
  actor: string;
  decision: "approved" | "rejected";
  reason: string;
  expiresAt?: string;
}

export interface WaiverSpec {
  packageId: string;
  phase: Phase;
  conditionId: string;
  reason: string;
  approver: string;
  status: "active" | "expired" | "revoked";
  expiresAt: string;
  scope: EvidenceRef[];
}

export interface RuleEvaluation {
  ruleId: string;
  blocking: boolean;
  outcome: "pass" | "fail" | "error";
  message: string;
  evidence: EvidenceRef[];
}

export interface GateAttemptSpec {
  packageId: string;
  phase: Phase;
  profileId: string;
  policyIds: string[];
  boundEvidence: EvidenceRef[];
  evaluations: RuleEvaluation[];
  result: GateResult;
  issuedBy: string;
}

export interface PhaseProfile {
  phase: Phase;
  required: boolean;
  requiredArtifactTypes: ArtifactType[];
  requiredTraceRelations: ArtifactRelationship[];
  humanApproval: HumanApprovalMode;
  minimumApprovals: number;
  enabledRuleIds: string[];
}

export interface WorkflowProfileSpec {
  tier: ProfileTier;
  description: string;
  policyIds: string[];
  phases: PhaseProfile[];
}

export interface GatePolicyRule {
  id: string;
  type: RuleType;
  blocking: boolean;
}

export interface GatePolicySpec {
  description: string;
  rules: GatePolicyRule[];
}

export type ChangePackage = ContractDocument<"ChangePackage", ChangePackageSpec>;
export type ArtifactEnvelope = ContractDocument<"ArtifactEnvelope", ArtifactEnvelopeSpec>;
export type Finding = ContractDocument<"Finding", FindingSpec>;
export type ClassificationDecision = ContractDocument<
  "ClassificationDecision",
  ClassificationDecisionSpec
>;
export type Approval = ContractDocument<"Approval", ApprovalSpec>;
export type Waiver = ContractDocument<"Waiver", WaiverSpec>;
export type GateAttempt = ContractDocument<"GateAttempt", GateAttemptSpec>;
export type WorkflowProfile = ContractDocument<"WorkflowProfile", WorkflowProfileSpec>;
export type GatePolicy = ContractDocument<"GatePolicy", GatePolicySpec>;

export type AnyDocument =
  | ChangePackage
  | ArtifactEnvelope
  | Finding
  | ClassificationDecision
  | Approval
  | Waiver
  | GateAttempt
  | WorkflowProfile
  | GatePolicy;

export function documentKey(document: Pick<AnyDocument, "kind" | "metadata">): string {
  return `${document.kind}:${document.metadata.id}@${document.metadata.revision}`;
}
