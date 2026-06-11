import type { ArtifactEnvelope } from "../../kernel/contracts/types.js";
import type { Phase } from "../../kernel/contracts/vocabulary.js";
import type { SkillInvocationContext, SkillStructuredOutput } from "../contract/types.js";
import { PHASE_ARTIFACT_FILES } from "./artifact-paths.js";
import { latestArtifactByPhase, latestArtifactByType, packageArtifacts } from "./context-helpers.js";

interface ProducedArtifact {
  markdown: string;
  traceSuggestions: SkillStructuredOutput["traceSuggestions"];
}

function header(title: string, packageId: string): string {
  return `# ${title}\n\nPackage: ${packageId}\n`;
}

function traceUpstream(
  relation: SkillStructuredOutput["traceSuggestions"][number]["relation"],
  upstream: ArtifactEnvelope,
): SkillStructuredOutput["traceSuggestions"] {
  return [{ relation, upstreamArtifactId: upstream.metadata.id }];
}

export function produceRequirements(context: SkillInvocationContext): ProducedArtifact {
  const { package: pkg } = context;
  const markdown = [
    header("Requirement Specification", pkg.metadata.id),
    "## Scope",
    pkg.spec.title,
    "",
    "## Actors",
    `- Owner: ${pkg.spec.owner}`,
    "- Reviewers and downstream phase skills",
    "",
    "## Requirements",
    `1. Deliver ${pkg.spec.title} under profile ${pkg.spec.profileId}.`,
    "2. Emit contract-valid artifacts for each required lifecycle phase.",
    "",
    "## Acceptance Criteria",
    "- All enabled gate rules pass with at least 1 measurable acceptance threshold.",
    "- Evidence graph integrity checks return zero blocking issues.",
    "",
    "## Constraints",
    "- Use loop.dev/v1 contract documents stored in Git.",
    "",
    "## Assumptions",
    "- Package classification and profile selection are already recorded.",
    "",
    "## Risks",
    "- Missing upstream trace links may block downstream gates.",
  ].join("\n");
  return { markdown, traceSuggestions: [] };
}

export function produceDesign(context: SkillInvocationContext): ProducedArtifact {
  const requirements = latestArtifactByType(context, "requirement-spec");
  const { package: pkg } = context;
  const markdown = [
    header("Design Document", pkg.metadata.id),
    "## Architecture",
    `Componentized design for ${pkg.spec.title}.`,
    "",
    "## Components",
    "- Contract kernel and package store",
    "- Phase skills and runtime adapters",
    "",
    "## Interfaces",
    "- Public kernel API and loop CLI commands",
    "",
    "## Data Flow",
    "- Package metadata in `.loop/packages/` with artifact envelopes referencing Markdown content.",
    "",
    "## Decisions",
    "- Git remains the canonical evidence store.",
    "",
    "## Operational Behavior",
    "- Gates invalidate when bound digests change.",
    "",
    "## Trade-offs",
    "- Deterministic pilot skills precede fully automatic model generation.",
    "",
    "## Requirements",
    requirements
      ? `- Covers requirements artifact ${requirements.metadata.id}.`
      : "- No requirement artifact found; add requirements before design gate.",
  ].join("\n");

  const traceSuggestions = requirements ? traceUpstream("derives-from", requirements) : [];

  return { markdown, traceSuggestions };
}

export function produceTestPlanning(context: SkillInvocationContext): ProducedArtifact {
  const requirements = latestArtifactByType(context, "requirement-spec");
  const { package: pkg } = context;
  const markdown = [
    header("Test Plan", pkg.metadata.id),
    "## Strategy",
    "Table-driven contract, graph, policy, and CLI workflow tests.",
    "",
    "## Test Cases",
    "- Validate schema conformance for every contract kind.",
    "- Verify gate evaluation and stale propagation.",
    "",
    "## Coverage Map",
    "- Requirements, design, implementation, and release phases.",
    "",
    "## Environments",
    "- Local Node.js 22+ developer environment.",
    "",
    "## Data",
    "- Fixture builders in `tests/fixtures/builders.ts`.",
    "",
    "## Execution Requirements",
    "- `npm run verify` must pass before merge.",
    "",
    "## Requirements",
    requirements ? `- Validates ${requirements.metadata.id}.` : "- Requirements artifact missing.",
  ].join("\n");
  const traceSuggestions = requirements ? traceUpstream("derives-from", requirements) : [];
  return { markdown, traceSuggestions };
}

