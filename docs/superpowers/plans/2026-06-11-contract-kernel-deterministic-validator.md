# Contract Kernel and Deterministic Validator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the runtime-neutral contract kernel and deterministic validator that define, validate, hash, relate, evaluate, and freshness-check Loop change-package evidence.

**Architecture:** Implement a small TypeScript library whose source-of-truth contracts are typed domain records plus generated JSON Schema 2020-12 documents. Keep schema validation, canonical hashing, graph integrity, profile/policy evaluation, and freshness evaluation as independent pure modules. Expose them through one public API so the later CLI, Lifecycle Loop, runtime adapters, and GitHub Actions can all call the same deterministic code.

**Tech Stack:** Node.js 22+, TypeScript 5, JSON Schema 2020-12, Ajv 8, `ajv-formats`, YAML 2, Vitest 3, Node `crypto`

---

## Scope Boundary

This plan implements only subproject 1 from the approved design:

- Contract vocabulary and TypeScript types.
- Generated JSON Schema 2020-12 contracts.
- YAML/JSON document loading and schema validation.
- Canonical JSON serialization and SHA-256 digests.
- Evidence-graph construction and integrity validation.
- Deterministic workflow-profile and gate-policy evaluation.
- Gate-evidence freshness evaluation.
- Contract, policy, graph, freshness, and end-to-end kernel tests.

This plan does **not** implement:

- `loop` CLI commands.
- Audit report rendering.
- Codex or Claude runtime adapters.
- Dedicated phase skills.
- Universal Lifecycle Loop orchestration.
- Waiver authorization or final gate-attempt issuance.
- GitHub Actions workflows, rulesets, or release attestations.

## File Map

| Path | Responsibility |
|---|---|
| `.gitignore` | Excludes generated dependencies, builds, coverage, and local brainstorming/index state. |
| `package.json` | Node package metadata and build/test/schema-generation scripts. |
| `tsconfig.json` | Strict TypeScript settings for source and tests. |
| `tsconfig.build.json` | Build-only TypeScript settings for `src/`. |
| `src/kernel/contracts/vocabulary.ts` | Closed vocabularies for kinds, phases, relationships, states, and built-in rule types. |
| `src/kernel/contracts/types.ts` | Runtime-neutral TypeScript contract interfaces. |
| `src/kernel/contracts/schemas.ts` | JSON Schema 2020-12 source definitions and schema renderer. |
| `scripts/generate-schemas.ts` | Writes deterministic schema files into `.loop/schemas/v1/`. |
| `.loop/schemas/v1/*.schema.json` | Committed, reviewable generated JSON Schemas. |
| `.loop/policies/v1/base.yaml` | Built-in deterministic gate rules. |
| `.loop/profiles/{routine,standard,high-risk}.yaml` | Initial complexity-driven workflow profiles. |
| `src/kernel/validation/schema-registry.ts` | Ajv 2020 schema registry and structured schema issues. |
| `src/kernel/io/load-document.ts` | YAML/JSON parsing with contract validation. |
| `src/kernel/canonical/canonicalize.ts` | JSON-compatible canonical serialization and SHA-256 digesting. |
| `src/kernel/graph/evidence-graph.ts` | Evidence indexing, reference resolution, cycle detection, and integrity issues. |
| `src/kernel/policy/evaluate-gate.ts` | Built-in deterministic gate-rule dispatch and composite gate result. |
| `src/kernel/freshness/evaluate-freshness.ts` | Comparison of bound evidence references with current document digests. |
| `src/kernel/index.ts` | Stable public API for downstream subprojects. |
| `tests/fixtures/builders.ts` | Minimal valid contract-document builders shared by tests. |
| `tests/contracts/*.test.ts` | Vocabulary, schema generation, and schema-validation tests. |
| `tests/canonical/*.test.ts` | Canonicalization and digest tests. |
| `tests/graph/*.test.ts` | Graph resolution, relationship, and cycle tests. |
| `tests/policy/*.test.ts` | Profile-driven deterministic gate tests. |
| `tests/freshness/*.test.ts` | Fresh/stale/error evidence-binding tests. |
| `tests/integration/kernel.test.ts` | End-to-end contract-kernel scenario. |

### Task 1: Bootstrap the TypeScript Kernel Package

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `src/kernel/index.ts`
- Create: `tests/kernel-smoke.test.ts`

- [ ] **Step 1: Initialize the package and install pinned-major dependencies**

Run:

```bash
npm init -y
npm install ajv@8 ajv-formats@3 yaml@2
npm install --save-dev @types/node@22 tsx@4 typescript@5 vitest@3
npm pkg set type=module
npm pkg set private=true --json
npm pkg set engines.node='>=22'
npm pkg set scripts.build='tsc -p tsconfig.build.json'
npm pkg set scripts.typecheck='tsc -p tsconfig.json --noEmit'
npm pkg set scripts.test='vitest run'
npm pkg set scripts.schemas='tsx scripts/generate-schemas.ts'
npm pkg set scripts.verify='npm run schemas && npm run typecheck && npm test && npm run build'
```

Expected: `package.json` and `package-lock.json` exist, and `npm ls --depth=0` reports no missing packages.

- [ ] **Step 2: Write strict TypeScript configuration**

Create `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.superpowers/
.codegraph/
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"]
}
```

Create `tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["tests/**/*.ts"]
}
```

- [ ] **Step 3: Write the failing public-API smoke test**

Create `tests/kernel-smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { KERNEL_API_VERSION } from "../src/kernel/index.js";

describe("contract kernel", () => {
  it("exports its stable API version", () => {
    expect(KERNEL_API_VERSION).toBe("loop.dev/v1");
  });
});
```

- [ ] **Step 4: Run the smoke test to verify it fails**

Run:

```bash
npm test -- tests/kernel-smoke.test.ts
```

Expected: FAIL because `src/kernel/index.ts` does not exist.

- [ ] **Step 5: Add the minimal public API**

Create `src/kernel/index.ts`:

```ts
export const KERNEL_API_VERSION = "loop.dev/v1" as const;
```

- [ ] **Step 6: Verify the bootstrap**

Run:

```bash
npm run typecheck
npm test -- tests/kernel-smoke.test.ts
npm run build
```

Expected: all three commands exit successfully.

- [ ] **Step 7: Commit**

```bash
git add .gitignore package.json package-lock.json tsconfig.json tsconfig.build.json src/kernel/index.ts tests/kernel-smoke.test.ts
git commit -m "build: bootstrap contract kernel package"
```

### Task 2: Define the Contract Vocabulary and Domain Types

**Files:**
- Create: `src/kernel/contracts/vocabulary.ts`
- Create: `src/kernel/contracts/types.ts`
- Create: `tests/contracts/vocabulary.test.ts`
- Create: `tests/fixtures/builders.ts`

- [ ] **Step 1: Write failing vocabulary tests**

Create `tests/contracts/vocabulary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_RELATIONSHIPS,
  CONTRACT_KINDS,
  GATE_RESULTS,
  PACKAGE_RELATIONSHIPS,
  PHASES,
  isContractKind,
} from "../../src/kernel/contracts/vocabulary.js";

describe("contract vocabulary", () => {
  it("defines all lifecycle phases", () => {
    expect(PHASES).toEqual([
      "requirements",
      "design",
      "test-planning",
      "implementation",
      "review",
      "validation",
      "release",
    ]);
  });

  it("defines approved contract kinds and gate states", () => {
    expect(CONTRACT_KINDS).toContain("ChangePackage");
    expect(CONTRACT_KINDS).toContain("GateAttempt");
    expect(GATE_RESULTS).toEqual(["pass", "fail", "error", "stale", "waived"]);
  });

  it("keeps package and artifact relationships distinct", () => {
    expect(PACKAGE_RELATIONSHIPS).toContain("decomposes-into");
    expect(ARTIFACT_RELATIONSHIPS).toContain("implements");
    expect(ARTIFACT_RELATIONSHIPS).not.toContain("decomposes-into");
  });

  it("recognizes only supported contract kinds", () => {
    expect(isContractKind("WorkflowProfile")).toBe(true);
    expect(isContractKind("UnknownKind")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the vocabulary tests to verify they fail**

Run:

```bash
npm test -- tests/contracts/vocabulary.test.ts
```

Expected: FAIL because the vocabulary module does not exist.

- [ ] **Step 3: Implement the closed vocabularies**

Create `src/kernel/contracts/vocabulary.ts`:

```ts
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
```

- [ ] **Step 4: Define the runtime-neutral contract types**

Create `src/kernel/contracts/types.ts`:

```ts
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
export type ClassificationDecision = ContractDocument<"ClassificationDecision", ClassificationDecisionSpec>;
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
```

- [ ] **Step 5: Add shared valid-document builders**

Create `tests/fixtures/builders.ts` with one builder per `AnyDocument` kind. Each builder must return the minimum valid document and accept `DeepPartial` overrides. Use these fixed defaults so later tests share one vocabulary:

```ts
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
  merge({
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
  }, override);

