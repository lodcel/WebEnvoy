# FR-0046 TODO

## Review 阶段

- [ ] 确认本 suite 只定义 `official-chrome.persistent` Native Messaging health mapping。
- [ ] 确认所有 health output 消费 `FR-0038.provider_doctor_report`，未定义新 health result schema。
- [ ] 确认 host identity、manifest、allowed origins、registration、socket availability 与 bridge handshake readiness 已覆盖 #1141 scope。
- [ ] 确认 stateful health matrix 覆盖 `ready|recoverable|disconnected|blocked|unknown` 并映射到 FR-0038 / FR-0040-compatible statuses。
- [ ] 确认 recovery path semantics 覆盖 same-run retry、idempotent start/stop、current-run orphan cleanup、stale ready signal handling 与 concurrent contention。
- [ ] 确认 minimum validation matrix 覆盖 missing/unknown/fail、stale/disconnected、no-ack、retry/recovery、stub/fake evidence rejection、redaction 与 capability/admission blocking。
- [ ] 确认 evidence refs 消费 FR-0040，redaction policy 消费 FR-0041。
- [ ] 确认 persistent descriptor refs 消费 FR-0043。
- [ ] 确认未定义 #1140 persistent extension identity health、#1142 service worker freshness health、#1139 capability matrix、#1143 launch evidence 或 #1144 fixtures。
- [ ] 确认 PR metadata 使用 formal spec review lane、provider health / diagnostics integration gate、`live_evidence_record: N/A`，并可被 parser 消费。
- [ ] 确认 PR 使用 `Refs #1141`，只冻结 Native Messaging health formal spec carrier，不关闭 #1141 或 runtime/live behavior。

## 实现前待办

- [ ] 后续 implementation issue 消费本 FR，生成 FR-0038 `native_messaging` checks。
- [ ] 后续 tests 覆盖 missing/unknown/fail required checks、stub/fake host evidence、redaction invalid 与 capability blocking。
- [ ] #1144 official Chrome fixtures 消费本 FR 的 diagnostics codes 和 fail-closed cases。
- [ ] 若后续 implementation 执行真实 Chrome、extension、Native Messaging、profile 或 account-touching action，必须先补 readiness/admission 证据并遵守 live/runtime gate。

## 明确不在本 PR 完成

- [ ] 不实现 runtime、extension、native host、socket/bridge、CLI、Playwright、fixtures 或 tests。
- [ ] 不运行 browser/live/account validation。
- [ ] 不运行 guardian、formal review 或 controlled merge；gate owner is scheduler。
