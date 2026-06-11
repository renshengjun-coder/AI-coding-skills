import type {
  ArtifactEnvelope,
  ChangePackage,
  Finding,
  TraceEdge,
} from "../../kernel/contracts/types.js";
import type { ArtifactRelationship, ArtifactType, Phase } from "../../kernel/contracts/vocabulary.js";
import type { PhaseSkillManifest } from "./manifest.js";

export interface RuntimeIdentity {
  runtime: string;
  modelId?: string;
  actor: string;
}

export interface SkillInvocationContext {
  workspaceRoot: string;
  loopRoot: string;
  package: ChangePackage;
  documents: import("../../kernel/contracts/types.js").AnyDocument[];
  phase: Phase;
  actor: string;
}

export interface SkillInvocationInput {
  skill: PhaseSkillManifest;
  context: SkillInvocationContext;
}

export interface SelfCheckReport {
  result: "pass" | "fail" | "error";
  ruleIds: string[];
  messages: string[];
}

export interface SkillStructuredOutput {
  artifactMarkdown: string;
  artifactRelativePath: string;
  selfCheck: {
    result: "pass" | "fail" | "error";
    messages: string[];
  };
  findings: Array<{
    ruleId: string;
    severity: "info" | "warning" | "blocking";
    message: string;
    recommendedAction: string;
  }>;
  traceSuggestions: Array<{
    relation: ArtifactRelationship;
    upstreamArtifactId: string;
  }>;
}

export interface SkillInvocationResult {
  status: "success" | "error";
  runtime: RuntimeIdentity;
  artifactMarkdown?: string;
  artifactContentPath?: string;
  envelope?: ArtifactEnvelope;
  findings: Finding[];
  suggestedTrace: TraceEdge[];
  selfCheck: SelfCheckReport;
  error?: string;
}

export interface RuntimeRequest {
  runtime: string;
  modelId?: string;
  skillId?: string;
  skillPhase?: Phase;
  systemPrompt: string;
  userPrompt: string;
  capabilities: string[];
  workspaceRoot: string;
  responseSchema: "skill-structured-output-v1";
}

export interface RuntimeResponse {
  status: "success" | "error";
  modelId?: string;
  structuredOutput?: SkillStructuredOutput;
  rawOutput?: string;
  error?: string;
}

export interface RuntimeExecutor {
  execute(request: RuntimeRequest): Promise<RuntimeResponse>;
}

export interface RuntimeAdapter {
  readonly runtimeId: string;
  invoke(input: SkillInvocationInput): Promise<SkillInvocationResult>;
}

export const PHASE_ARTIFACT_TYPES: Record<Phase, ArtifactType> = {
  requirements: "requirement-spec",
  design: "design-document",
  "test-planning": "test-plan",
  implementation: "implementation-record",
  review: "review-report",
  validation: "validation-report",
  release: "release-record",
};
