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
