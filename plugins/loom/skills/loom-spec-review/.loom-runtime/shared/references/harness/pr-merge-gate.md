# PR Merge Gate

Canonical contract: `plugins/loom/skills/shared/references/harness/pr-merge-gate.md`.

Stable entry:

```bash
python3 tools/loom_flow.py pr-gate check --target <repo> --pr <number>
```

The PR merge gate bridges Loom's authored semantic review truth to host required checks. It passes only when the current PR head has a fresh authored review record referenced by `work_item.review_entry` and that record declares `decision: allow`.

It must also consume repo-specific PR metadata preflight when `metadata_contract.fields[*].machine_carrier` declares a blocking PR body machine carrier.

It must fail closed for missing or stale review records, `block` or `fallback` decisions, validation-summary drift, checkout/PR head mismatch, Work Item binding conflicts, raw-evidence-only bypass attempts, and blocking PR metadata parser diagnostics.

Raw review output, shadow evidence, runtime evidence, CI logs, GitHub review comments, and PR summaries are evidence only. They never satisfy semantic approval.

PR metadata machine blocks are separate from PR summaries: malformed HTML comment JSON, missing required repo-specific fields, or required-but-absent machine blocks must return parser diagnostics instead of generic missing-field collapse.

Host enforcement is proven only by live branch protection or active ruleset readback requiring the stable check name `loom-pr-merge-gate`; workflow presence alone is not enough.

The `loom-pr-merge-gate/v1` output may be retained as a pr-gate result locator. A consumer may reuse it only when the current PR still has the same Work Item, PR number, head SHA, authored review approval, reviewed validation summary, and passing merge checkpoint. Missing, unreadable, stale, or non-pass retained results must block or fall back to `pr-gate` / `review`.

`controlled-merge` may consume a fresh retained pr-gate result, but it must still re-read current PR head, required checks, branch protection or active ruleset, mergeability, and merge method as drift-only readback. Retained results never replace host enforcement readback. GitHub `BLOCKED` mergeability is delegated host policy evidence after Loom approval and checks pass; GitHub review comments, including author `COMMENTED`, remain evidence-only and never satisfy approval truth.

The stock GitHub workflow checks out the verified PR head. That preserves head binding, but repos with untrusted external PRs must make an explicit host-trust decision or replace the workflow body with pinned tooling before requiring the check.
