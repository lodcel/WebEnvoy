# FR-0071 TODO

## Review 阶段

- [ ] 确认 `FR-0071` 只定义 WebEnvoy-owned Syvert mapping hint manifest。
- [ ] 确认 manifest 不包含 Syvert normalized result、Syvert resource taxonomy、Syvert error taxonomy、Syvert workflow 或 Syvert project state。
- [ ] 确认 hint classes 只提供 downstream mapping context、source refs、gaps、consumer actions and non-proof signals。
- [ ] 确认 every hint item has source binding, freshness, scope and redaction state。
- [ ] 确认 `mapping_gaps` 使用 downstream owner，并且 `webenvoy_default_allowed=false`。
- [ ] 确认 forbidden fields 覆盖 `normalized`、Syvert taxonomy、JSON-RPC wrapper、provider adapter、live_write_commit 和 sensitive raw payload。
- [ ] 确认 integration classification remains local-only: `integration_applicable=no`、`integration_ref=none`、`merge_gate=local_only`。
- [ ] 确认 this PR does not implement #1200/#1201/#1202/#1203/#1204/#1205, provider runtime code, #238 closeout, browser/account/live/write actions or Syvert wrapper behavior。
- [ ] 确认 PR metadata uses `Refs #1199` and does not auto-close #1199/#1120。

## 实现前待办

- [ ] #1200/#1201 decide whether WebEnvoy envelope/error hint implementation consumes this manifest.
- [ ] #1203/#1204 define Syvert-owned wrapper / normalization consumption without changing WebEnvoy core output ownership.
- [ ] #1205, if still needed, requests separate integration metadata decision instead of reusing #1199 local-only status.
- [ ] Future parser rejects unknown manifest version, unknown hint class and forbidden fields.
- [ ] Future parser rejects stale, scope-mismatched or redaction-invalid source bindings.
- [ ] Future Syvert consumer tests verify hints do not produce normalized result without Syvert-owned mapping contract.

## Current PR scope

- [ ] Formal spec suite only.
- [ ] Sync-map mapping to #1199 only.
- [ ] No runtime implementation.
- [ ] No CLI / JSON-RPC wrapper implementation.
- [ ] No provider adapter implementation.
- [ ] No evidence passthrough or integration metadata implementation.
- [ ] No browser/profile/account/live/read/write actions.
- [ ] No Syvert normalized result.
- [ ] Scheduler owns guardian / formal review / merge gate / issue closeout.
