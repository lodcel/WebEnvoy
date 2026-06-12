# FR-0070 Risks

## 风险 1：把 provider stealth presence 误当成 risk accepted

触发条件：

- Consumer 看到 provider 声明 stealth、doctor pass、fingerprint seed ref 或 private patch ref，就直接输出 risk accepted 或 read/write gate allow。

影响：

- WebEnvoy 会绕过 #1183/#1188 的 risk evidence 与 gate consumer，导致高风险 runtime 行为缺少 WebEnvoy-owned evidence。

缓解：

- 本 FR 冻结 non-proof signals。
- `RiskEvidenceGateResultV1` 只能输出 `allow_input_to_1188`，不输出 read/write allow。
- blocking reasons 包含 `provider_stealth_non_proof` 与 `risk_hint_consumer_required`。

剩余风险：

- 后续实现仍可能误用 provider doctor pass；需要在 #1188 parser/gate tests 中覆盖。

## 风险 2：provider private patch 或 fingerprint secret 泄露

触发条件：

- PR metadata、stdout summary、fixture、evidence artifact 或 spec sample 内联 raw seed、private patch payload、hook body、driver internal state、browser binary diff 或可逆 seed preview。

影响：

- 泄露 provider proprietary details、账号/环境隐私或可被滥用的反检测绕过信息。

缓解：

- 本 FR 只允许 provider-owned refs、limitations、redacted refs and blockers。
- `provider_private_boundary_violation`、`provider_private_patch_disclosed` and `risk_evidence_redaction_invalid` are hard blockers。
- Contract examples use synthetic refs only。

剩余风险：

- 实现或手工证据仍可能附带过宽日志；后续 evidence parser and PR metadata guard 需要专项检测。

## 风险 3：#1183 扩 scope 到 #1188 implementation

触发条件：

- 当前 formal spec PR 顺手定义 read/write gate enforcement matrix、command output behavior、runtime block/allow implementation 或 route evaluator behavior。

影响：

- #1188 的 consumer gate owner 被提前实现，spec review scope 失真，scheduler gate 无法准确消费。

缓解：

- 本 FR 明确 #1188 owns consumer behavior。
- Output decision 命名为 `allow_input_to_1188`，避免被解释为 allow。
- TODO 与 plan 将 #1188 implementation 留作后续。

剩余风险：

- #1188 后续 PR 需要重新核对本 FR，防止绕过或重复定义。

## 风险 4：account safety sibling input 被误写成 replacement

触发条件：

- Consumer 把 FR-0066 / #1176 account safety clear 或 #1187 account safety signal integration presence 当作完整 risk accepted 或 read/write allow。

影响：

- Provider stealth、runtime target binding、live evidence、closeout/audit 或 #1188 gate 可能被绕过。

缓解：

- 本 FR 明确 account safety is necessary sibling input for write_prepare / live_write_commit, not replacement。
- GWT 场景覆盖 account safety clear 不能替代其他 lanes。

剩余风险：

- #1188 implementation tests 必须覆盖 account safety clear plus missing provider/risk evidence 的 deny path。

## 风险 5：freshness / scope drift 被忽略

触发条件：

- 使用旧 head、旧 run、历史 artifact、same-head historical artifact、post-merge evidence、stub/fake host 或 control-plane-only signal 作为 current risk accepted。

影响：

- Closeout 和 gate decision 可能基于错误上下文，放大账号、安全、风控和数据风险。

缓解：

- 本 FR 冻结 binding fields 与 freshness semantics。
- Fail-closed blockers 覆盖 head/run/profile/page/provider mismatch 和 historical/stale evidence。
- Closeout/audit boundary 要求 latest head/current main fresh evidence。

剩余风险：

- 后续 tooling 需要机器化检查 PR body 与 artifact identity。

## 风险 6：scope drift 到实现或 live evidence

触发条件：

- 当前 PR 顺手修改 provider adapter、runtime selection、risk hint consumer gate、read/write gate、account safety、live evidence、XHS driver、JSON-RPC 或 Syvert normalized result。

影响：

- Formal spec review PR 混入实现，破坏高风险事项分离和 scheduler gate ownership。

缓解：

- Allowed write paths 限定为 FR-0070 suite 与 sync-map mapping。
- PR purity、docs/spec guard、diff check 和 closing semantics scan 必须通过。
- Gate owner remains scheduler；worker 不运行 guardian/formal review/controlled merge/issue closeout。

剩余风险：

- Hosted checks 或 PR metadata 仍可能暴露 scope drift；进入 scheduler gate 前必须 read back PR diff/body。

## 风险 7：manual disposition 被误用为独立放行

触发条件：

- Consumer 看到 `manual_risk_disposition_ref`、operator unlock、人工说明或 governance comment，就直接清除 provider/account/runtime/live/closeout/#1188 blocker。

影响：

- 高风险 evidence lane 被人工上下文绕过，#1188 parser/gate 可能无法安全区分 manual context、blocker explanation 与 accepted-supporting input。

缓解：

- 本 FR 定义 `ManualRiskDispositionRefV1`，要求 producer owner、consumer refs、allowed effect、scope/freshness/redaction/artifact binding。
- `manual_risk_disposition_ref` 只能作为 exact-scope context、blocker explanation 或 accepted-supporting input；manual-only 或 stale/out-of-scope/unknown-owner/redaction-invalid input 必须 fail-closed。
- blocking reasons 包含 `manual_disposition_required` 与 `manual_disposition_not_accepted`，并允许 defer to `manual_disposition_owner`。

剩余风险：

- #1188 后续实现必须测试 manual-only proof、manual plus missing provider/account/runtime/live lane、manual stale/scope drift 和 manual accepted-supporting valid path。
