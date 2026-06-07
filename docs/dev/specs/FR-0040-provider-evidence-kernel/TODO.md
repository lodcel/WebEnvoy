# FR-0040 TODO

## 当前 PR

- [x] 冻结 `provider_evidence_record.v1` formal spec。
- [x] 冻结 data model、contract shape、risk 与 research notes。
- [x] 将 `docs/dev/specs/FR-0040-provider-evidence-kernel/spec.md` 映射到 #1128。
- [x] 完成本地 docs/spec/map/purity/diff validation。
- [ ] 打开 PR 并等待 hosted checks。
- [ ] 按调度指令决定是否进入 guardian / semantic review。

## 后续实现事项

- [ ] 建立 provider evidence record parser / validator。
- [ ] 建立 selected provider / launch envelope / evidence refs mismatch fixtures。
- [ ] 建立 redaction state、freshness 与 required evidence fail-closed tests。
- [ ] 将 runtime evidence collector 或 command output consumption 拆到独立 implementation issue。

## 明确不在本 PR 完成

- [ ] 不实现 runtime evidence kernel。
- [ ] 不实现 CLI behavior。
- [ ] 不实现 browser launch、extension、Native Messaging、Playwright 或 live runtime behavior。
- [ ] 不修改 #1127 / PR #1224 Provider Health Doctor。
- [ ] 不修改 #1135/#1136、Syvert normalized result、CloakBrowser-as-core、browser patching、default live_write commit 或 #835 recovery。
