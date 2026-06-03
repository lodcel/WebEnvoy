# Native Dependency Contract

Loom treats GitHub native issue dependency as a host control mirror. It can prove blocker state and drift, but it does not become repo-authored truth.

## Vocabulary

Stable dependency drift kinds:

- `missing_native_edge`
- `unexpected_native_edge`
- `stale_native_edge`
- `open_blocker_executable_conflict`
- `native_dependency_unreadable`

Stable native read states:

- `present`
- `missing`
- `unsupported`
- `permission_denied`
- `unreadable`

## Read Semantics

The native dependency reader compares:

- repo-authored dependency statements
- issue body dependency statements
- GitHub native `blocked_by` / `blocking` edges
- Project status when a Project read is requested

Unsupported or permission-denied native dependency reads are not interpreted as “no blockers.” They remain explicit host mirror gaps and must be visible to status, Project drift, merge-ready, and closeout.

`dependency_graph.findings[*].kind` uses the same vocabulary. `project_drift.findings[*].drift_kind` may project those findings into Project drift when the same evidence affects Project / merge-ready consumption.

## Gate Consumption

- `resume` and `pre-review` expose dependency drift as advisory status evidence by default.
- `merge-ready` blocks when an open native blocker exists under a blocking governance profile.
- `closeout` blocks when Work Item, FR, or Phase closeout still has an open blocker or stale dependency mirror.
- Safe sync plans may propose native edge writes only when proof comes from repo-authored or issue-authored dependency truth.

Project ordering can support diagnosis, but it is never sufficient proof for writing native dependency edges.
