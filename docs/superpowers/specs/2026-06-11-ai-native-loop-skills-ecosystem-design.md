# AI-Native Loop Skills Ecosystem Design

**Status:** Approved design
**Date:** 2026-06-11
**Initial scope:** Single-repository pilot using GitHub and GitHub Actions

## 1. Purpose

This design defines an end-to-end, AI-native software development workflow in which every independently planned work item produces reviewable, versioned, traceable, and auditable artifacts.

The ecosystem combines:

- Independently usable phase skills for requirements, design, test planning, implementation, review, validation, and release.
- A universal Lifecycle Loop Skill that applies complexity-based workflow policy, evaluates phase outputs, controls re-entry, and issues final phase-gate decisions.
- A runtime-neutral contract kernel shared by Codex, Claude Code, future agent runtimes, the local `loop` CLI, and GitHub Actions.
- Git-first manifests and narrative artifacts, with stable links to specialized external systems.
- Independent GitHub Actions enforcement for merge and release.

The design targets engineering-grade auditability rather than a specific regulatory framework.

## 2. Design Decisions

The approved design is based on these decisions:

1. Gate enforcement is hybrid: AI skills guide and evaluate the workflow, while CI independently verifies evidence and blocks merge or release.
2. Git is the canonical system of record for package manifests, artifact metadata, traceability, findings, decisions, and gate attempts.
3. External systems remain authoritative for specialized records and are linked through stable IDs, URLs, and immutable evidence references.
4. The pilot supports a single repository and GitHub Actions.
5. Approvals are risk-based and profile-driven, not required for every phase.
6. Each feature, requirement, bug fix, or independently planned development task owns a separate change package.
7. Large work is represented by parent and child change packages. Parent gates aggregate child evidence without copying it.
8. Workflow progression permits controlled re-entry. Upstream artifacts may be revised while prior revisions and decisions remain visible.
9. Dedicated phase skills perform work and self-checks. One universal Lifecycle Loop Skill performs final checks and issues phase-gate decisions.
10. The initial complexity classifier combines deterministic rules with authorized, justified human overrides. A future fully automatic classifier must emit the same decision contract.
11. The primary user interface is a single `loop` CLI.
12. Skills are runtime-portable through thin runtime adapters.

## 3. Scope

### 3.1 In Scope

- A portable contract kernel and deterministic validators.
- Seven dedicated, independently invokable phase skills.
- One universal Lifecycle Loop Skill.
- Complexity classification and workflow profile selection.
- Work-item change packages and parent-child package relationships.
- Artifact envelopes, typed trace links, findings, decisions, approvals, waivers, and gate attempts.
- Local CLI commands for creating, operating, inspecting, and auditing packages.
- GitHub Actions verification, merge enforcement, protected release environments, and release attestations.
- Testing and rollout strategy for the single-repository pilot.

### 3.2 Out of Scope for the Pilot

- A centralized workflow service or database.
- Organization-wide dashboards and cross-repository governance.
- Fully automatic complexity classification.
- Formal certification against a regulated standard.
- Replacing specialized external issue, test, deployment, or observability systems.
- Requiring a human approval at every phase.

## 4. Architecture

### 4.1 Contract Kernel

The contract kernel is the stable center of the ecosystem. It is a versioned specification plus deterministic validators, not a centralized workflow service.

It defines:

- Change-package schemas.
- Artifact envelope schemas.
- Package and artifact relationship types.
- Finding, decision, approval, waiver, and gate-attempt schemas.
- Workflow profile and gate-policy schemas.
- Freshness and invalidation rules.
- Runtime adapter and phase-skill interfaces.
- Canonicalization and digest rules.
- Audit reconstruction rules.

All consumers must use the same kernel contracts:

- Dedicated phase skills.
- The Lifecycle Loop Skill.
- Runtime adapters.
- The `loop` CLI.
- GitHub Actions.
- Audit-report generators.

