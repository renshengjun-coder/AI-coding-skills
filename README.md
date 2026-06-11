# AI Coding Skills

Runtime-neutral contract kernel and deterministic validator for the **Loop Skills** ecosystem — an AI-native software development workflow where every work item produces reviewable, versioned, traceable, and auditable evidence.

This repository is the pilot implementation for a single-repo GitHub workflow. The approved ecosystem design covers phase skills, a universal Lifecycle Loop, a `loop` CLI, and GitHub Actions enforcement. **Implemented through subproject 6:** contract kernel, loop CLI, phase skills, Lifecycle Loop, GitHub verification workflows, protected release flow, release manifests, and artifact attestations.

## What it does

The contract kernel defines Loop change-package evidence and validates it deterministically:

- **Contract vocabulary** — typed records for change packages, artifact envelopes, findings, approvals, waivers, gate attempts, workflow profiles, and gate policies (`apiVersion: loop.dev/v1`).
- **JSON Schema 2020-12** — generated, reviewable schemas under `.loop/schemas/v1/`.
- **Document loading** — parse YAML or JSON and validate against schema.
- **Canonical digests** — formatting-independent SHA-256 identity for every document revision.
- **Evidence graph** — index exact revisions, resolve references, detect digest mismatches, missing packages, and decomposition cycles.
- **Gate evaluation** — profile-driven deterministic rules (required artifacts, trace relations, blocking findings, approvals, child gates).
- **Freshness** — detect when gate-bound evidence is missing or has changed.

## Requirements

- Node.js **22+**
- npm

## Quick start

```bash
npm install
npm run verify
```

`verify` runs schema generation, TypeScript check, tests, build, and a packed-package smoke test.

## Loop CLI (subproject 2)

Create and operate change packages on disk under `.loop/packages/`:

```bash
# Create a package
npm run loop -- start --type feature --title "My feature" --owner team-a --profile standard

# Classify / override profile tier
npm run loop -- classify CHG-FEAT-0001 --tier routine --override-actor lead@example.com --override-reason "Pilot slice"

# Validate schemas and evidence graph
npm run loop -- check CHG-FEAT-0001

# Link parent → child package
npm run loop -- link package --from CHG-FEAT-0001 --to CHG-TASK-0001 --relation decomposes-into

# Evaluate and record a phase gate
npm run loop -- gate CHG-FEAT-0001 requirements

# Show phase readiness and stale gates
npm run loop -- status CHG-FEAT-0001

# Chronological audit report
npm run loop -- audit CHG-FEAT-0001
```

After `npm run build`, the `loop` binary is also available via `npx loop` or `./node_modules/.bin/loop`.

### Phase skills and runtime adapters (subproject 3)

Portable phase skill manifests live in `skills/phases/<phase>/SKILL.yaml`. Runtime adapters:

- `codex` — `src/adapters/codex/adapter.ts`
- `claude` — `src/adapters/claude/adapter.ts`

```bash
# Invoke a phase skill (default: dedicated local producers; use --stub for adapter smoke tests)
npm run loop -- run CHG-FEAT-0001 requirements --runtime codex --actor you@example.com
npm run loop -- run CHG-FEAT-0001 design --runtime claude --actor you@example.com
```

Conformance tests validate both adapters against the shared skill contract (`tests/skills/conformance.test.ts`).

### Dedicated phase skills (subproject 4)

Each lifecycle phase has a deterministic local producer in `src/skills/phases/`:

| Phase | Producer | Artifact file |
|-------|----------|-----------------|
| `requirements` | `produceRequirements` | `requirements.md` |
| `design` | `produceDesign` | `design.md` |
| `test-planning` | `produceTestPlanning` | `test-plan.md` |
| `implementation` | `produceImplementation` | `implementation.md` |
| `review` | `produceReview` | `review-report.md` |
| `validation` | `produceValidation` | `validation-report.md` |
| `release` | `produceRelease` | `release-record.md` |

`loop run` uses `PhaseSkillExecutor` by default. It runs phase-specific self-check rules, emits contract-valid envelopes, and records upstream trace edges (for example design `derives-from` requirements). Use `--stub` to exercise adapter plumbing without producing real phase artifacts.

Pipeline tests run all seven phases in order (`tests/skills/phases/pipeline.test.ts`).

### Universal Lifecycle Loop (subproject 5)

`loop gate` runs the Lifecycle Loop final evaluation (`src/lifecycle-loop/`): phase self-check verification, profile-driven policy rules, waiver application, dynamic escalation, controlled re-entry recommendations, and gate attempt recording (`issuedBy: lifecycle-loop`).

