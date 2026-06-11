export const CONTRACT_KINDS = [
  "ChangePackage",
  "ArtifactEnvelope",
  "Finding",
  "ClassificationDecision",
  "Approval",
  "Waiver",
  "GateAttempt",
  "WorkflowProfile",
  "GatePolicy",
] as const;

export const PHASES = [
  "requirements",
  "design",
  "test-planning",
  "implementation",
  "review",
  "validation",
  "release",
] as const;

export const ARTIFACT_TYPES = [
  "requirement-spec",
  "design-document",
  "test-plan",
  "implementation-record",
  "review-report",
  "validation-report",
  "release-record",
] as const;

export const PACKAGE_RELATIONSHIPS = [
  "decomposes-into",
  "child-of",
  "depends-on",
  "blocks",
  "supersedes",
] as const;

export const ARTIFACT_RELATIONSHIPS = [
  "satisfies",
  "derives-from",
  "implements",
  "verifies",
  "reviews",
  "validates",
  "releases",
  "supersedes",
] as const;

export const GATE_RESULTS = ["pass", "fail", "error", "stale", "waived"] as const;
export const FINDING_SEVERITIES = ["info", "warning", "blocking"] as const;
export const FINDING_STATUSES = ["open", "resolved", "accepted"] as const;
export const PROFILE_TIERS = ["routine", "standard", "high-risk"] as const;
export const HUMAN_APPROVAL_MODES = ["none", "conditional", "required"] as const;
export const RULE_TYPES = [
  "graph-integrity",
  "required-artifacts",
  "required-trace-relations",
  "no-open-blocking-findings",
  "required-approvals",
  "child-gates-pass",
] as const;

export type ContractKind = (typeof CONTRACT_KINDS)[number];
export type Phase = (typeof PHASES)[number];
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];
export type PackageRelationship = (typeof PACKAGE_RELATIONSHIPS)[number];
export type ArtifactRelationship = (typeof ARTIFACT_RELATIONSHIPS)[number];
export type GateResult = (typeof GATE_RESULTS)[number];
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];
export type FindingStatus = (typeof FINDING_STATUSES)[number];
export type ProfileTier = (typeof PROFILE_TIERS)[number];
export type HumanApprovalMode = (typeof HUMAN_APPROVAL_MODES)[number];
export type RuleType = (typeof RULE_TYPES)[number];

export function isContractKind(value: unknown): value is ContractKind {
  return typeof value === "string" && CONTRACT_KINDS.includes(value as ContractKind);
}

export function isPhase(value: unknown): value is Phase {
  return typeof value === "string" && PHASES.includes(value as Phase);
}