### 4.2 Three-Level Quality Model

Each phase is evaluated at three levels.

#### Level 1: Phase Skill Self-Check

A dedicated phase skill:

1. Loads relevant package and upstream artifact context.
2. Creates or revises its phase artifact.
3. Performs a phase-local self-check.
4. Emits a conforming artifact envelope and structured self-check report.

A phase skill can be invoked independently. It cannot issue a final phase-gate pass.

#### Level 2: Lifecycle Loop Final Check

The universal Lifecycle Loop Skill:

1. Loads the package classification and active workflow profile.
2. Verifies phase output and self-check evidence.
3. Evaluates required cross-artifact consistency, traceability, findings, approvals, and freshness.
4. Produces structured findings or a final phase-gate decision.
5. Re-enters the owning phase when revisions are required.

The Lifecycle Loop may invoke phase skills during an end-to-end run or evaluate artifacts produced by directly invoked phase skills.

#### Level 3: GitHub Actions Enforcement

GitHub Actions independently:

- Recomputes deterministic checks.
- Validates gate evidence and freshness.
- Validates required approvals, waivers, and child-package results.
- Enforces merge and release rules.

The Lifecycle Loop may declare a local or proposed gate pass, but GitHub Actions is authoritative for merge and release.

### 4.3 Runtime Portability

The core skill contracts are runtime-neutral. A runtime adapter is responsible for:

- Loading the portable skill definition.
- Providing permitted tools and repository context.
- Invoking the selected model/runtime.
- Capturing evaluator identity and execution metadata.
- Returning structured outputs through the shared contract.

The pilot provides Codex and Claude Code adapters. Other runtimes can be added without changing package, artifact, gate, or policy contracts.

## 5. Work-Item Change Packages

### 5.1 Package Ownership

Every independently planned work item owns one change package:

- Feature.
- Requirement.
- Bug fix.
- Standalone development task.

Each package independently owns:

- Stable package ID.
- Scope and owner.
- Complexity classification.
- Selected workflow profile.
- Artifacts and artifact envelopes.
- Traceability graph.
- Findings and resolutions.
- Decisions and overrides.
- Approvals and waivers.
- Gate attempts and current gate status.
- External references.
- Audit history.

No repository-wide package collects unrelated artifacts.

### 5.2 Parent and Child Packages

A large feature may decompose into child development-task packages.

Package relationship types include:

- `decomposes-into`
- `child-of`
- `depends-on`
- `blocks`
- `supersedes`

Rules:

- Every child owns its own artifacts, profile, findings, gates, and audit trail.
- A child's complexity profile may differ from its parent's.
- Parent gates reference child gate IDs and evidence digests.
- Parent packages do not copy child artifacts or gate records.
- A parent aggregate gate cannot pass while a required child is incomplete, failed, stale, or has blocking open findings.

## 6. Artifact and Traceability Model

### 6.1 Artifact Types

The standard lifecycle artifact types are:

- Requirement specification.
- Architecture and design document.
- Test plan.
- Implementation record.
- Code review report.
- Validation and test execution report.
- Release record and release notes.

Profiles may reduce, combine, or extend required artifact types.

### 6.2 Artifact Envelope

Every logical artifact has a stable ID and a machine-readable envelope containing:

- Artifact ID, type, and revision.
- Schema version.
- Content path or external URL.
- Canonical content digest.
- Producer skill, skill version, runtime, model identity when applicable, and actor.
- Input and output artifact references.
- Typed traceability edges.
- Self-check result and associated findings.
- Creation and revision timestamps.

Narrative content remains human-readable, normally Markdown. Machine-readable envelopes and manifests use YAML. Parsed structured records are validated with JSON Schema 2020-12.

### 6.3 Typed Traceability Edges

Artifact-level relationship types include:

- `satisfies`
- `derives-from`
- `implements`
- `verifies`
- `reviews`
- `validates`
- `releases`
- `supersedes`