```bash
# Record human approval for a profile-required gate
npm run loop -- approve CHG-FEAT-0001 requirements --actor reviewer@example.com --reason "Baseline approved"

# Record a scoped waiver for a failed condition (does not rewrite the failed evaluation)
npm run loop -- waive CHG-FEAT-0001 requirements --condition required-approvals --approver lead@example.com --reason "Pilot exception" --expires 2026-12-31T00:00:00.000Z

# Run phase skills and gates through a profile-defined slice (standard profile example)
npm run loop -- approve CHG-FEAT-0001 requirements --actor reviewer@example.com --reason "Ready for orchestration"
npm run loop -- orchestrate CHG-FEAT-0001 --runtime codex --through design
```

Manifest: `skills/lifecycle-loop/SKILL.yaml`. Tests: `tests/lifecycle-loop/`.

### GitHub enforcement and release provenance (subproject 6)

Reusable workflows under `.github/workflows/`:

- `loop-pr.yml` — PR verification (schemas, graph, gates, freshness, repo tests)
- `loop-release.yml` — protected release job (manifest + GitHub Artifact Attestations)

```bash
npm run loop -- verify-changed --from-git-diff --mode enforce
npm run loop -- verify-changed --package-id CHG-FEAT-0001 --mode report-only
npm run loop -- release prepare CHG-FEAT-0001 --commit $(git rev-parse HEAD)
```

See [docs/github/enforcement.md](docs/github/enforcement.md) for ruleset and protected environment setup.

## Usage

```ts
import { readFile } from "node:fs/promises";
import {
  loadDocument,
  validateDocument,
  digestDocument,
  validateGraphIntegrity,
  evaluateGate,
  evaluateFreshness,
} from "contract-kernel";
```

Load and validate a committed profile:

```ts
const profile = loadDocument(
  await readFile(".loop/profiles/standard.yaml", "utf8"),
  ".loop/profiles/standard.yaml",
);
expect(validateDocument(profile).valid).toBe(true);
```

Evaluate a phase gate (see `tests/fixtures/builders.ts` and `tests/integration/kernel.test.ts` for full examples):

```ts
const result = evaluateGate({
  package: changePackage,
  phase: "requirements",
  evaluationTime: "2026-06-11T12:00:00.000Z",
  profile,
  policies: [policy],
  documents: allEvidence,
});

if (result.result === "pass") {
  const gate = gateAttempt({
    spec: {
      boundEvidence: allEvidence.map((doc) => ({
        kind: doc.kind,
        id: doc.metadata.id,
        revision: doc.metadata.revision,
        digest: digestDocument(doc),
      })),
      evaluations: result.evaluations,
      result: result.result,
    },
  });
  evaluateFreshness(gate, allEvidence); // "fresh" | "stale"
}
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run Vitest test suite |
| `npm run typecheck` | TypeScript without emit |
| `npm run build` | Compile to `dist/` |
| `npm run schemas` | Regenerate `.loop/schemas/v1/*.schema.json` |
| `npm run verify` | Full CI-equivalent check |

## Repository layout

```
.loop/
  policies/v1/base.yaml       # Built-in deterministic gate rules
  profiles/                   # routine, standard, high-risk workflow profiles
  schemas/v1/                 # Generated JSON Schema 2020-12 contracts
src/kernel/                   # Contract kernel source
  canonical/                  # Canonical JSON + SHA-256 digests
  contracts/                  # Types, vocabulary, schema definitions
  freshness/                  # Gate evidence freshness
  graph/                      # Evidence graph integrity
  io/                         # YAML/JSON loading
  policy/                     # Profile-driven gate evaluation
  validation/                 # Ajv schema registry
tests/                        # Unit, policy, freshness, integration tests
docs/
  kernel/contract-kernel.md   # Public API and invariants
  superpowers/                # Approved design and implementation plans
```

## Built-in profiles

| Profile | Tier | Human approval |
|---------|------|----------------|
| `routine.yaml` | routine | None by default |
| `standard.yaml` | standard | Requirements and release |
| `high-risk.yaml` | high-risk | Independent approvals at risk-sensitive gates |

All profiles bind to the `base` gate policy in `.loop/policies/v1/base.yaml`.

## Documentation

- [Contract kernel API and invariants](docs/kernel/contract-kernel.md)
- [Ecosystem design (approved)](docs/superpowers/specs/2026-06-11-ai-native-loop-skills-ecosystem-design.md)
- [Implementation plan](docs/superpowers/plans/2026-06-11-contract-kernel-deterministic-validator.md)

## Deliberate limits

This package does **not** yet include:

- Live Codex/Claude model invocation (local deterministic producers stand in for pilot runs)
- Rich audit report rendering with external check-run and attestation links
- Automated ruleset provisioning (documented manually in `docs/github/enforcement.md`)

Those items can be added without changing the contract kernel public API.

## License

ISC