export const artifactEnvelope = (override: DeepPartial<ArtifactEnvelope> = {}): ArtifactEnvelope =>
  merge({
    apiVersion: "loop.dev/v1",
    kind: "ArtifactEnvelope",
    metadata: metadata("ART-REQ-0001"),
    spec: {
      packageId: "CHG-TASK-0001",
      phase: "requirements",
      artifactType: "requirement-spec",
      content: { path: "requirements.md", digest: DIGEST_A },
      producer: { skill: "requirements", skillVersion: "1.0.0", runtime: "codex", actor: "agent" },
      inputs: [],
      outputs: [],
      trace: [],
      selfCheck: { result: "pass", findingIds: [] },
    },
  }, override);

export const finding = (override: DeepPartial<Finding> = {}): Finding =>
  merge({
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
  }, override);

export const classificationDecision = (
  override: DeepPartial<ClassificationDecision> = {},
): ClassificationDecision =>
  merge({
    apiVersion: "loop.dev/v1",
    kind: "ClassificationDecision",
    metadata: metadata("CLS-0001"),
    spec: {
      packageId: "CHG-TASK-0001",
      initialTier: "standard",
      selectedTier: "standard",
      classifier: { type: "rules", id: "default-classifier", version: "1.0.0" },
    },
  }, override);

export const approval = (override: DeepPartial<Approval> = {}): Approval =>
  merge({
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
  }, override);

export const waiver = (override: DeepPartial<Waiver> = {}): Waiver =>
  merge({
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
  }, override);

export const gateAttempt = (override: DeepPartial<GateAttempt> = {}): GateAttempt =>
  merge({
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
  }, override);

export const workflowProfile = (override: DeepPartial<WorkflowProfile> = {}): WorkflowProfile =>
  merge({
    apiVersion: "loop.dev/v1",
    kind: "WorkflowProfile",
    metadata: metadata("standard"),
    spec: {
      tier: "standard",
      description: "Full lifecycle with selected human approvals.",
      policyIds: ["base"],
      phases: [{
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
      }],
    },
  }, override);