An edge binds exact artifact revisions, not only stable logical IDs. This makes the relationship auditable and enables stale-evidence detection.

### 6.4 Canonicalization and Digests

Structured records are canonicalized before hashing. Cosmetic YAML formatting changes do not alter evidence identity.

A content or relationship change that affects canonical data produces a new digest and may invalidate dependent gates.

## 7. Findings, Decisions, and Evidence

### 7.1 Findings

A structured finding includes:

- Finding ID.
- Source evaluator and gate.
- Rule ID.
- Severity.
- Affected package and artifact revisions.
- Evidence references.
- Recommended action.
- Status and disposition.
- Resolution evidence.
- Closure authority.

Findings are append-only. Resolution changes their lifecycle status through new records; it does not erase the original finding.

### 7.2 Gate Attempts

Every gate attempt is append-only and binds:

- Exact artifact revision and digest snapshot.
- Required child gate IDs and results.
- Workflow profile and policy versions.
- Deterministic evaluation results.
- AI semantic review results.
- Required approvals or waivers.
- Open findings.
- Issuing actor or workflow.
- Final result and timestamp.

Possible gate states are:

- `pass`: all active-profile requirements are satisfied.
- `fail`: one or more blocking rules or findings are unsatisfied.
- `error`: a required evaluator or tool did not produce a valid result.
- `stale`: the prior decision targets an older evidence snapshot.
- `waived`: a separate, authorized exception permits progression despite a named failed condition.

A waiver never rewrites a failed result. It is a separate, scoped, justified, approved, and expiring decision record.

### 7.3 Attestations

Lifecycle decision records use an attestation-inspired model that binds a statement to subjects, predicates, and authenticated evidence. They remain a project-specific lifecycle contract.

GitHub Artifact Attestations are reserved for:

- Released binaries.
- Released packages.
- Hashed release manifests.

They are not created for every individual narrative document.

## 8. Complexity Classification and Workflow Profiles

### 8.1 Initial Classifier

The pilot uses hybrid classification:

1. Deterministic rules calculate an initial complexity and risk tier.
2. An authorized human may confirm or override the tier.
3. Every override requires a recorded justification.

The classifier emits a versioned classification-decision record. A future fully automatic classifier must emit the same record shape, allowing downstream components to remain unchanged.

### 8.2 Profiles

The initial profiles are:

#### Routine

- Reduced artifact and gate set.
- Deterministic checks and AI semantic review.
- No phase-level human approval by default.
- Human approval is added only on escalation.

#### Standard

- Full lifecycle unless an explicit policy permits artifact consolidation.
- Deterministic checks and AI semantic review.
- Human approval only at profile-selected risk gates.

For example, a standard profile may require human approval for requirement baseline and release while automating design, test-planning, implementation, review, and validation gates.

#### High Risk

- Full lifecycle plus additional security, operational, data, or compliance evidence.
- Mandatory independent human approvals at explicitly configured gates.
- Stronger release and rollback controls.

### 8.3 Dynamic Escalation

The Lifecycle Loop may add a human-approval requirement to a specific gate attempt when:

- Classification confidence is below policy threshold.
- A human classification override occurs.
- The same blocking finding recurs without meaningful progress.
- A security, data, architecture, or operational risk trigger is detected.
- A waiver is requested.
- Evaluators produce unresolved semantic disagreement.

Escalation adds a recorded requirement to the gate attempt. It does not silently change the package profile.

## 9. Dedicated Phase Skills

Each phase skill is independently invokable and implements a shared phase-skill contract.

### 9.1 Shared Contract

Every phase skill declares:

- Supported phase and artifact types.
- Required and optional input context.
- Output artifact and envelope schemas.
- Self-check rules.
- Tool and capability requirements.
- Structured finding format.
- Exit and error behavior.

Every successful invocation emits:

