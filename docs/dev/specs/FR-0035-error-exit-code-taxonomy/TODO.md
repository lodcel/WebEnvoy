# FR-0035 TODO

Canonical Issue: #1133

## Spec Review

- [x] 建立 formal suite scaffold。
- [x] 冻结 error family、canonical code、FR-0034 category、retryable 与 exit code class。
- [x] 冻结 `ErrorV2` 加法字段 `family` 与 `exit_code`。
- [x] 写清 provider unavailable / runtime failure / closeout failure / schema evidence failure 边界。
- [x] 写清 local-only integration metadata，不提升为 Syvert normalized result。
- [ ] 通过本地 docs/spec/diff/purity 检查。
- [ ] 通过 guardian / review。
- [ ] GitHub checks 全绿。

## Review Blockers

- [ ] 无未解决 blocker。

## Implementation Handoff

- [ ] 后续实现建立 taxonomy mapping tests。
- [ ] 后续实现建立 primary error selection tests。
- [ ] 后续实现建立 v1 conversion 与 exit code compatibility tests。
- [ ] 后续实现建立 closeout failure 与 schema/evidence failure 边界 tests。

## Out of Scope For This PR

- [ ] 不实现 CLI/runtime 行为。
- [ ] 不修改 #1134/#1135/#1136。
- [ ] 不执行 live/browser/account validation。
