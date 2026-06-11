import type {
  AnyDocument,
  ArtifactEnvelope,
  ChangePackage,
  GatePolicy,
  PhaseProfile,
  RuleEvaluation,
  WorkflowProfile,
} from "../contracts/types.js";
import type { Phase, RuleType } from "../contracts/vocabulary.js";
import { evaluateFreshness } from "../freshness/evaluate-freshness.js";
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

function isPhaseArtifact(
  document: AnyDocument,
  packageId: string,
  phase: Phase,
): document is ArtifactEnvelope {
  return document.kind === "ArtifactEnvelope" &&
    document.spec.packageId === packageId &&
    document.spec.phase === phase;
}

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
    isPhaseArtifact(document, packageId, input.phase));

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
        return (
          latest?.kind !== "GateAttempt" ||
          latest.spec.result !== "pass" ||
          evaluateFreshness(latest, input.documents).status !== "fresh"
        );
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