- Created or revised artifact content.
- Artifact envelope.
- Structured self-check report.
- New or updated findings.
- Suggested traceability edges.

### 9.2 Phase Responsibilities

#### Requirements Skill

Produces scope, actors, requirements, acceptance criteria, constraints, assumptions, and risks. Self-checks completeness, ambiguity, testability, and internal consistency.

#### Design Skill

Produces architecture, components, interfaces, data flow, decisions, operational behavior, and trade-offs. Self-checks requirement coverage, feasibility, failure behavior, and design consistency.

#### Test-Planning Skill

Produces test strategy, cases, coverage map, environments, data, and execution requirements. Self-checks requirement coverage, feasibility, risk coverage, and expected evidence.

#### Implementation Skill

Produces code, tests, implementation notes, and local verification evidence. Self-checks conformance to design, test results, code quality, and trace links.

#### Review Skill

Produces a risk-focused code and artifact review report. Self-checks evidence grounding, finding severity, requirement and design coverage, and disposition completeness.

#### Validation Skill

Produces execution evidence, acceptance results, regression results, and unresolved defects. Self-checks evidence completeness, environment identity, and acceptance-criteria coverage.

#### Release Skill

Produces release notes, rollout plan, rollback plan, release manifest, and readiness evidence. Self-checks release scope, provenance, validation status, operational readiness, and rollback viability.

## 10. Universal Lifecycle Loop Skill

The Lifecycle Loop is one universal skill configured by package profile and current phase.

It:

- Classifies packages and selects workflow profiles.
- Determines required phases and gates.
- Invokes dedicated phase skills during an orchestrated run.
- Evaluates directly created phase artifacts.
- Checks schemas, required artifacts, trace completeness, cross-artifact consistency, findings, approvals, waivers, child gates, and freshness.
- Produces structured findings.
- Controls phase re-entry.
- Records final phase-gate attempts.

It does not author phase artifacts by default. Revisions are delegated to the owning phase skill.

### 10.1 Loop Safety

Every profile defines:

- Maximum automatic revision attempts.
- No-progress detection criteria.
- Conditions that require human escalation.
- Conditions that permit or prohibit waivers.

The loop stops and escalates rather than spinning indefinitely when:

- Attempt budget is exhausted.
- A blocking finding repeats without meaningful change.
- A required evaluator remains unavailable.
- Conflicting evidence cannot be resolved automatically.

## 11. CLI and Repository Layout

### 11.1 CLI Commands

The initial CLI surface is:

- `loop start`: create a package for a feature, requirement, bug, or task.
- `loop classify`: compute classification/profile and record an authorized override.
- `loop run <phase>`: invoke a dedicated phase skill through a runtime adapter.
- `loop check`: run local schema, graph, policy, freshness, and self-check validation.
- `loop gate <phase>`: run Lifecycle Loop final evaluation and record a gate attempt.
- `loop status`: show phase readiness, stale gates, blockers, and child-package status.
- `loop link`: create typed artifact, package, and external relationships.
- `loop audit <change-id>`: reconstruct a chronological evidence report.

### 11.2 Repository Layout

```text
.loop/
  config.yaml
  profiles/
  policies/
  schemas/
  packages/
    CHG-FEAT-0042/
      package.yaml
      artifacts/
      findings/
      gates/
      decisions/
skills/
  phases/
    requirements/
    design/
    test-planning/
    implementation/
    review/
    validation/
    release/
  lifecycle-loop/
adapters/
  codex/
  claude/
.github/
  workflows/
    loop-verify.yml
```

## 12. Freshness and Controlled Re-entry

Every gate decision binds exact:

- Artifact digests.
- Traceability edges.
- Required child gate IDs.
- Policy and profile versions.
- Approval and waiver records.

When a bound subject changes, the gate becomes `stale`. Stale means the previous result was valid for an older snapshot; it does not mean the prior evaluation was erroneous.

Controlled re-entry:

