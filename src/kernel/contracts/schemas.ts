import {
  ARTIFACT_RELATIONSHIPS,
  ARTIFACT_TYPES,
  CONTRACT_KINDS,
  FINDING_SEVERITIES,
  FINDING_STATUSES,
  GATE_RESULTS,
  HUMAN_APPROVAL_MODES,
  PACKAGE_RELATIONSHIPS,
  PHASES,
  PROFILE_TIERS,
  RULE_TYPES,
  type ContractKind,
} from "./vocabulary.js";

type JsonSchema = Record<string, unknown>;

const digest = { type: "string", pattern: "^sha256:[0-9a-f]{64}$" };
const dateTime = { type: "string", format: "date-time" };
const nonEmpty = { type: "string", minLength: 1 };

const object = (
  required: string[],
  properties: Record<string, JsonSchema>,
): JsonSchema => ({
  type: "object",
  additionalProperties: false,
  required,
  properties,
});

const array = (items: JsonSchema): JsonSchema => ({ type: "array", items });
const enumOf = (values: readonly string[]): JsonSchema => ({ type: "string", enum: values });

const metadata = object(
  ["id", "revision", "createdAt"],
  {
    id: nonEmpty,
    revision: { type: "integer", minimum: 1 },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
);

const evidenceRef = object(
  ["kind", "id", "revision", "digest"],
  {
    kind: enumOf(CONTRACT_KINDS),
    id: nonEmpty,
    revision: { type: "integer", minimum: 1 },
    digest,
  },
);

const packageRef = object(
  ["kind", "id", "revision", "digest"],
  {
    kind: { const: "ChangePackage" },
    id: nonEmpty,
    revision: { type: "integer", minimum: 1 },
    digest,
  },
);

const artifactRef = object(
  ["kind", "id", "revision", "digest"],
  {
    kind: { const: "ArtifactEnvelope" },
    id: nonEmpty,
    revision: { type: "integer", minimum: 1 },
    digest,
  },
);

const producer = object(
  ["skill", "skillVersion", "runtime", "actor"],
  {
    skill: nonEmpty,
    skillVersion: nonEmpty,
    runtime: nonEmpty,
    actor: nonEmpty,
    modelId: nonEmpty,
  },
);

const traceEdge = object(
  ["relation", "source", "target"],
  {
    relation: enumOf(ARTIFACT_RELATIONSHIPS),
    source: artifactRef,
    target: artifactRef,
  },
);

const phaseProfile = object(
  [
    "phase",
    "required",
    "requiredArtifactTypes",
    "requiredTraceRelations",
    "humanApproval",
    "minimumApprovals",
    "enabledRuleIds",
  ],
  {
    phase: enumOf(PHASES),
    required: { type: "boolean" },
    requiredArtifactTypes: array(enumOf(ARTIFACT_TYPES)),
    requiredTraceRelations: array(enumOf(ARTIFACT_RELATIONSHIPS)),
    humanApproval: enumOf(HUMAN_APPROVAL_MODES),
    minimumApprovals: { type: "integer", minimum: 0 },
    enabledRuleIds: array(nonEmpty),
  },
);

const ruleEvaluation = object(
  ["ruleId", "blocking", "outcome", "message", "evidence"],
  {
    ruleId: nonEmpty,
    blocking: { type: "boolean" },
    outcome: enumOf(["pass", "fail", "error"]),
    message: nonEmpty,
    evidence: array(evidenceRef),
  },
);

const documentSchema = (kind: ContractKind, spec: JsonSchema): JsonSchema => ({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `https://loop.dev/schemas/v1/${kind}.schema.json`,
  type: "object",
  additionalProperties: false,
  required: ["apiVersion", "kind", "metadata", "spec"],
  properties: {
    apiVersion: { const: "loop.dev/v1" },
    kind: { const: kind },
    metadata,
    spec,
  },
});

export const schemasByKind: Record<ContractKind, JsonSchema> = {
  ChangePackage: documentSchema(
    "ChangePackage",
    object(
      ["workItemType", "title", "owner", "profileId", "status", "relationships"],
      {
        workItemType: enumOf(["feature", "requirement", "bug-fix", "development-task"]),
        title: nonEmpty,
        owner: nonEmpty,
        profileId: nonEmpty,
        status: enumOf(["active", "complete", "cancelled"]),
        relationships: array(
          object(["relation", "target"], {
            relation: enumOf(PACKAGE_RELATIONSHIPS),
            target: packageRef,
          }),
        ),
      },
    ),
  ),
  ArtifactEnvelope: documentSchema(
    "ArtifactEnvelope",
    object(
      [
        "packageId",
        "phase",
        "artifactType",
        "content",
        "producer",
        "inputs",
        "outputs",
        "trace",
        "selfCheck",
      ],
      {
        packageId: nonEmpty,
        phase: enumOf(PHASES),
        artifactType: enumOf(ARTIFACT_TYPES),
        content: {
          ...object(["digest"], {
            path: nonEmpty,
            url: { type: "string", format: "uri" },
            digest,
          }),
          anyOf: [{ required: ["path"] }, { required: ["url"] }],
        },
        producer,
        inputs: array(artifactRef),
        outputs: array(artifactRef),
        trace: array(traceEdge),
        selfCheck: object(["result", "findingIds"], {
          result: enumOf(["pass", "fail", "error"]),
          findingIds: array(nonEmpty),
        }),
      },
    ),
  ),
  Finding: documentSchema(
    "Finding",
    object(
      [
        "packageId",
        "phase",
        "sourceEvaluator",
        "ruleId",
        "severity",
        "status",
        "message",
        "affectedEvidence",
        "recommendedAction",
      ],
      {
        packageId: nonEmpty,
        phase: enumOf(PHASES),
        sourceEvaluator: nonEmpty,
        ruleId: nonEmpty,
        severity: enumOf(FINDING_SEVERITIES),
        status: enumOf(FINDING_STATUSES),
        message: nonEmpty,
        affectedEvidence: array(evidenceRef),
        recommendedAction: nonEmpty,
        resolutionEvidence: array(evidenceRef),
      },
    ),
  ),
  ClassificationDecision: documentSchema(
    "ClassificationDecision",
    object(["packageId", "initialTier", "selectedTier", "classifier"], {
      packageId: nonEmpty,
      initialTier: enumOf(PROFILE_TIERS),
      selectedTier: enumOf(PROFILE_TIERS),
      classifier: object(["type", "id", "version"], {
        type: enumOf(["rules", "automatic"]),
        id: nonEmpty,
        version: nonEmpty,
      }),
      override: object(["actor", "reason"], {
        actor: nonEmpty,
        reason: nonEmpty,
      }),
    }),
  ),
  Approval: documentSchema(
    "Approval",
    object(["packageId", "phase", "actor", "decision", "reason"], {
      packageId: nonEmpty,
      phase: enumOf(PHASES),
      actor: nonEmpty,
      decision: enumOf(["approved", "rejected"]),
      reason: nonEmpty,
      expiresAt: dateTime,
    }),
  ),
  Waiver: documentSchema(
    "Waiver",
    object(
      ["packageId", "phase", "conditionId", "reason", "approver", "status", "expiresAt", "scope"],
      {
        packageId: nonEmpty,
        phase: enumOf(PHASES),
        conditionId: nonEmpty,
        reason: nonEmpty,
        approver: nonEmpty,
        status: enumOf(["active", "expired", "revoked"]),
        expiresAt: dateTime,
        scope: array(evidenceRef),
      },
    ),
  ),
  GateAttempt: documentSchema(
    "GateAttempt",
    object(
      [
        "packageId",
        "phase",
        "profileId",
        "policyIds",
        "boundEvidence",
        "evaluations",
        "result",
        "issuedBy",
      ],
      {
        packageId: nonEmpty,
        phase: enumOf(PHASES),
        profileId: nonEmpty,
        policyIds: array(nonEmpty),
        boundEvidence: array(evidenceRef),
        evaluations: array(ruleEvaluation),
        result: enumOf(GATE_RESULTS),
        issuedBy: nonEmpty,
      },
    ),
  ),
  WorkflowProfile: documentSchema(
    "WorkflowProfile",
    object(["tier", "description", "policyIds", "phases"], {
      tier: enumOf(PROFILE_TIERS),
      description: nonEmpty,
      policyIds: array(nonEmpty),
      phases: array(phaseProfile),
    }),
  ),
  GatePolicy: documentSchema(
    "GatePolicy",
    object(["description", "rules"], {
      description: nonEmpty,
      rules: array(
        object(["id", "type", "blocking"], {
          id: nonEmpty,
          type: enumOf(RULE_TYPES),
          blocking: { type: "boolean" },
        }),
      ),
    }),
  ),
};

const filenameByKind = (kind: ContractKind): string =>
  `${kind.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}.schema.json`;

export function renderSchemas(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(schemasByKind).map(([kind, schema]) => [
      filenameByKind(kind as ContractKind),
      `${JSON.stringify(schema, null, 2)}\n`,
    ]),
  );
}
