# Host Binding Inspector

`host-binding inspect` is the read-only inspection surface for the host control chain.

Stable entry:

```bash
python3 tools/loom_flow.py host-binding inspect --target <repo> --issue <n> [--pr <n>] [--project <n>] [--branch <name>]
```

The command returns `loom-host-binding-inspection/v1` and must not write GitHub, Project, branch, worktree, review, or closeout state.

## Output Contract

The top-level payload contains:

- `command: host-binding`
- `operation: inspect`
- `result: pass | block`
- `summary`
- `missing_inputs`
- `fallback_to`
- `repository`
- `inputs`
- `binding_chain`
- `dependency_graph`
- `provenance`
- `findings`

`binding_chain` uses `loom-host-binding-chain/v1` and exposes these nodes:

- `phase`
- `fr`
- `work_item`
- `branch`
- `target_branch`
- `implementation_pr`
- `pr`
- `merge_commit`
- `project_item`

Each node carries `freshness`, `value`, `errors`, and field-level `provenance`.

Stable freshness values:

- `fresh`
- `stale`
- `missing`
- `unreadable`
- `conflict`

Stable finding kinds:

- `missing_binding`
- `stale_binding`
- `conflicting_binding`
- `unreadable_host_signal`

## Dependency Graph

The inspector also returns `loom-host-dependency-graph/v1`.

Each dependency edge carries:

- `source_issue`
- `blocking_issue`
- `direction`
- `blocker_state`
- `source_of_truth`
- `host_mirror_status`
- `native`
- `provenance`

The dependency graph is not a replacement for branch, PR, worktree, or merge binding. It is consumed by Project drift, merge-ready, reconciliation, and closeout as host mirror evidence.

## Consumption

- `resume` and `pre-review` may expose inspector gaps as early status evidence.
- `merge-ready` must fail closed on unresolved binding conflicts when the current profile makes host binding blocking.
- `closeout` must not treat a merged PR, closed issue, or `/goal completion` as sufficient unless the binding chain can still be proven.