1. A downstream finding identifies affected upstream artifacts.
2. The owning upstream phase is reopened.
3. The phase skill produces new artifact revisions.
4. Dependent gates become stale.
5. Required downstream evaluations rerun against the new evidence graph.
6. Prior revisions and gate attempts remain in the audit trail.

## 13. GitHub Enforcement

### 13.1 Pull Request Verification

A reusable GitHub Actions workflow validates:

- Schema conformance.
- Package and artifact graph integrity.
- Required artifacts for the active profile.
- Trace completeness.
- Gate evidence freshness.
- Required child gate results.
- Required approvals and valid waivers.
- Repository test and quality results.

Repository rulesets require the verification status and pull-request review before merge.

CODEOWNERS protects sensitive workflow surfaces such as:

- Contract schemas.
- Policies and profiles.
- Verification workflows.
- Runtime adapter security boundaries.

### 13.2 Release Enforcement

Release jobs use protected GitHub environments when the active profile requires release approval or deployment controls.

The release workflow:

1. Revalidates the package and release gate.
2. Verifies released artifact digests.
3. Creates a hashed release manifest.
4. Generates GitHub Artifact Attestations for released artifacts and the release manifest.
5. Records release and deployment references in the package.

### 13.3 CI Security

GitHub workflows follow least-privilege permissions, isolate untrusted pull-request input, and pin third-party actions to immutable commit SHAs.

## 14. AI Review Trust Model

AI review is valuable for semantic quality but is not treated as perfectly reproducible or independently authoritative.

Every AI self-check and Lifecycle Loop review records:

- Evaluator skill and version.
- Runtime provider and model ID.
- Instruction, prompt, and policy digests.
- Subject artifact digests.
- Structured findings and confidence.
- Tool errors and unavailable evidence.

Rules:

- Free-form prose alone cannot satisfy a gate.
- AI findings must include rule IDs, severity, evidence references, and recommended actions.
- Model unavailability, malformed output, or tool failure produces `error`, never implicit `pass`.
- A gate passes only when every evidence source and approval mandated by the active profile is satisfied.
- Sensitive context follows repository retention and redaction policy. Digests preserve linkage where raw content cannot be retained.

## 15. Audit Trail

`loop audit <change-id>` walks the package and artifact graphs and emits a chronological report containing:

1. Package creation and ownership.
2. Complexity classification and overrides.
3. Selected profile and policy versions.
4. Artifact revisions and trace links.
5. Self-checks and Lifecycle Loop evaluations.
6. Findings, resolutions, waivers, and approvals.
7. Gate attempts and stale transitions.
8. Parent-child package results.
9. Code, pull-request, check-run, test, and external-system references.
10. Validation evidence.
11. Release manifest, provenance, and deployment references.

Every material claim points to a Git object, digest, GitHub workflow run, attestation, or stable external reference.

## 16. Testing Strategy

### 16.1 Contract Tests

Maintain valid and invalid fixtures for every:

- Schema.
- Artifact and package edge type.
- Profile.
- Finding.
- Decision.
- Approval.
- Waiver.
- Gate attempt.

### 16.2 Policy Tests

Use table-driven allow/deny cases for every deterministic rule and complexity profile. Explicitly verify that profiles neither demand unnecessary approval nor omit approval when risk or escalation rules require it.

### 16.3 Graph and Freshness Tests

Mutate artifacts, links, child packages, approvals, waivers, policies, and profiles to prove correct stale-gate propagation.

### 16.4 Skill Conformance Tests

Run every dedicated phase skill independently against the shared adapter contract. Verify output schema, self-check evidence, error behavior, and portability.

### 16.5 AI Regression Corpus

Maintain known-good and known-bad lifecycle artifacts. Measure:

- Finding precision.
- Missed blockers.
- Unsupported claims.
- Severity consistency.
- Result instability.

### 16.6 End-to-End Tests

Cover:

