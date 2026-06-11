import type {
  AnyDocument,
  ChangePackage,
  Finding,
  GatePolicy,
  RuleEvaluation,
  WorkflowProfile,
} from "../kernel/contracts/types.js";
import type { GateResult, Phase } from "../kernel/contracts/vocabulary.js";

export interface EscalationNotice {
  trigger: "classification-override" | "recurring-blocking-finding" | "attempt-budget";
  message: string;
  requiredApprovals: number;
}

export interface ReentryRecommendation {
  phase: Phase;
  reason: string;
  attemptCount: number;
  maxAttempts: number;
}

export interface LifecycleLoopGateInput {
  package: ChangePackage;
  phase: Phase;
  evaluationTime: string;
  profile: WorkflowProfile;
  policies: GatePolicy[];
  documents: AnyDocument[];
}

export interface LifecycleLoopGateResult {
  result: GateResult;
  evaluations: RuleEvaluation[];
  escalations: EscalationNotice[];
  reentry?: ReentryRecommendation;
  emittedFindings: Finding[];
}
