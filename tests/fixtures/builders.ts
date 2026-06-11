import type {
  AnyDocument,
  Approval,
  ArtifactEnvelope,
  ChangePackage,
  ClassificationDecision,
  Finding,
  GateAttempt,
  GatePolicy,
  Waiver,
  WorkflowProfile,
} from "../../src/kernel/contracts/types.js";

export const DIGEST_A = `sha256:${"a".repeat(64)}` as const;
export const DIGEST_B = `sha256:${"b".repeat(64)}` as const;
export const CREATED_AT = "2026-06-11T00:00:00.000Z";

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};

function merge<T>(base: T, override: DeepPartial<T> = {}): T {
  if (Array.isArray(base) || Array.isArray(override)) return override as T;
  if (base && typeof base === "object" && override && typeof override === "object") {
    const result = { ...base } as Record<string, unknown>;
    for (const [key, value] of Object.entries(override)) {
      result[key] =
        value && typeof value === "object" && !Array.isArray(value)
          ? merge(result[key], value)
          : value;
    }
    return result as T;
  }
  return override as T;
}

const metadata = (id: string) => ({ id, revision: 1, createdAt: CREATED_AT });

export const changePackage = (override: DeepPartial<ChangePackage> = {}): ChangePackage =>
  merge(
    {
      apiVersion: "loop.dev/v1",
      kind: "ChangePackage",
      metadata: metadata("CHG-TASK-0001"),
      spec: {
        workItemType: "development-task",
        title: "Build contract kernel",
        owner: "platform-team",
        profileId: "standard",
        status: "active",
        relationships: [],
      },
    },
    override,
  );

export const artifactEnvelope = (override: DeepPartial<ArtifactEnvelope> = {}): ArtifactEnvelope =>
  merge(
    {
      apiVersion: "loop.dev/v1",
      kind: "ArtifactEnvelope",
      metadata: metadata("ART-REQ-0001"),
      spec: {
        packageId: "CHG-TASK-0001",
        phase: "requirements",
        artifactType: "requirement-spec",
        content: { path: "requirements.md", digest: DIGEST_A },
        producer: {
          skill: "requirements",
          skillVersion: "1.0.0",
          runtime: "codex",
          actor: "agent",
        },
        inputs: [],
        outputs: [],
        trace: [],
        selfCheck: { result: "pass", findingIds: [] },
      },
    },
    override,
  );

export const finding = (override: DeepPartial<Finding> = {}): Finding =>
  merge(
    {
      apiVersion: "loop.dev/v1",
      kind: "Finding",
      metadata: metadata("FND-0001"),
      spec: {
        packageId: "CHG-TASK-0001",
        phase: "requirements",
        sourceEvaluator: "lifecycle-loop",
        ruleId: "no-open-blocking-findings",
        severity: "warning",
        status: "open",
        message: "Clarify the acceptance criterion.",
        affectedEvidence: [],
        recommendedAction: "Add a measurable threshold.",
      },
    },
    override,
  );

export const classificationDecision = (
  override: DeepPartial<ClassificationDecision> = {},
): ClassificationDecision =>
  merge(
    {
      apiVersion: "loop.dev/v1",
      kind: "ClassificationDecision",
      metadata: metadata("CLS-0001"),
      spec: {
        packageId: "CHG-TASK-0001",
        initialTier: "standard",
        selectedTier: "standard",
        classifier: { type: "rules", id: "default-classifier", version: "1.0.0" },
      },
    },
    override,
  );

export const approval = (override: DeepPartial<Approval> = {}): Approval =>
  merge(
    {
      apiVersion: "loop.dev/v1",
      kind: "Approval",
      metadata: metadata("APR-0001"),
      spec: {
        packageId: "CHG-TASK-0001",
        phase: "requirements",
        actor: "reviewer@example.com",
        decision: "approved",
        reason: "Requirements are sufficiently clear.",
      },
    },
    override,
  );

export const waiver = (override: DeepPartial<Waiver> = {}): Waiver =>
  merge(
    {
      apiVersion: "loop.dev/v1",
      kind: "Waiver",
      metadata: metadata("WVR-0001"),
      spec: {
        packageId: "CHG-TASK-0001",
        phase: "requirements",
        conditionId: "required-approvals",
        reason: "Emergency maintenance window.",
        approver: "release-manager@example.com",
        status: "active",
        expiresAt: "2026-06-12T00:00:00.000Z",
        scope: [],
      },
    },
    override,
  );

export const gateAttempt = (override: DeepPartial<GateAttempt> = {}): GateAttempt =>
  merge(
    {
      apiVersion: "loop.dev/v1",
      kind: "GateAttempt",
      metadata: metadata("GATE-0001"),
      spec: {
        packageId: "CHG-TASK-0001",
        phase: "requirements",
        profileId: "standard",
        policyIds: ["base"],
        boundEvidence: [],
        evaluations: [],
        result: "pass",
        issuedBy: "lifecycle-loop",
      },
    },
    override,
  );

export const workflowProfile = (override: DeepPartial<WorkflowProfile> = {}): WorkflowProfile =>
  merge(
    {
      apiVersion: "loop.dev/v1",
      kind: "WorkflowProfile",
      metadata: metadata("standard"),
      spec: {
        tier: "standard",
        description: "Full lifecycle with selected human approvals.",
        policyIds: ["base"],
        phases: [
          {
            phase: "requirements",
            required: true,
            requiredArtifactTypes: ["requirement-spec"],
            requiredTraceRelations: [],
            humanApproval: "required",
            minimumApprovals: 1,
            enabledRuleIds: [
              "graph-integrity",
              "required-artifacts",
              "no-open-blocking-findings",
              "required-approvals",
            ],
          },
        ],
      },
    },
    override,
  );

export const gatePolicy = (override: DeepPartial<GatePolicy> = {}): GatePolicy =>
  merge(
    {
      apiVersion: "loop.dev/v1",
      kind: "GatePolicy",
      metadata: metadata("base"),
      spec: {
        description: "Built-in deterministic rules.",
        rules: [
          { id: "graph-integrity", type: "graph-integrity", blocking: true },
          { id: "required-artifacts", type: "required-artifacts", blocking: true },
          {
            id: "required-trace-relations",
            type: "required-trace-relations",
            blocking: true,
          },
          {
            id: "no-open-blocking-findings",
            type: "no-open-blocking-findings",
            blocking: true,
          },
          { id: "required-approvals", type: "required-approvals", blocking: true },
          { id: "child-gates-pass", type: "child-gates-pass", blocking: true },
        ],
      },
    },
    override,
  );

export function validDocuments(): AnyDocument[] {
  return [
    changePackage(),
    artifactEnvelope(),
    finding(),
    classificationDecision(),
    approval(),
    waiver(),
    gateAttempt(),
    workflowProfile(),
    gatePolicy(),
  ];
}