export const gatePolicy = (override: DeepPartial<GatePolicy> = {}): GatePolicy =>
  merge({
    apiVersion: "loop.dev/v1",
    kind: "GatePolicy",
    metadata: metadata("base"),
    spec: {
      description: "Built-in deterministic rules.",
      rules: [
        { id: "graph-integrity", type: "graph-integrity", blocking: true },
        { id: "required-artifacts", type: "required-artifacts", blocking: true },
        { id: "required-trace-relations", type: "required-trace-relations", blocking: true },
        { id: "no-open-blocking-findings", type: "no-open-blocking-findings", blocking: true },
        { id: "required-approvals", type: "required-approvals", blocking: true },
        { id: "child-gates-pass", type: "child-gates-pass", blocking: true },
      ],
    },
  }, override);

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
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
npm test -- tests/contracts/vocabulary.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/kernel/contracts tests/contracts/vocabulary.test.ts tests/fixtures/builders.ts
git commit -m "feat: define loop contract vocabulary"
```

### Task 3: Generate Reviewable JSON Schema 2020-12 Contracts

**Files:**
- Create: `src/kernel/contracts/schemas.ts`
- Create: `scripts/generate-schemas.ts`
- Create: `.loop/schemas/v1/*.schema.json`
- Create: `tests/contracts/schemas.test.ts`

- [ ] **Step 1: Write failing schema-generation tests**

Create `tests/contracts/schemas.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CONTRACT_KINDS } from "../../src/kernel/contracts/vocabulary.js";
import { renderSchemas, schemasByKind } from "../../src/kernel/contracts/schemas.js";

describe("generated contract schemas", () => {
  it("defines one draft 2020-12 schema for every contract kind", () => {
    expect(Object.keys(schemasByKind).sort()).toEqual([...CONTRACT_KINDS].sort());
    for (const schema of Object.values(schemasByKind)) {
      expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      expect(schema.additionalProperties).toBe(false);
    }
  });

  it("keeps committed schema files synchronized with source definitions", async () => {
    for (const [filename, expected] of Object.entries(renderSchemas())) {
      const actual = await readFile(`.loop/schemas/v1/${filename}`, "utf8");
      expect(actual).toBe(expected);
    }
  });
});
```

- [ ] **Step 2: Run the schema tests to verify they fail**

Run:

```bash
npm test -- tests/contracts/schemas.test.ts
```

Expected: FAIL because `schemas.ts` and generated schema files do not exist.

- [ ] **Step 3: Implement the schema source**

Create `src/kernel/contracts/schemas.ts`. Use reusable JSON Schema fragments, require every field shown in `types.ts` unless it is optional there, set `additionalProperties: false` on every object, and set the following exact public exports:

```ts
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
  ChangePackage: documentSchema("ChangePackage", object(
    ["workItemType", "title", "owner", "profileId", "status", "relationships"],
    {
      workItemType: enumOf(["feature", "requirement", "bug-fix", "development-task"]),
      title: nonEmpty,
      owner: nonEmpty,
      profileId: nonEmpty,
      status: enumOf(["active", "complete", "cancelled"]),
      relationships: array(object(["relation", "target"], {
        relation: enumOf(PACKAGE_RELATIONSHIPS),
        target: packageRef,
      })),
    },
  )),
  ArtifactEnvelope: documentSchema("ArtifactEnvelope", object(
    ["packageId", "phase", "artifactType", "content", "producer", "inputs", "outputs", "trace", "selfCheck"],
    {
      packageId: nonEmpty,
      phase: enumOf(PHASES),
      artifactType: enumOf(ARTIFACT_TYPES),
      content: {
        ...object(["digest"], { path: nonEmpty, url: { type: "string", format: "uri" }, digest }),
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
  )),
  Finding: documentSchema("Finding", object(
    ["packageId", "phase", "sourceEvaluator", "ruleId", "severity", "status", "message", "affectedEvidence", "recommendedAction"],
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
  )),
  ClassificationDecision: documentSchema("ClassificationDecision", object(
    ["packageId", "initialTier", "selectedTier", "classifier"],
    {
      packageId: nonEmpty,
      initialTier: enumOf(PROFILE_TIERS),
      selectedTier: enumOf(PROFILE_TIERS),
      classifier: object(["type", "id", "version"], {
        type: enumOf(["rules", "automatic"]),
        id: nonEmpty,
        version: nonEmpty,
      }),
      override: object(["actor", "reason"], { actor: nonEmpty, reason: nonEmpty }),
    },
  )),
  Approval: documentSchema("Approval", object(
    ["packageId", "phase", "actor", "decision", "reason"],
    {
      packageId: nonEmpty,
      phase: enumOf(PHASES),
      actor: nonEmpty,
      decision: enumOf(["approved", "rejected"]),
      reason: nonEmpty,
      expiresAt: dateTime,
    },
  )),
  Waiver: documentSchema("Waiver", object(
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
  )),
  GateAttempt: documentSchema("GateAttempt", object(
    ["packageId", "phase", "profileId", "policyIds", "boundEvidence", "evaluations", "result", "issuedBy"],
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
  )),
  WorkflowProfile: documentSchema("WorkflowProfile", object(
    ["tier", "description", "policyIds", "phases"],
    {
      tier: enumOf(PROFILE_TIERS),
      description: nonEmpty,
      policyIds: array(nonEmpty),
      phases: array(phaseProfile),
    },
  )),
  GatePolicy: documentSchema("GatePolicy", object(
    ["description", "rules"],
    {
      description: nonEmpty,
      rules: array(object(["id", "type", "blocking"], {
        id: nonEmpty,
        type: enumOf(RULE_TYPES),
        blocking: { type: "boolean" },
      })),
    },
  )),
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
```

- [ ] **Step 4: Add the deterministic schema writer**

Create `scripts/generate-schemas.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { renderSchemas } from "../src/kernel/contracts/schemas.js";

const outputDirectory = ".loop/schemas/v1";
await mkdir(outputDirectory, { recursive: true });

for (const [filename, content] of Object.entries(renderSchemas())) {
  await writeFile(`${outputDirectory}/${filename}`, content, "utf8");
}
```

- [ ] **Step 5: Generate and verify schemas**

Run:

```bash
npm run schemas
npm test -- tests/contracts/schemas.test.ts
npm run typecheck
```

Expected: nine `.loop/schemas/v1/*.schema.json` files are generated and tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/kernel/contracts/schemas.ts scripts/generate-schemas.ts .loop/schemas/v1 tests/contracts/schemas.test.ts package.json package-lock.json
git commit -m "feat: define generated contract schemas"
```

### Task 4: Validate and Load YAML or JSON Contract Documents

**Files:**
- Create: `src/kernel/validation/schema-registry.ts`
- Create: `src/kernel/io/load-document.ts`
- Create: `tests/contracts/validation.test.ts`
- Create: `tests/contracts/load-document.test.ts`

- [ ] **Step 1: Write failing schema-validation tests**

Create `tests/contracts/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateDocument } from "../../src/kernel/validation/schema-registry.js";
import { changePackage, DIGEST_A, validDocuments } from "../fixtures/builders.js";

describe("validateDocument", () => {
  it("accepts a valid fixture for every contract kind", () => {
    for (const document of validDocuments()) {
      expect(validateDocument(document)).toEqual({ valid: true, issues: [] });
    }
  });

  it("rejects an invalid fixture for every contract kind", () => {
    for (const document of validDocuments()) {
      const invalid = structuredClone(document) as Record<string, unknown>;
      delete invalid.apiVersion;
      const result = validateDocument(invalid);
      expect(result.valid).toBe(false);
      expect(result.issues[0]?.keyword).toBe("required");
    }
  });

  it("rejects an unsupported kind before schema lookup", () => {
    const result = validateDocument({ apiVersion: "loop.dev/v1", kind: "Other" });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.keyword).toBe("kind");
  });

  it("requires package relationships to target change packages", () => {
    const result = validateDocument(changePackage({
      spec: {
        relationships: [{
          relation: "depends-on",
          target: { kind: "Approval", id: "APR-1", revision: 1, digest: DIGEST_A },
        }],
      },
    }));
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ path: expect.stringContaining("/kind") }));
  });
});
```

- [ ] **Step 2: Run validation tests to verify they fail**

Run:

```bash
npm test -- tests/contracts/validation.test.ts
```

Expected: FAIL because the registry does not exist.

- [ ] **Step 3: Implement the Ajv 2020 schema registry**

Create `src/kernel/validation/schema-registry.ts`:

```ts
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { AnyDocument, ContractDocument } from "../contracts/types.js";
import { schemasByKind } from "../contracts/schemas.js";
import { isContractKind, type ContractKind } from "../contracts/vocabulary.js";

export interface ValidationIssue {
  path: string;
  keyword: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const validators = new Map<ContractKind, ValidateFunction>();
for (const [kind, schema] of Object.entries(schemasByKind)) {
  validators.set(kind as ContractKind, ajv.compile(schema));
}

const issueFromError = (error: ErrorObject): ValidationIssue => ({
  path: error.instancePath || "/",
  keyword: error.keyword,
  message: error.message ?? "schema validation failed",
});

export function validateDocument(value: unknown): ValidationResult {
  const candidate = value as Partial<ContractDocument<ContractKind, unknown>>;
  if (!isContractKind(candidate?.kind)) {
    return {
      valid: false,
      issues: [{ path: "/kind", keyword: "kind", message: "unsupported contract kind" }],
    };
  }

  const validator = validators.get(candidate.kind);
  if (!validator) {
    return {
      valid: false,
      issues: [{ path: "/kind", keyword: "kind", message: "missing schema validator" }],
    };
  }

  if (validator(value)) return { valid: true, issues: [] };
  return { valid: false, issues: (validator.errors ?? []).map(issueFromError) };
}

export function assertValidDocument(value: unknown): asserts value is AnyDocument {
  const result = validateDocument(value);
  if (!result.valid) {
    throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  }
}
```

- [ ] **Step 4: Write failing YAML/JSON loading tests**

Create `tests/contracts/load-document.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadDocument } from "../../src/kernel/io/load-document.js";

const validYaml = `
apiVersion: loop.dev/v1
kind: ChangePackage
metadata:
  id: CHG-TASK-0001
  revision: 1
  createdAt: 2026-06-11T00:00:00.000Z
spec:
  workItemType: development-task
  title: Build kernel
  owner: platform-team
  profileId: standard
  status: active
  relationships: []
`;

describe("loadDocument", () => {
  it("loads and validates YAML", () => {
    expect(loadDocument(validYaml, "package.yaml").metadata.id).toBe("CHG-TASK-0001");
  });

  it("loads and validates JSON", () => {
    const json = JSON.stringify(loadDocument(validYaml, "package.yaml"));
    expect(loadDocument(json, "package.json").kind).toBe("ChangePackage");
  });

  it("reports the source name when validation fails", () => {
    expect(() => loadDocument("kind: Other", "broken.yaml")).toThrow("broken.yaml");
  });
});
```

- [ ] **Step 5: Implement YAML/JSON loading**

Create `src/kernel/io/load-document.ts`:

```ts
import { parse } from "yaml";
import type { AnyDocument } from "../contracts/types.js";
import { validateDocument } from "../validation/schema-registry.js";

export function loadDocument(content: string, sourceName: string): AnyDocument {
  let value: unknown;
  try {
    value = sourceName.endsWith(".json") ? JSON.parse(content) : parse(content);
  } catch (error) {
    throw new Error(`${sourceName}: unable to parse document`, { cause: error });
  }

  const result = validateDocument(value);
  if (!result.valid) {
    const details = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new Error(`${sourceName}: invalid contract document: ${details}`);
  }
  return value as AnyDocument;
}
```

- [ ] **Step 6: Verify document validation and loading**

Run:

```bash
npm test -- tests/contracts/validation.test.ts tests/contracts/load-document.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/kernel/validation src/kernel/io tests/contracts/validation.test.ts tests/contracts/load-document.test.ts
git commit -m "feat: validate loop contract documents"
```

### Task 5: Canonicalize and Digest Evidence

**Files:**
- Create: `src/kernel/canonical/canonicalize.ts`
- Create: `tests/canonical/canonicalize.test.ts`

- [ ] **Step 1: Write failing canonicalization tests**

Create `tests/canonical/canonicalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  canonicalize,
  digestDocument,
  sha256Digest,
} from "../../src/kernel/canonical/canonicalize.js";
import { changePackage } from "../fixtures/builders.js";

describe("canonicalize", () => {
  it("sorts object keys recursively while preserving array order", () => {
    expect(canonicalize({ z: 1, a: { y: 2, x: 3 }, list: [2, 1] }))
      .toBe('{"a":{"x":3,"y":2},"list":[2,1],"z":1}');
  });

  it("gives formatting-independent digests", () => {
    expect(sha256Digest({ b: 2, a: 1 })).toBe(sha256Digest({ a: 1, b: 2 }));
  });

  it("rejects values outside the JSON data model", () => {
    expect(() => canonicalize({ value: Number.NaN })).toThrow("finite");
    expect(() => canonicalize({ value: undefined })).toThrow("JSON-compatible");
  });

  it("digests a complete contract document", () => {
    expect(digestDocument(changePackage())).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm test -- tests/canonical/canonicalize.test.ts
```

Expected: FAIL because canonicalization is not implemented.

- [ ] **Step 3: Implement canonical JSON and SHA-256**

Create `src/kernel/canonical/canonicalize.ts`:

```ts
import { createHash } from "node:crypto";
import type { AnyDocument, Digest } from "../contracts/types.js";

type JsonPrimitive = null | boolean | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function normalize(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("numbers must be finite");
    return value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const result: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child === undefined) throw new TypeError("values must be JSON-compatible");
      result[key] = normalize(child);
    }
    return result;
  }
  throw new TypeError("values must be JSON-compatible");
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function sha256Digest(value: unknown): Digest {
  const hash = createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
  return `sha256:${hash}`;
}

export function digestDocument(document: AnyDocument): Digest {
  return sha256Digest(document);
}
```

- [ ] **Step 4: Verify canonicalization**

Run:

```bash
npm test -- tests/canonical/canonicalize.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/kernel/canonical tests/canonical
git commit -m "feat: add canonical evidence digests"
```

### Task 6: Build and Validate the Evidence Graph

**Files:**
- Create: `src/kernel/graph/evidence-graph.ts`
- Create: `tests/graph/evidence-graph.test.ts`

- [ ] **Step 1: Write failing graph-integrity tests**

Create `tests/graph/evidence-graph.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { digestDocument } from "../../src/kernel/canonical/canonicalize.js";
import {
  buildEvidenceGraph,
  validateGraphIntegrity,
} from "../../src/kernel/graph/evidence-graph.js";
import { artifactEnvelope, changePackage } from "../fixtures/builders.js";

describe("evidence graph", () => {
  it("indexes exact document revisions", () => {
    const document = changePackage();
    const graph = buildEvidenceGraph([document]);
    expect(graph.byKey.get("ChangePackage:CHG-TASK-0001@1")).toEqual(document);
  });

  it("reports duplicate exact revisions", () => {
    const document = changePackage();
    const issues = validateGraphIntegrity([document, structuredClone(document)]);
    expect(issues).toContainEqual(expect.objectContaining({ ruleId: "duplicate-document" }));
  });

  it("reports unresolved exact evidence references", () => {
    const artifact = artifactEnvelope({
      spec: {
        inputs: [{
          kind: "ArtifactEnvelope",
          id: "ART-MISSING",
          revision: 1,
          digest: `sha256:${"1".repeat(64)}`,
        }],
      },
    });
    const issues = validateGraphIntegrity([changePackage(), artifact]);
    expect(issues).toContainEqual(expect.objectContaining({ ruleId: "unresolved-reference" }));
  });

  it("reports artifacts whose owning package is missing", () => {
    const issues = validateGraphIntegrity([artifactEnvelope()]);
    expect(issues).toContainEqual(expect.objectContaining({ ruleId: "missing-package" }));
  });

  it("reports evidence-reference digest mismatches", () => {
    const requirement = artifactEnvelope();
    const design = artifactEnvelope({
      metadata: { id: "ART-DES-0001" },
      spec: {
        phase: "design",
        artifactType: "design-document",
        inputs: [{
          kind: "ArtifactEnvelope",
          id: requirement.metadata.id,
          revision: requirement.metadata.revision,
          digest: `sha256:${"0".repeat(64)}`,
        }],
      },
    });
    expect(validateGraphIntegrity([changePackage(), requirement, design]))
      .toContainEqual(expect.objectContaining({ ruleId: "digest-mismatch" }));
  });

  it("accepts a resolved exact reference with the current digest", () => {
    const requirement = artifactEnvelope();
    const design = artifactEnvelope({
      metadata: { id: "ART-DES-0001" },
      spec: {
        phase: "design",
        artifactType: "design-document",
        inputs: [{
          kind: "ArtifactEnvelope",
          id: requirement.metadata.id,
          revision: requirement.metadata.revision,
          digest: digestDocument(requirement),
        }],
      },
    });
    expect(validateGraphIntegrity([changePackage(), requirement, design])).toEqual([]);
  });

  it("reports parent-child package cycles", () => {
    const parent = changePackage({ metadata: { id: "CHG-FEAT-1" } });
    const child = changePackage({ metadata: { id: "CHG-TASK-1" } });
    parent.spec.relationships = [{
      relation: "decomposes-into",
      target: {
        kind: "ChangePackage",
        id: child.metadata.id,
        revision: 1,
        digest: digestDocument(child),
      },
    }];
    child.spec.relationships = [{
      relation: "decomposes-into",
      target: {
        kind: "ChangePackage",
        id: parent.metadata.id,
        revision: 1,
        digest: digestDocument(parent),
      },
    }];
    expect(validateGraphIntegrity([parent, child]))
      .toContainEqual(expect.objectContaining({ ruleId: "package-cycle" }));
  });
});
```

- [ ] **Step 2: Run graph tests to verify they fail**

Run:

```bash
npm test -- tests/graph/evidence-graph.test.ts
```

Expected: FAIL because the graph module does not exist.

- [ ] **Step 3: Implement evidence indexing and integrity checks**

Create `src/kernel/graph/evidence-graph.ts`:

```ts
import { digestDocument } from "../canonical/canonicalize.js";
import {
  documentKey,
  type AnyDocument,
  type ChangePackage,
  type EvidenceRef,
} from "../contracts/types.js";

export interface GraphIssue {
  ruleId: "duplicate-document" | "unresolved-reference" | "digest-mismatch" | "missing-package" | "package-cycle";
  documentKey: string;
  message: string;
}

export interface EvidenceGraph {
  byKey: Map<string, AnyDocument>;
  duplicates: string[];
}

export function evidenceRefKey(reference: Pick<EvidenceRef, "kind" | "id" | "revision">): string {
  return `${reference.kind}:${reference.id}@${reference.revision}`;
}

export function buildEvidenceGraph(documents: AnyDocument[]): EvidenceGraph {
  const byKey = new Map<string, AnyDocument>();
  const duplicates: string[] = [];
  for (const document of documents) {
    const key = documentKey(document);
    if (byKey.has(key)) duplicates.push(key);
    else byKey.set(key, document);
  }
  return { byKey, duplicates };
}

function referencesFrom(document: AnyDocument): EvidenceRef[] {
  switch (document.kind) {
    case "ChangePackage":
      return document.spec.relationships.map((link) => link.target);
    case "ArtifactEnvelope":
      return [
        ...document.spec.inputs,
        ...document.spec.outputs,
        ...document.spec.trace.flatMap((edge) => [edge.source, edge.target]),
      ];
    case "Finding":
      return [...document.spec.affectedEvidence, ...(document.spec.resolutionEvidence ?? [])];
    case "Waiver":
      return document.spec.scope;
    case "GateAttempt":
      return [
        ...document.spec.boundEvidence,
        ...document.spec.evaluations.flatMap((evaluation) => evaluation.evidence),
      ];
    default:
      return [];
  }
}

function packageCycleIssues(documents: ChangePackage[]): GraphIssue[] {
  const edges = new Map<string, string[]>();
  for (const document of documents) {
    const children = document.spec.relationships
      .filter((link) => link.relation === "decomposes-into")
      .map((link) => link.target.id);
    edges.set(document.metadata.id, children);
  }

  const issues: GraphIssue[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string): void => {
    if (visiting.has(id)) {
      issues.push({
        ruleId: "package-cycle",
        documentKey: id,
        message: `package decomposition cycle reaches ${id}`,
      });
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of edges.get(id) ?? []) visit(child);
    visiting.delete(id);
    visited.add(id);
  };

  for (const id of edges.keys()) visit(id);
  return issues;
}

export function validateGraphIntegrity(documents: AnyDocument[]): GraphIssue[] {
  const graph = buildEvidenceGraph(documents);
  const packageIds = new Set(documents
    .filter((document) => document.kind === "ChangePackage")
    .map((document) => document.metadata.id));
  const issues: GraphIssue[] = graph.duplicates.map((key) => ({
    ruleId: "duplicate-document",
    documentKey: key,
    message: `duplicate exact document revision ${key}`,
  }));

  for (const document of documents) {
    if ("packageId" in document.spec && !packageIds.has(document.spec.packageId)) {
      issues.push({
        ruleId: "missing-package",
        documentKey: documentKey(document),
        message: `owning package ${document.spec.packageId} is missing`,
      });
    }
    for (const reference of referencesFrom(document)) {
      const referenced = graph.byKey.get(evidenceRefKey(reference));
      if (!referenced) {
        issues.push({
          ruleId: "unresolved-reference",
          documentKey: documentKey(document),
          message: `unresolved reference ${evidenceRefKey(reference)}`,
        });
      } else if (digestDocument(referenced) !== reference.digest) {
        issues.push({
          ruleId: "digest-mismatch",
          documentKey: documentKey(document),
          message: `digest mismatch for ${evidenceRefKey(reference)}`,
        });
      }
    }
  }

  return [
    ...issues,
    ...packageCycleIssues(documents.filter((document): document is ChangePackage =>
      document.kind === "ChangePackage")),
  ];
}
```

- [ ] **Step 4: Verify graph behavior**

Run:

```bash
npm test -- tests/graph/evidence-graph.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/kernel/graph tests/graph
git commit -m "feat: validate evidence graph integrity"
```

### Task 7: Add Profiles, Policies, and Deterministic Gate Evaluation

**Files:**
- Create: `.loop/policies/v1/base.yaml`
- Create: `.loop/profiles/routine.yaml`
- Create: `.loop/profiles/standard.yaml`
- Create: `.loop/profiles/high-risk.yaml`
- Create: `src/kernel/policy/evaluate-gate.ts`
- Create: `tests/policy/evaluate-gate.test.ts`
- Create: `tests/contracts/profile-files.test.ts`

- [ ] **Step 1: Add the contract-valid built-in policy**

Create `.loop/policies/v1/base.yaml`:

```yaml
apiVersion: loop.dev/v1
kind: GatePolicy
metadata:
  id: base
  revision: 1
  createdAt: 2026-06-11T00:00:00.000Z
spec:
  description: Built-in deterministic contract-kernel rules.
  rules:
    - { id: graph-integrity, type: graph-integrity, blocking: true }
    - { id: required-artifacts, type: required-artifacts, blocking: true }
    - { id: required-trace-relations, type: required-trace-relations, blocking: true }
    - { id: no-open-blocking-findings, type: no-open-blocking-findings, blocking: true }
    - { id: required-approvals, type: required-approvals, blocking: true }
    - { id: child-gates-pass, type: child-gates-pass, blocking: true }
```

- [ ] **Step 2: Add the routine profile**

Create `.loop/profiles/routine.yaml`:

```yaml
apiVersion: loop.dev/v1
kind: WorkflowProfile
metadata: { id: routine, revision: 1, createdAt: 2026-06-11T00:00:00.000Z }
spec:
  tier: routine
  description: Reduced lifecycle with no phase-level human approval by default.
  policyIds: [base]
  phases:
    - { phase: requirements, required: true, requiredArtifactTypes: [requirement-spec], requiredTraceRelations: [], humanApproval: none, minimumApprovals: 0, enabledRuleIds: [graph-integrity, required-artifacts, no-open-blocking-findings, child-gates-pass] }
    - { phase: design, required: false, requiredArtifactTypes: [], requiredTraceRelations: [], humanApproval: none, minimumApprovals: 0, enabledRuleIds: [] }
    - { phase: test-planning, required: false, requiredArtifactTypes: [], requiredTraceRelations: [], humanApproval: none, minimumApprovals: 0, enabledRuleIds: [] }
    - { phase: implementation, required: true, requiredArtifactTypes: [implementation-record], requiredTraceRelations: [implements], humanApproval: none, minimumApprovals: 0, enabledRuleIds: [graph-integrity, required-artifacts, required-trace-relations, no-open-blocking-findings, child-gates-pass] }
    - { phase: review, required: true, requiredArtifactTypes: [review-report], requiredTraceRelations: [], humanApproval: none, minimumApprovals: 0, enabledRuleIds: [graph-integrity, required-artifacts, no-open-blocking-findings, child-gates-pass] }
    - { phase: validation, required: true, requiredArtifactTypes: [validation-report], requiredTraceRelations: [verifies], humanApproval: none, minimumApprovals: 0, enabledRuleIds: [graph-integrity, required-artifacts, required-trace-relations, no-open-blocking-findings, child-gates-pass] }
    - { phase: release, required: false, requiredArtifactTypes: [], requiredTraceRelations: [], humanApproval: none, minimumApprovals: 0, enabledRuleIds: [] }
```

- [ ] **Step 3: Add the standard profile**

Create `.loop/profiles/standard.yaml`:

```yaml
apiVersion: loop.dev/v1
kind: WorkflowProfile
metadata: { id: standard, revision: 1, createdAt: 2026-06-11T00:00:00.000Z }
spec:
  tier: standard
  description: Full lifecycle with requirements and release approval.
  policyIds: [base]
  phases:
    - { phase: requirements, required: true, requiredArtifactTypes: [requirement-spec], requiredTraceRelations: [], humanApproval: required, minimumApprovals: 1, enabledRuleIds: [graph-integrity, required-artifacts, no-open-blocking-findings, required-approvals, child-gates-pass] }
    - { phase: design, required: true, requiredArtifactTypes: [design-document], requiredTraceRelations: [derives-from], humanApproval: none, minimumApprovals: 0, enabledRuleIds: [graph-integrity, required-artifacts, required-trace-relations, no-open-blocking-findings, child-gates-pass] }
    - { phase: test-planning, required: true, requiredArtifactTypes: [test-plan], requiredTraceRelations: [], humanApproval: none, minimumApprovals: 0, enabledRuleIds: [graph-integrity, required-artifacts, no-open-blocking-findings, child-gates-pass] }
    - { phase: implementation, required: true, requiredArtifactTypes: [implementation-record], requiredTraceRelations: [implements], humanApproval: none, minimumApprovals: 0, enabledRuleIds: [graph-integrity, required-artifacts, required-trace-relations, no-open-blocking-findings, child-gates-pass] }
    - { phase: review, required: true, requiredArtifactTypes: [review-report], requiredTraceRelations: [], humanApproval: none, minimumApprovals: 0, enabledRuleIds: [graph-integrity, required-artifacts, no-open-blocking-findings, child-gates-pass] }
    - { phase: validation, required: true, requiredArtifactTypes: [validation-report], requiredTraceRelations: [verifies], humanApproval: none, minimumApprovals: 0, enabledRuleIds: [graph-integrity, required-artifacts, required-trace-relations, no-open-blocking-findings, child-gates-pass] }
    - { phase: release, required: true, requiredArtifactTypes: [release-record], requiredTraceRelations: [releases], humanApproval: required, minimumApprovals: 1, enabledRuleIds: [graph-integrity, required-artifacts, required-trace-relations, no-open-blocking-findings, required-approvals, child-gates-pass] }
```

- [ ] **Step 4: Add the high-risk profile**

Create `.loop/profiles/high-risk.yaml`:

```yaml
apiVersion: loop.dev/v1
kind: WorkflowProfile
metadata: { id: high-risk, revision: 1, createdAt: 2026-06-11T00:00:00.000Z }
spec:
  tier: high-risk
  description: Full lifecycle with independent approvals at risk-sensitive gates.
  policyIds: [base]
  phases:
    - { phase: requirements, required: true, requiredArtifactTypes: [requirement-spec], requiredTraceRelations: [], humanApproval: required, minimumApprovals: 2, enabledRuleIds: [graph-integrity, required-artifacts, no-open-blocking-findings, required-approvals, child-gates-pass] }
    - { phase: design, required: true, requiredArtifactTypes: [design-document], requiredTraceRelations: [derives-from], humanApproval: required, minimumApprovals: 2, enabledRuleIds: [graph-integrity, required-artifacts, required-trace-relations, no-open-blocking-findings, required-approvals, child-gates-pass] }
    - { phase: test-planning, required: true, requiredArtifactTypes: [test-plan], requiredTraceRelations: [], humanApproval: none, minimumApprovals: 0, enabledRuleIds: [graph-integrity, required-artifacts, no-open-blocking-findings, child-gates-pass] }
    - { phase: implementation, required: true, requiredArtifactTypes: [implementation-record], requiredTraceRelations: [implements], humanApproval: none, minimumApprovals: 0, enabledRuleIds: [graph-integrity, required-artifacts, required-trace-relations, no-open-blocking-findings, child-gates-pass] }
    - { phase: review, required: true, requiredArtifactTypes: [review-report], requiredTraceRelations: [], humanApproval: none, minimumApprovals: 0, enabledRuleIds: [graph-integrity, required-artifacts, no-open-blocking-findings, child-gates-pass] }
    - { phase: validation, required: true, requiredArtifactTypes: [validation-report], requiredTraceRelations: [verifies], humanApproval: required, minimumApprovals: 2, enabledRuleIds: [graph-integrity, required-artifacts, required-trace-relations, no-open-blocking-findings, required-approvals, child-gates-pass] }
    - { phase: release, required: true, requiredArtifactTypes: [release-record], requiredTraceRelations: [releases], humanApproval: required, minimumApprovals: 2, enabledRuleIds: [graph-integrity, required-artifacts, required-trace-relations, no-open-blocking-findings, required-approvals, child-gates-pass] }
```

- [ ] **Step 5: Write failing profile-file validation tests**

Create `tests/contracts/profile-files.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadDocument } from "../../src/kernel/io/load-document.js";
import { validateProfileConfiguration } from "../../src/kernel/policy/evaluate-gate.js";

describe("committed profiles and policies", () => {
  it.each([
    ".loop/policies/v1/base.yaml",
    ".loop/profiles/routine.yaml",
    ".loop/profiles/standard.yaml",
    ".loop/profiles/high-risk.yaml",
  ])("%s is a valid contract document", async (path) => {
    const document = loadDocument(await readFile(path, "utf8"), path);
    expect(document.apiVersion).toBe("loop.dev/v1");
  });

  it("binds every committed profile to valid policy rules", async () => {
    const policy = loadDocument(
      await readFile(".loop/policies/v1/base.yaml", "utf8"),
      ".loop/policies/v1/base.yaml",
    );
    if (policy.kind !== "GatePolicy") throw new Error("base policy has the wrong kind");

    for (const path of [
      ".loop/profiles/routine.yaml",
      ".loop/profiles/standard.yaml",
      ".loop/profiles/high-risk.yaml",
    ]) {
      const profile = loadDocument(await readFile(path, "utf8"), path);
      if (profile.kind !== "WorkflowProfile") throw new Error(`${path} has the wrong kind`);
      expect(validateProfileConfiguration(profile, [policy])).toEqual([]);
    }
  });
});
```

- [ ] **Step 6: Write failing deterministic gate tests**

Create `tests/policy/evaluate-gate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { digestDocument } from "../../src/kernel/canonical/canonicalize.js";
import {
  evaluateGate,
  validateProfileConfiguration,
} from "../../src/kernel/policy/evaluate-gate.js";
import {
  approval,
  artifactEnvelope,
  changePackage,
  finding,
  gateAttempt,
  gatePolicy,
  workflowProfile,
} from "../fixtures/builders.js";

describe("evaluateGate", () => {
  it("validates profile and policy binding", () => {
    expect(validateProfileConfiguration(workflowProfile(), [gatePolicy()])).toEqual([]);
    expect(validateProfileConfiguration(workflowProfile({
      spec: {
        phases: [{
          phase: "requirements",
          required: true,
          requiredArtifactTypes: [],
          requiredTraceRelations: [],
          humanApproval: "none",
          minimumApprovals: 1,
          enabledRuleIds: ["missing-rule"],
        }],
      },
    }), [gatePolicy()])).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "approval-configuration" }),
      expect.objectContaining({ ruleId: "undefined-rule" }),
    ]));
  });

  it("passes when every enabled rule passes", () => {
    const result = evaluateGate({
      package: changePackage(),
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile: workflowProfile(),
      policies: [gatePolicy()],
      documents: [changePackage(), artifactEnvelope(), approval()],
    });
    expect(result.result).toBe("pass");
    expect(result.evaluations.every((evaluation) => evaluation.outcome === "pass")).toBe(true);
  });

  it("fails when a required artifact is missing", () => {
    const result = evaluateGate({
      package: changePackage(),
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile: workflowProfile(),
      policies: [gatePolicy()],
      documents: [changePackage(), approval()],
    });
    expect(result.result).toBe("fail");
    expect(result.evaluations).toContainEqual(expect.objectContaining({
      ruleId: "required-artifacts",
      outcome: "fail",
    }));
  });

  it("does not require approval when the profile mode is none", () => {
    const profile = workflowProfile({
      spec: {
        phases: [{
          phase: "requirements",
          required: true,
          requiredArtifactTypes: ["requirement-spec"],
          requiredTraceRelations: [],
          humanApproval: "none",
          minimumApprovals: 0,
          enabledRuleIds: ["graph-integrity", "required-artifacts"],
        }],
      },
    });
    expect(evaluateGate({
      package: changePackage(),
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies: [gatePolicy()],
      documents: [changePackage(), artifactEnvelope()],
    }).result).toBe("pass");
  });

  it("does not count an expired approval", () => {
    const result = evaluateGate({
      package: changePackage(),
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile: workflowProfile(),
      policies: [gatePolicy()],
      documents: [
        changePackage(),
        artifactEnvelope(),
        approval({ spec: { expiresAt: "2026-06-11T11:59:59.000Z" } }),
      ],
    });
    expect(result.evaluations).toContainEqual(expect.objectContaining({
      ruleId: "required-approvals",
      outcome: "fail",
    }));
  });

  it("fails when a blocking finding remains open", () => {
    const result = evaluateGate({
      package: changePackage(),
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile: workflowProfile(),
      policies: [gatePolicy()],
      documents: [
        changePackage(),
        artifactEnvelope(),
        approval(),
        finding({ spec: { severity: "blocking", status: "open" } }),
      ],
    });
    expect(result.evaluations).toContainEqual(expect.objectContaining({
      ruleId: "no-open-blocking-findings",
      outcome: "fail",
    }));
  });

  it("uses the latest child gate attempt rather than any historical pass", () => {
    const child = changePackage({ metadata: { id: "CHG-TASK-CHILD" } });
    const parent = changePackage({
      metadata: { id: "CHG-FEAT-PARENT" },
      spec: {
        relationships: [{
          relation: "decomposes-into",
          target: {
            kind: "ChangePackage",
            id: child.metadata.id,
            revision: child.metadata.revision,
            digest: digestDocument(child),
          },
        }],
      },
    });
    const result = evaluateGate({
      package: parent,
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile: workflowProfile(),
      policies: [gatePolicy()],
      documents: [
        parent,
        child,
        artifactEnvelope({ spec: { packageId: parent.metadata.id } }),
        approval({ spec: { packageId: parent.metadata.id } }),
        gateAttempt({ metadata: { id: "GATE-CHILD-1", revision: 1 }, spec: { packageId: child.metadata.id, result: "pass" } }),
        gateAttempt({ metadata: { id: "GATE-CHILD-2", revision: 2 }, spec: { packageId: child.metadata.id, result: "fail" } }),
      ],
    });
    expect(result.evaluations).toContainEqual(expect.objectContaining({
      ruleId: "child-gates-pass",
      outcome: "fail",
    }));
  });

  it("errors when the profile enables an undefined rule", () => {
    const profile = workflowProfile({
      spec: {
        phases: [{
          phase: "requirements",
          required: true,
          requiredArtifactTypes: [],
          requiredTraceRelations: [],
          humanApproval: "none",
          minimumApprovals: 0,
          enabledRuleIds: ["missing-rule"],
        }],
      },
    });
    expect(evaluateGate({
      package: changePackage(),
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies: [gatePolicy()],
      documents: [changePackage(), artifactEnvelope(), approval()],
    }).result).toBe("error");
  });

  it("reports but does not fail a non-blocking rule", () => {
    const policy = gatePolicy({
      spec: {
        rules: [{ id: "required-approvals", type: "required-approvals", blocking: false }],
      },
    });
    const profile = workflowProfile({
      spec: {
        phases: [{
          phase: "requirements",
          required: true,
          requiredArtifactTypes: [],
          requiredTraceRelations: [],
          humanApproval: "conditional",
          minimumApprovals: 1,
          enabledRuleIds: ["required-approvals"],
        }],
      },
    });
    const result = evaluateGate({
      package: changePackage(),
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies: [policy],
      documents: [changePackage()],
    });
    expect(result.result).toBe("pass");
    expect(result.evaluations[0]).toMatchObject({ blocking: false, outcome: "fail" });
  });
});
```

- [ ] **Step 7: Run policy tests to verify the evaluator is missing**

Run:

```bash
npm test -- tests/contracts/profile-files.test.ts tests/policy/evaluate-gate.test.ts
```

Expected: both suites FAIL because the profile-configuration and gate evaluators do not exist yet.

- [ ] **Step 8: Implement deterministic gate evaluation**

Create `src/kernel/policy/evaluate-gate.ts` with:

```ts
import type {
  AnyDocument,
  ChangePackage,
  GatePolicy,
  PhaseProfile,
  RuleEvaluation,
  WorkflowProfile,
} from "../contracts/types.js";
import type { Phase, RuleType } from "../contracts/vocabulary.js";
import { validateGraphIntegrity } from "../graph/evidence-graph.js";

export interface EvaluateGateInput {
  package: ChangePackage;
  phase: Phase;
  evaluationTime: string;
  profile: WorkflowProfile;
  policies: GatePolicy[];
  documents: AnyDocument[];
}

export interface GateEvaluation {
  result: "pass" | "fail" | "error";
  evaluations: RuleEvaluation[];
}

export interface ProfileConfigurationIssue {
  ruleId: "missing-policy" | "duplicate-phase" | "undefined-rule" | "approval-configuration";
  message: string;
}

const evaluation = (
  ruleId: string,
  blocking: boolean,
  outcome: RuleEvaluation["outcome"],
  message: string,
): RuleEvaluation => ({ ruleId, blocking, outcome, message, evidence: [] });

export function validateProfileConfiguration(
  profile: WorkflowProfile,
  policies: GatePolicy[],
): ProfileConfigurationIssue[] {
  const issues: ProfileConfigurationIssue[] = [];
  const policiesById = new Map(policies.map((policy) => [policy.metadata.id, policy]));
  for (const policyId of profile.spec.policyIds) {
    if (!policiesById.has(policyId)) {
      issues.push({ ruleId: "missing-policy", message: `profile references missing policy ${policyId}` });
    }
  }

  const referencedPolicies = profile.spec.policyIds
    .map((policyId) => policiesById.get(policyId))
    .filter((policy): policy is GatePolicy => policy !== undefined);
  const rules = new Set(referencedPolicies.flatMap((policy) => policy.spec.rules.map((rule) => rule.id)));
  const seenPhases = new Set<Phase>();
  for (const phase of profile.spec.phases) {
    if (seenPhases.has(phase.phase)) {
      issues.push({ ruleId: "duplicate-phase", message: `profile repeats phase ${phase.phase}` });
    }
    seenPhases.add(phase.phase);
    for (const ruleId of phase.enabledRuleIds) {
      if (!rules.has(ruleId)) {
        issues.push({ ruleId: "undefined-rule", message: `phase ${phase.phase} enables undefined rule ${ruleId}` });
      }
    }
    if (
      (phase.humanApproval === "none" && phase.minimumApprovals !== 0) ||
      (phase.humanApproval === "required" && phase.minimumApprovals < 1)
    ) {
      issues.push({
        ruleId: "approval-configuration",
        message: `phase ${phase.phase} has inconsistent human approval settings`,
      });
    }
  }
  return issues;
}

function evaluateRule(
  type: RuleType,
  ruleId: string,
  blocking: boolean,
  input: EvaluateGateInput,
  phaseProfile: PhaseProfile,
): RuleEvaluation {
  const packageId = input.package.metadata.id;
  const phaseArtifacts = input.documents.filter((document) =>
    document.kind === "ArtifactEnvelope" &&
    document.spec.packageId === packageId &&
    document.spec.phase === input.phase);

  switch (type) {
    case "graph-integrity": {
      const issues = validateGraphIntegrity(input.documents);
      return evaluation(ruleId, blocking, issues.length === 0 ? "pass" : "fail",
        issues.length === 0 ? "evidence graph is valid" : issues.map((issue) => issue.message).join("; "));
    }
    case "required-artifacts": {
      const present = new Set(phaseArtifacts.map((artifact) => artifact.spec.artifactType));
      const missing = phaseProfile.requiredArtifactTypes.filter((type) => !present.has(type));
      return evaluation(ruleId, blocking, missing.length === 0 ? "pass" : "fail",
        missing.length === 0 ? "required artifacts are present" : `missing artifacts: ${missing.join(", ")}`);
    }
    case "required-trace-relations": {
      const present = new Set(phaseArtifacts.flatMap((artifact) => artifact.spec.trace.map((edge) => edge.relation)));
      const missing = phaseProfile.requiredTraceRelations.filter((relation) => !present.has(relation));
      return evaluation(ruleId, blocking, missing.length === 0 ? "pass" : "fail",
        missing.length === 0 ? "required trace relations are present" : `missing trace relations: ${missing.join(", ")}`);
    }
    case "no-open-blocking-findings": {
      const blockers = input.documents.filter((document) =>
        document.kind === "Finding" &&
        document.spec.packageId === packageId &&
        document.spec.phase === input.phase &&
        document.spec.severity === "blocking" &&
        document.spec.status === "open");
      return evaluation(ruleId, blocking, blockers.length === 0 ? "pass" : "fail",
        blockers.length === 0 ? "no open blocking findings" : `${blockers.length} blocking findings remain open`);
    }
    case "required-approvals": {
      const approvals = input.documents.filter((document) =>
        document.kind === "Approval" &&
        document.spec.packageId === packageId &&
        document.spec.phase === input.phase &&
        document.spec.decision === "approved" &&
        (!document.spec.expiresAt || Date.parse(document.spec.expiresAt) > Date.parse(input.evaluationTime)));
      return evaluation(ruleId, blocking, approvals.length >= phaseProfile.minimumApprovals ? "pass" : "fail",
        `${approvals.length}/${phaseProfile.minimumApprovals} required approvals present`);
    }
    case "child-gates-pass": {
      const childIds = input.package.spec.relationships
        .filter((link) => link.relation === "decomposes-into")
        .map((link) => link.target.id);
      const missing = childIds.filter((childId) => {
        const latest = input.documents
          .filter((document) =>
            document.kind === "GateAttempt" &&
            document.spec.packageId === childId &&
            document.spec.phase === input.phase)
          .sort((left, right) => right.metadata.revision - left.metadata.revision)[0];
        return latest?.kind !== "GateAttempt" || latest.spec.result !== "pass";
      });
      return evaluation(ruleId, blocking, missing.length === 0 ? "pass" : "fail",
        missing.length === 0 ? "required child gates pass" : `children without passing gates: ${missing.join(", ")}`);
    }
  }
  const exhaustive: never = type;
  return evaluation(ruleId, blocking, "error", `unsupported rule type ${exhaustive}`);
}

export function evaluateGate(input: EvaluateGateInput): GateEvaluation {
  if (Number.isNaN(Date.parse(input.evaluationTime))) {
    return {
      result: "error",
      evaluations: [evaluation("evaluation-time", true, "error", "evaluationTime must be a valid date-time")],
    };
  }
  const configurationIssues = validateProfileConfiguration(input.profile, input.policies);
  if (configurationIssues.length > 0) {
    return {
      result: "error",
      evaluations: configurationIssues.map((issue) =>
        evaluation(issue.ruleId, true, "error", issue.message)),
    };
  }
  const phaseProfile = input.profile.spec.phases.find((candidate) => candidate.phase === input.phase);
  if (!phaseProfile) {
    return { result: "error", evaluations: [evaluation("profile-phase", true, "error", `profile does not define ${input.phase}`)] };
  }
  if (!phaseProfile.required) return { result: "pass", evaluations: [] };

  const policyRules = new Map(input.policies
    .filter((policy) => input.profile.spec.policyIds.includes(policy.metadata.id))
    .flatMap((policy) =>
    policy.spec.rules.map((rule) => [rule.id, rule] as const)));
  const evaluations = phaseProfile.enabledRuleIds.map((ruleId) => {
    const rule = policyRules.get(ruleId);
    return rule
      ? evaluateRule(rule.type, ruleId, rule.blocking, input, phaseProfile)
      : evaluation(ruleId, true, "error", `enabled rule ${ruleId} is undefined`);
  });
  const result = evaluations.some((item) => item.outcome === "error")
    ? "error"
    : evaluations.some((item) => item.blocking && item.outcome === "fail")
      ? "fail"
      : "pass";
  return { result, evaluations };
}
```

- [ ] **Step 9: Verify profile-driven policy behavior**

Run:

```bash
npm test -- tests/contracts/profile-files.test.ts tests/policy/evaluate-gate.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add .loop/policies .loop/profiles src/kernel/policy tests/policy tests/contracts/profile-files.test.ts
git commit -m "feat: evaluate profile-driven gate policies"
```

### Task 8: Evaluate Gate-Evidence Freshness

**Files:**
- Create: `src/kernel/freshness/evaluate-freshness.ts`
- Create: `tests/freshness/evaluate-freshness.test.ts`
- Modify: `src/kernel/policy/evaluate-gate.ts`

- [ ] **Step 1: Write failing freshness tests**

Create `tests/freshness/evaluate-freshness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { digestDocument } from "../../src/kernel/canonical/canonicalize.js";
import { evaluateFreshness } from "../../src/kernel/freshness/evaluate-freshness.js";
import { evaluateGate } from "../../src/kernel/policy/evaluate-gate.js";
import {
  artifactEnvelope,
  changePackage,
  gateAttempt,
  gatePolicy,
  workflowProfile,
} from "../fixtures/builders.js";

describe("evaluateFreshness", () => {
  it("is fresh when every bound exact revision and digest matches", () => {
    const artifact = artifactEnvelope();
    const gate = gateAttempt({
      spec: {
        boundEvidence: [{
          kind: artifact.kind,
          id: artifact.metadata.id,
          revision: artifact.metadata.revision,
          digest: digestDocument(artifact),
        }],
      },
    });
    expect(evaluateFreshness(gate, [artifact])).toEqual({ status: "fresh", issues: [] });
  });

  it("is stale when a bound document digest changes", () => {
    const artifact = artifactEnvelope();
    const gate = gateAttempt({
      spec: {
        boundEvidence: [{
          kind: artifact.kind,
          id: artifact.metadata.id,
          revision: artifact.metadata.revision,
          digest: digestDocument(artifact),
        }],
      },
    });
    const changed = artifactEnvelope({ spec: { content: { digest: `sha256:${"9".repeat(64)}` } } });
    expect(evaluateFreshness(gate, [changed]).status).toBe("stale");
  });

  it("is stale when a bound document is missing", () => {
    const gate = gateAttempt({
      spec: {
        boundEvidence: [{
          kind: "ArtifactEnvelope",
          id: "ART-MISSING",
          revision: 1,
          digest: `sha256:${"1".repeat(64)}`,
        }],
      },
    });
    expect(evaluateFreshness(gate, []).status).toBe("stale");
  });

  it("prevents a parent gate from accepting a stale child pass", () => {
    const child = changePackage({ metadata: { id: "CHG-TASK-CHILD" } });
    const parent = changePackage({
      metadata: { id: "CHG-FEAT-PARENT" },
      spec: {
        relationships: [{
          relation: "decomposes-into",
          target: {
            kind: "ChangePackage",
            id: child.metadata.id,
            revision: child.metadata.revision,
            digest: digestDocument(child),
          },
        }],
      },
    });
    const childArtifact = artifactEnvelope({ spec: { packageId: child.metadata.id } });
    const staleChildGate = gateAttempt({
      spec: {
        packageId: child.metadata.id,
        result: "pass",
        boundEvidence: [{
          kind: childArtifact.kind,
          id: childArtifact.metadata.id,
          revision: childArtifact.metadata.revision,
          digest: `sha256:${"0".repeat(64)}`,
        }],
      },
    });
    const profile = workflowProfile({
      spec: {
        phases: [{
          phase: "requirements",
          required: true,
          requiredArtifactTypes: [],
          requiredTraceRelations: [],
          humanApproval: "none",
          minimumApprovals: 0,
          enabledRuleIds: ["child-gates-pass"],
        }],
      },
    });
    const result = evaluateGate({
      package: parent,
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies: [gatePolicy()],
      documents: [parent, child, childArtifact, staleChildGate],
    });
    expect(result.evaluations).toContainEqual(expect.objectContaining({
      ruleId: "child-gates-pass",
      outcome: "fail",
    }));
  });
});
```

- [ ] **Step 2: Run freshness tests to verify they fail**

Run:

```bash
npm test -- tests/freshness/evaluate-freshness.test.ts
```

Expected: FAIL because the freshness evaluator does not exist.

- [ ] **Step 3: Implement freshness comparison**

Create `src/kernel/freshness/evaluate-freshness.ts`:

```ts
import { digestDocument } from "../canonical/canonicalize.js";
import type { AnyDocument, GateAttempt } from "../contracts/types.js";
import { buildEvidenceGraph, evidenceRefKey } from "../graph/evidence-graph.js";

export interface FreshnessIssue {
  reference: string;
  reason: "missing" | "digest-mismatch";
}

export interface FreshnessResult {
  status: "fresh" | "stale";
  issues: FreshnessIssue[];
}

export function evaluateFreshness(gate: GateAttempt, currentDocuments: AnyDocument[]): FreshnessResult {
  const graph = buildEvidenceGraph(currentDocuments);
  const issues: FreshnessIssue[] = [];

  for (const reference of gate.spec.boundEvidence) {
    const key = evidenceRefKey(reference);
    const current = graph.byKey.get(key);
    if (!current) {
      issues.push({ reference: key, reason: "missing" });
    } else if (digestDocument(current) !== reference.digest) {
      issues.push({ reference: key, reason: "digest-mismatch" });
    }
  }

  return { status: issues.length === 0 ? "fresh" : "stale", issues };
}
```

- [ ] **Step 4: Make parent gates require fresh child passes**

Modify `src/kernel/policy/evaluate-gate.ts` to import `evaluateFreshness`:

```ts
import { evaluateFreshness } from "../freshness/evaluate-freshness.js";
```

Then replace the latest-child result check inside `child-gates-pass` with:

```ts
return (
  latest?.kind !== "GateAttempt" ||
  latest.spec.result !== "pass" ||
  evaluateFreshness(latest, input.documents).status !== "fresh"
);
```

- [ ] **Step 5: Verify freshness behavior**

Run:

```bash
npm test -- tests/freshness/evaluate-freshness.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/kernel/freshness tests/freshness
git add src/kernel/policy/evaluate-gate.ts
git commit -m "feat: detect stale gate evidence"
```

### Task 9: Expose the Kernel API and Prove an End-to-End Scenario

**Files:**
- Modify: `src/kernel/index.ts`
- Create: `tests/integration/kernel.test.ts`
- Create: `docs/kernel/contract-kernel.md`

- [ ] **Step 1: Write the failing end-to-end kernel test**

Create `tests/integration/kernel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  digestDocument,
  evaluateFreshness,
  evaluateGate,
  validateDocument,
  validateGraphIntegrity,
} from "../../src/kernel/index.js";
import {
  approval,
  artifactEnvelope,
  changePackage,
  gateAttempt,
  gatePolicy,
  workflowProfile,
} from "../fixtures/builders.js";

describe("contract kernel integration", () => {
  it("validates, evaluates, records, and invalidates a phase gate", () => {
    const packageDocument = changePackage();
    const requirement = artifactEnvelope();
    const reviewerApproval = approval();
    const profile = workflowProfile();
    const policy = gatePolicy();
    const documents = [packageDocument, requirement, reviewerApproval, profile, policy];

    for (const document of documents) expect(validateDocument(document).valid).toBe(true);
    expect(validateGraphIntegrity(documents)).toEqual([]);

    const evaluation = evaluateGate({
      package: packageDocument,
      phase: "requirements",
      evaluationTime: "2026-06-11T12:00:00.000Z",
      profile,
      policies: [policy],
      documents,
    });
    expect(evaluation.result).toBe("pass");

    const gate = gateAttempt({
      spec: {
        boundEvidence: documents.map((document) => ({
          kind: document.kind,
          id: document.metadata.id,
          revision: document.metadata.revision,
          digest: digestDocument(document),
        })),
        evaluations: evaluation.evaluations,
        result: evaluation.result,
      },
    });
    expect(evaluateFreshness(gate, documents).status).toBe("fresh");

    const changedRequirement = artifactEnvelope({
      spec: { content: { digest: `sha256:${"f".repeat(64)}` } },
    });
    expect(evaluateFreshness(gate, [
      packageDocument,
      changedRequirement,
      reviewerApproval,
      profile,
      policy,
    ]).status).toBe("stale");
  });
});
```

- [ ] **Step 2: Run the integration test to verify public exports are missing**

Run:

```bash
npm test -- tests/integration/kernel.test.ts
```

Expected: FAIL because the public API does not export the kernel functions.

- [ ] **Step 3: Export the stable kernel API**

Replace `src/kernel/index.ts` with:

```ts
export const KERNEL_API_VERSION = "loop.dev/v1" as const;

export * from "./canonical/canonicalize.js";
export * from "./contracts/types.js";
export * from "./contracts/vocabulary.js";
export * from "./freshness/evaluate-freshness.js";
export * from "./graph/evidence-graph.js";
export * from "./io/load-document.js";
export * from "./policy/evaluate-gate.js";
export * from "./validation/schema-registry.js";
```

- [ ] **Step 4: Document the kernel boundary and invariants**

Create `docs/kernel/contract-kernel.md`:

```markdown
# Contract Kernel

The contract kernel is the shared deterministic foundation for Loop Skills. It defines contract documents, validates YAML or JSON records, computes canonical SHA-256 digests, checks evidence-graph integrity, evaluates profile-driven deterministic rules, and detects stale gate evidence.

## Public API

- `validateDocument` and `loadDocument`: schema validation for contract records.
- `canonicalize`, `sha256Digest`, and `digestDocument`: formatting-independent evidence identity.
- `buildEvidenceGraph` and `validateGraphIntegrity`: exact-revision reference and package-cycle checks.
- `evaluateGate`: deterministic profile and policy checks.
- `evaluateFreshness`: comparison of gate-bound evidence with the current snapshot.

## Invariants

1. Every document uses `apiVersion: loop.dev/v1` and a supported contract kind.
2. Every evidence reference names an exact kind, ID, revision, and digest.
3. Graph references must resolve and match the current document digest.
4. Package decomposition must be acyclic.
5. A gate passes only when all enabled deterministic rules pass.
6. A gate becomes stale when any bound exact revision is missing or has a different digest.
7. Parent gates accept only the latest passing and fresh child gate.
8. Human approval requirements come only from the active workflow profile or later escalation logic.

## Deliberate Limits

This package does not invoke agents, create phase artifacts, orchestrate lifecycle loops, render audit reports, or enforce GitHub rules. Those responsibilities consume this public API in later subprojects.
```

- [ ] **Step 5: Run the full verification suite**

Run:

```bash
npm run verify
git diff --exit-code -- .loop/schemas/v1
```

Expected:

- Schema generation produces no uncommitted drift.
- Typecheck passes.
- All unit and integration tests pass.
- Build emits declarations and JavaScript under `dist/`.

- [ ] **Step 6: Commit**

```bash
git add src/kernel/index.ts tests/integration/kernel.test.ts docs/kernel/contract-kernel.md .loop/schemas/v1
git commit -m "feat: expose deterministic contract kernel"
```

## Completion Criteria

Subproject 1 is complete only when:

1. Every contract kind has a committed JSON Schema 2020-12 document and a valid/invalid schema test.
2. YAML and JSON contract records produce structured validation errors.
3. Canonical digest tests prove key-order and formatting independence.
4. Exact-revision evidence references resolve and digest mismatches are detected.
5. Package-decomposition cycles are rejected.
6. Routine profiles can omit human approvals, while standard and high-risk profiles require only their configured approvals.
7. Deterministic gate evaluation covers required artifacts, trace relations, blocking findings, unexpired approvals, latest fresh child gates, graph integrity, and non-blocking policy rules.
8. Changed or missing bound evidence marks a gate stale.
9. `npm run verify` passes and generated schemas have no drift.
10. The public kernel API is documented and contains no CLI, agent-runtime, phase-skill, Lifecycle Loop, or GitHub-specific implementation.

## Reference Documentation

- Approved design: `docs/superpowers/specs/2026-06-11-ai-native-loop-skills-ecosystem-design.md`
- [Ajv JSON Schema 2020-12 support](https://ajv.js.org/json-schema.html)
- [Node.js Crypto API](https://nodejs.org/api/crypto.html)
- [YAML package documentation](https://eemeli.org/yaml/)
- [Vitest guide](https://vitest.dev/guide/)