- Routine, standard, and high-risk packages.
- Parent-child aggregation.
- Controlled re-entry.
- Classification override.
- Dynamic escalation.
- Waiver.
- Merge enforcement.
- Release and attestation.
- Full audit reconstruction.

### 16.7 Security Tests

Cover prompt injection in artifacts, malicious external references, untrusted pull-request input, secret leakage, evaluator-tool permissions, and CI permission boundaries.

## 17. Implementation Decomposition

This ecosystem is intentionally broader than one implementation plan. Delivery is split into ordered subprojects, each with its own implementation plan and acceptance criteria:

1. **Contract kernel and deterministic validator:** schemas, canonicalization, digests, graph model, findings, decisions, gate attempts, profiles, and policy-test fixtures.
2. **Core CLI and audit reconstruction:** package creation, classification, linking, local checks, status, stale propagation, and chronological audit reports.
3. **Portable skill contract and runtime adapters:** shared phase-skill interface plus Codex and Claude Code adapters with conformance tests.
4. **Dedicated phase skills:** requirements, design, test-planning, implementation, review, validation, and release skills, implemented incrementally against the shared contract.
5. **Universal Lifecycle Loop:** profile selection, final evaluation, revision control, escalation, waivers, and final gate decisions.
6. **GitHub enforcement and release provenance:** reusable verification workflow, ruleset integration, protected release environment, release manifest, and artifact attestations.

The first implementation plan must cover only subproject 1. Later subprojects begin after their required predecessor contracts are stable.

## 18. Pilot Rollout

### Stage 1: Kernel and Observe

- Implement schemas, package graph, deterministic validators, basic CLI, and audit report.
- Run GitHub verification in report-only mode.
- Measure false findings and missing evidence.

### Stage 2: Standard Vertical Slice

- Implement all seven dedicated phase skills and the Lifecycle Loop.
- Run one real standard-profile feature end to end.
- Exercise at least one parent-child package relationship and one controlled re-entry.

### Stage 3: Enforce Merge

- Make selected freshness, traceability, test, and review gates required checks.
- Measure false blocks, override frequency, reviewer effort, and lead-time impact.

### Stage 4: Profiles and Release

- Tune routine and high-risk profiles.
- Enable profile-driven human approvals and escalation.
- Enforce protected release flow and artifact attestations.

Promotion between stages depends on:

- Gate precision.
- Reviewer effort.
- Lead-time impact.
- Escaped defects.
- Trace completeness.
- Override and waiver frequency.
- Successful audit reconstruction.

## 19. Success Criteria

The pilot succeeds when:

1. A new work item can be created, classified, executed, reviewed, validated, released, and audited using one `loop` CLI.
2. Every required artifact is versioned, reviewable, and linked to its owning package.
3. Every gate decision is bound to exact evidence and policy versions.
4. Changed evidence reliably invalidates dependent gates.
5. Dedicated phase skills work independently across Codex and Claude adapters.
6. The Lifecycle Loop can evaluate both orchestrated and independently produced phase outputs.
7. GitHub Actions independently blocks merge or release when required evidence is missing, failed, invalid, or stale.
8. Routine work can complete without unnecessary human phase approvals.
9. Standard and high-risk work receive the profile-required approvals and dynamic escalations.
10. An auditor can reconstruct the complete history of a parent feature and its child tasks from Git and linked evidence.

## 20. Reference Standards and Platform Capabilities

- [JSON Schema 2020-12](https://json-schema.org/specification)
- [in-toto Attestation Framework](https://github.com/in-toto/attestation/blob/main/spec/README.md)
- [SLSA Provenance](https://slsa.dev/spec/v1.2/provenance)
- [GitHub Artifact Attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- [GitHub Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [GitHub Reusable Workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)
- [GitHub Deployment Environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [GitHub Actions Secure Use](https://docs.github.com/en/actions/reference/security/secure-use)
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
