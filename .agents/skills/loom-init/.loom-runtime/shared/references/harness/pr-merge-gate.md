# PR Merge Gate

Canonical contract: `docs/methodology/harness/pr-merge-gate.md`.

Stable entry:

```bash
python3 tools/loom_flow.py pr-gate check --target <repo> --pr <number>
```

The PR merge gate bridges Loom's authored semantic review truth to host required checks. It passes only when the current PR head has a fresh authored review record referenced by `work_item.review_entry` and that record declares `decision: allow`.

It must fail closed for missing or stale review records, `block` or `fallback` decisions, validation-summary drift, checkout/PR head mismatch, Work Item binding conflicts, and raw-evidence-only bypass attempts.

Raw review output, shadow evidence, runtime evidence, CI logs, GitHub review comments, and PR summaries are evidence only. They never satisfy semantic approval.

Host enforcement is proven only by live branch protection or active ruleset readback requiring the stable check name `loom-pr-merge-gate`; workflow presence alone is not enough.

The stock GitHub workflow checks out the verified PR head. That preserves head binding, but repos with untrusted external PRs must make an explicit host-trust decision or replace the workflow body with pinned tooling before requiring the check.