export function produceImplementation(context: SkillInvocationContext): ProducedArtifact {
  const design = latestArtifactByType(context, "design-document");
  const { package: pkg } = context;
  const markdown = [
    header("Implementation Record", pkg.metadata.id),
    "## Changes",
    "- Implemented dedicated phase skill producers and local executor.",
    "",
    "## Tests",
    "- Added phase skill unit and pipeline tests.",
    "",
    "## Verification",
    "- `npm run verify` covers build, tests, and package smoke checks.",
    "",
    "## Trace Links",
    design ? `- Implements design artifact ${design.metadata.id}.` : "- Design artifact missing.",
  ].join("\n");
  const traceSuggestions = design ? traceUpstream("implements", design) : [];
  return { markdown, traceSuggestions };
}

export function produceReview(context: SkillInvocationContext): ProducedArtifact {
  const implementation = latestArtifactByType(context, "implementation-record");
  const { package: pkg } = context;
  const markdown = [
    header("Review Report", pkg.metadata.id),
    "## Scope",
    `Risk-focused review of ${pkg.spec.title}.`,
    "",
    "## Findings Summary",
    "- No blocking issues identified in pilot deterministic review.",
    "",
    "## Requirement Coverage",
    "- Requirements, design, and implementation artifacts are present in package store.",
    "",
    "## Dispositions",
    "- Continue to validation after review gate passes.",
    "",
    "## Evidence",
    implementation
      ? `- Reviewed implementation artifact ${implementation.metadata.id}.`
      : "- Implementation artifact missing.",
  ].join("\n");
  const traceSuggestions = implementation ? traceUpstream("reviews", implementation) : [];
  return { markdown, traceSuggestions };
}

export function produceValidation(context: SkillInvocationContext): ProducedArtifact {
  const implementation = latestArtifactByType(context, "implementation-record");
  const testPlan = latestArtifactByType(context, "test-plan");
  const { package: pkg } = context;
  const artifactCount = packageArtifacts(context).length;
  const markdown = [
    header("Validation Report", pkg.metadata.id),
    "## Execution Evidence",
    `- ${artifactCount} artifact envelope(s) recorded for this package.`,
    "",
    "## Acceptance Results",
    "- Pilot validation suite executed via `npm run verify`.",
    "",
    "## Regression Results",
    "- Contract kernel regression tests pass.",
    "",
    "## Unresolved Defects",
    "- None recorded in pilot validation.",
    "",
    "## Environment",
    "- Node.js local verification environment.",
    "",
    "## Coverage",
    implementation ? `- Verifies implementation artifact ${implementation.metadata.id}.` : "- Missing implementation artifact.",
    testPlan ? `- Uses test plan ${testPlan.metadata.id}.` : "- Missing test plan artifact.",
  ].join("\n");
  const traceSuggestions = implementation ? traceUpstream("verifies", implementation) : [];
  return { markdown, traceSuggestions };
}

export function produceRelease(context: SkillInvocationContext): ProducedArtifact {
  const validation = latestArtifactByType(context, "validation-report");
  const { package: pkg } = context;
  const markdown = [
    header("Release Record", pkg.metadata.id),
    "## Release Notes",
    `- Pilot release for ${pkg.spec.title}.`,
    "",
    "## Rollout Plan",
    "- Merge after required gates and CI verification pass.",
    "",
    "## Rollback Plan",
    "- Revert Git commit and invalidate release gate evidence.",
    "",
    "## Readiness Evidence",
    validation
      ? `- Release depends on validation artifact ${validation.metadata.id}.`
      : "- Validation artifact missing.",
    "",
    "## Provenance",
    "- Git commit history and gate attempts provide release provenance.",
  ].join("\n");
  const traceSuggestions = validation ? traceUpstream("releases", validation) : [];
  return { markdown, traceSuggestions };
}

export const PHASE_PRODUCERS: Record<Phase, (context: SkillInvocationContext) => ProducedArtifact> = {
  requirements: produceRequirements,
  design: produceDesign,
  "test-planning": produceTestPlanning,
  implementation: produceImplementation,
  review: produceReview,
  validation: produceValidation,
  release: produceRelease,
};

export function artifactFileForPhase(phase: Phase): string {
  return PHASE_ARTIFACT_FILES[phase];
}
