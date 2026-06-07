# FR-0045 TODO

## Review 阶段

- [ ] 确认本 suite 只定义 persistent extension identity/source binding health check。
- [ ] 确认 check carrier 是 `FR-0038.provider_doctor_report.checks[*].category=extension_load`，没有新增 health result schema。
- [ ] 确认 expected/observed extension identity、source/profile binding 与 fail-closed 条件覆盖 #1140 scope。
- [ ] 确认 evidence refs 消费 FR-0040，redaction 消费 FR-0041，没有重定义 evidence/redaction shape。
- [ ] 确认本 suite 没有 native messaging health、service worker freshness、capability matrix、launch evidence、fixtures、runtime implementation 或 live evidence。
- [ ] 确认 PR metadata 使用 formal spec review lane、`Fixes #1140`、integration local-only 与 `live_evidence_record: N/A`。

## 实现前待办

- [ ] 后续 doctor implementation 以 FR-0038 shape 输出 persistent extension identity health check。
- [ ] #1141 定义 Native Messaging health，并保持独立 check ownership。
- [ ] #1142 定义 service worker freshness，并保持独立 check ownership。
- [ ] #1144 fixtures 消费 #1139/#1140/#1141/#1142/#1143 的已冻结输入。
- [ ] 后续 admission / selection consumer 不得把 descriptor refs 或 doctor pass 误判为 runtime/live evidence attested。
