import { validateDocument } from "../../kernel/validation/schema-registry.js";
import type { SkillInvocationResult } from "./types.js";

export interface InvocationValidationIssue {
  path: string;
  message: string;
}

export function validateSkillInvocationResult(result: SkillInvocationResult): InvocationValidationIssue[] {
  const issues: InvocationValidationIssue[] = [];

  if (result.status === "success") {
    if (!result.envelope) {
      issues.push({ path: "envelope", message: "successful invocation must include an artifact envelope" });
    } else if (!validateDocument(result.envelope).valid) {
      issues.push({ path: "envelope", message: "artifact envelope failed schema validation" });
    }
    if (!result.artifactContentPath) {
      issues.push({ path: "artifactContentPath", message: "successful invocation must include artifact content path" });
    }
  }

  if (result.status === "error" && !result.error) {
    issues.push({ path: "error", message: "error invocation must include error message" });
  }

  for (const [index, finding] of result.findings.entries()) {
    if (!validateDocument(finding).valid) {
      issues.push({ path: `findings[${index}]`, message: "finding failed schema validation" });
    }
  }

  if (
    result.selfCheck.result !== "pass" &&
    result.selfCheck.result !== "fail" &&
    result.selfCheck.result !== "error"
  ) {
    issues.push({ path: "selfCheck.result", message: "invalid self-check result" });
  }

  return issues;
}
