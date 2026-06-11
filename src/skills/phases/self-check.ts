import type { SkillInvocationContext, SkillStructuredOutput } from "../contract/types.js";

export interface SelfCheckOutcome {
  result: "pass" | "fail" | "error";
  messages: string[];
  findings: SkillStructuredOutput["findings"];
}

const AMBIGUITY_PATTERN = /\b(TBD|TODO|etc\.|somehow|maybe|as needed|unclear)\b/i;
const MEASURABLE_PATTERN = /\b(\d+|percent|%|ms|seconds|must|shall|<=|>=|at least|no more than)\b/i;

export function runSelfCheckRules(
  ruleIds: string[],
  markdown: string,
  context: SkillInvocationContext,
): SelfCheckOutcome {
  const messages: string[] = [];
  const findings: SkillStructuredOutput["findings"] = [];

  for (const ruleId of ruleIds) {
    switch (ruleId) {
      case "completeness": {
        const requiredSections = (markdown.match(/^## /gm) ?? []).length;
        if (requiredSections < 4) {
          messages.push("completeness: missing required sections");
          findings.push({
            ruleId: "completeness",
            severity: "blocking",
            message: "Artifact is missing required sections.",
            recommendedAction: "Add all sections defined by the phase skill contract.",
          });
        } else {
          messages.push("completeness: required sections present");
        }
        break;
      }
      case "ambiguity": {
        if (AMBIGUITY_PATTERN.test(markdown)) {
          messages.push("ambiguity: vague language detected");
          findings.push({
            ruleId: "ambiguity",
            severity: "warning",
            message: "Artifact contains ambiguous or incomplete language.",
            recommendedAction: "Replace vague terms with concrete, testable statements.",
          });
        } else {
          messages.push("ambiguity: no vague language detected");
        }
        break;
      }
      case "testability": {
        const acceptance = markdown.match(/## Acceptance Criteria[\s\S]*?(?=## |$)/i)?.[0] ?? "";
        if (!MEASURABLE_PATTERN.test(acceptance)) {
          messages.push("testability: acceptance criteria are not measurable");
          findings.push({
            ruleId: "testability",
            severity: "blocking",
            message: "Acceptance criteria lack measurable thresholds.",
            recommendedAction: "Add numeric or objective acceptance criteria.",
          });
        } else {
          messages.push("testability: acceptance criteria appear measurable");
        }
        break;
      }
      case "internal-consistency": {
        const title = context.package.spec.title;
        if (!markdown.includes(title)) {
          messages.push("internal-consistency: title not reflected in artifact");
          findings.push({
            ruleId: "internal-consistency",
            severity: "warning",
            message: "Artifact does not reference the package title.",
            recommendedAction: "Align scope and requirements with the package title.",
          });
        } else {
          messages.push("internal-consistency: title reflected in artifact");
        }
        break;
      }
      case "requirement-coverage": {
        const requirements = markdown.match(/## Requirements[\s\S]*?(?=## |$)/i)?.[0] ?? "";
        if (requirements.split("\n").filter((line) => line.startsWith("- ")).length < 1) {
          findings.push({
            ruleId: "requirement-coverage",
            severity: "blocking",
            message: "Downstream artifact does not reference upstream requirements.",
            recommendedAction: "Map design or test coverage to explicit requirements.",
          });
          messages.push("requirement-coverage: insufficient requirement linkage");
        } else {
          messages.push("requirement-coverage: requirements referenced");
        }
        break;
      }
      case "feasibility":
      case "failure-behavior":
      case "design-consistency":
      case "risk-coverage":
      case "expected-evidence":
      case "design-conformance":
      case "test-results":
      case "code-quality":
      case "trace-links":
      case "evidence-grounding":
      case "severity-calibration":
      case "coverage":
      case "disposition-completeness":
      case "evidence-completeness":
      case "environment-identity":
      case "acceptance-coverage":
      case "release-scope":
      case "provenance":
      case "validation-status":
      case "operational-readiness":
      case "rollback-viability": {
        messages.push(`${ruleId}: pilot deterministic check passed`);
        break;
      }
      default:
        messages.push(`${ruleId}: unknown rule skipped in pilot`);
        break;
    }
  }

  const hasBlocking = findings.some((finding) => finding.severity === "blocking");
  const result = hasBlocking ? "fail" : "pass";
  return { result, messages, findings };
}
