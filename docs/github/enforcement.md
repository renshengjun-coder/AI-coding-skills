# GitHub enforcement (subproject 6)

This repository ships reusable workflows for Loop evidence verification and protected release provenance.

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `loop-verify.yml` | Reusable | Schema/graph/gate/freshness checks for changed packages |
| `loop-pr.yml` | Pull request | Calls `loop-verify` with `enforce` mode |
| `loop-release.yml` | Manual (`workflow_dispatch`) | Release gate check, manifest, attestations |

## Pull request verification

`loop-pr.yml` diffs against the PR base branch and runs:

```bash
npm run loop -- verify-changed --from-git-diff --git-base <base-sha> --mode enforce
```

Verification includes:

- JSON Schema conformance for all package documents
- Evidence graph integrity (including artifact trace digests)
- Required phase gates: `pass` or `waived`, fresh, no open blocking findings
- Deterministic policy and Lifecycle Loop re-evaluation
- Repository `npm run typecheck` and `npm test` in the reusable workflow

### Report-only mode (pilot Stage 1)

Call the reusable workflow with `mode: report-only` to log failures without blocking merge.

## Branch rulesets

Configure in GitHub: **Settings → Rules → Rulesets**.

Recommended required status check:

- Job name: `Loop package verification` (from `loop-pr.yml`)

Also require pull request review and CODEOWNERS approval for protected paths (see `.github/CODEOWNERS`).

Example ruleset targets:

- `main` branch
- Require status check `Loop package verification`
- Require CODEOWNERS review when `.loop/`, `.github/workflows/`, or `src/kernel/` change

GitHub rulesets are repository settings; this repo documents the intended policy rather than storing ruleset JSON in Git.

## Protected release environment

1. Create environment `release` under **Settings → Environments**.
2. Enable **Required reviewers** for production releases.
3. Run **Actions → Loop Release** with the change package ID.

The release job:

1. Verifies all required gates for the package
2. Writes `.loop/releases/<package-id>/release-manifest.json` (hashed subjects + evidence snapshot)
3. Records a provenance finding on the package
4. Generates [GitHub Artifact Attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations) for the manifest, `dist/`, and `package.json`

## Local commands

```bash
# Verify packages touched in the last commit
npm run loop -- verify-changed --from-git-diff --mode enforce

# Verify a specific package
npm run loop -- verify-changed --package-id CHG-FEAT-0001 --mode enforce

# Prepare release manifest (after release gate passes)
npm run loop -- release prepare CHG-FEAT-0001 --commit $(git rev-parse HEAD)
```

## CI security

Workflows use least-privilege `permissions`, pin third-party actions to immutable commit SHAs, and avoid executing untrusted PR code in privileged contexts beyond read-only verification.
