import type { Phase } from "../../kernel/contracts/vocabulary.js";

export const PHASE_ARTIFACT_FILES: Record<Phase, string> = {
  requirements: "requirements.md",
  design: "design.md",
  "test-planning": "test-plan.md",
  implementation: "implementation.md",
  review: "review-report.md",
  validation: "validation-report.md",
  release: "release-record.md",
};
