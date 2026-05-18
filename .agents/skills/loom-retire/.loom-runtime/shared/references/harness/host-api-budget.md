# Host API Budget

Canonical contract: `docs/methodology/harness/host-api-budget.md`.

Installed summary:

- `github_control_plane.api_snapshot.budget` uses `loom-execution-budget/v1`.
- Required budget fields: `schema_version` / `status` / `enforcement` / `summary` / `dimensions` / `provenance` / `adapter_evidence_locator`.
- `dimensions` must use the fixed IDs `turns` / `tokens` / `requests` / `retries` / `time_window`; provider-specific field names must not be carried into Loom core schema.
- Missing budget output is allowed as `status: not_applicable` or `status: unavailable` and must remain `enforcement: advisory`.
- Non-merge reads use `cached_non_merge`; merge reads use `uncached_live_gate`.
- REST is preferred; GraphQL requires explicit scope, cost, and fallback.
- Search endpoint and polling are not hot-path mechanisms.
- Remote read failures must surface as `unverified`, `stale`, or `host_unavailable`.
