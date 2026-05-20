# Phase 7 Cleanup Inventory

This inventory is a Loom companion boundary document for issue #708. It records
which WebEnvoy guardian/status/checklist mechanisms are retained, demoted, or
rollback-only after Loom owns review/spec review/merge-ready/handoff authority.
It is not a backlog, sprint board, issue state, or project status source.

## Authority After Phase 7

- Review authority: Loom review record.
- Spec review authority: Loom spec review record.
- Merge-ready authority: Loom merge-ready result.
- Recovery authority: Loom handoff/resume recovery record.
- Progress/backlog authority: GitHub Issues and Projects.
- Repo rule authority: WebEnvoy `AGENTS.md`, `docs/dev/AGENTS.md`,
  `code_review.md`, `spec_review.md`, FR suites, PR metadata rules, live
  evidence gate, integration_check, GitHub Actions, and controlled merge safety
  wrappers.

## Inventory

| Surface | Phase 7 action | Loom replacement path | Rollback path |
| --- | --- | --- | --- |
| WebEnvoy guardian Markdown review body | Demote to compatibility renderer | Loom review/spec review record embedded in guardian metadata | Re-render from the same Loom record or rerun Loom review |
| `scripts/pr-review-result.schema.json` | Demote to compatibility renderer schema | `.agents/skills/shared/assets/review/loom-review-result-schema.json` and Loom review records | `PR_GUARDIAN_LEGACY_SCHEMA_AUTHORITY=1` for rollback-only ingestion |
| Guardian proof store | Demote to local proof cache for human same-head reuse | Loom record hash + GitHub review API state | Ignore cache and rerun Loom review |
| Guardian `review-status` | Demote to reusable compatibility state probe | Loom review/spec review record metadata | Fresh Loom review when metadata/cache is missing or stale |
| Guardian `merge-if-safe` | Keep as host adapter | Loom merge-ready result | Stop before host merge; rerun merge-ready after records/checks recover |
| `scripts/merge-pr.sh` | Keep as controlled merge wrapper | Loom merge-ready result consumed by guardian adapter | Use the same wrapper after fresh Loom allow |
| `.loom/status/current.md` | Keep as derived recovery status only | Loom fact chain and `.loom/progress/<issue>.md` | Regenerate from recovery/work-item records |
| FR `TODO.md` checklists | Keep as local implementation aids | GitHub Issues/Projects for progress truth; Loom recovery for current stop | Treat TODO as non-authoritative and recover from GitHub + Loom records |
| Legacy guardian verdict wording | Demote to compatibility fields | Loom review/spec records and Loom merge-ready | Rollback-only legacy env flag, never parallel authority |

## Deletion Criteria

No Phase 7 target is deleted unless the Loom replacement path above is present
and the rollback path is explicit. Existing WebEnvoy repo-specific rules,
metadata gates, live evidence gates, integration_check rules, CI workflows, FR
suites, and controlled merge host protections are kept.
