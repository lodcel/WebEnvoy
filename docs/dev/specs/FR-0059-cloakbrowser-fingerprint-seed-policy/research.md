# FR-0059 research

## 输入证据

- #1156 issue body：要求 caller-supplied seed 才能支撑 reproducibility，默认 redaction，允许记录 hash where allowed，并禁止 raw seed / private patch / fingerprint internals 暴露。
- `FR-0041 Evidence Redaction Policy`：已冻结 fingerprint seed 默认属于 `secret`，public/private locator 与 fail-closed redaction 规则已存在。
- `FR-0040 Provider Evidence Kernel`：已为 `fingerprint_policy_ref`、`sensitivity` 与 `redaction_state` 预留最小证据 hook，但没有定义 CloakBrowser-specific seed reproducibility contract。
- `FR-0049 cloakbrowser.direct Descriptor`：已声明 `fingerprint_seed_boundary` 只允许 provider-managed redacted boundary，不得暴露 seed values 或 private patch schema。
- `vision.md` / `docs/dev/AGENTS.md`：正式 FR 必须保持 fail-closed、安全敏感边界清楚，不把 runtime behavior、private schema 或 live evidence 混入 formal policy PR。

## 已知边界核对

### 与 FR-0041 的关系

- FR-0041 解决“默认怎么脱敏”。
- FR-0059 解决“何时允许声称可复现、何时允许记录 hash、哪些 fingerprint-specific 派生内容永远不能出现在 contract 中”。
- 本 FR 只消费 FR-0041，不重写其 sensitivity / redaction state 枚举。

### 与 FR-0040 的关系

- FR-0040 已有 `fingerprint_policy_ref` hook，足够承载本 policy 的 ref。
- 本 FR 不新增 `provider_evidence_record` 字段。
- 后续 evidence owner 需要的新增 machine field，必须在独立 implementation/spec issue 中冻结。

### 与 FR-0049 的关系

- FR-0049 把 `fingerprint_seed_boundary` 定义成 direct descriptor facts。
- FR-0059 为该 boundary 提供更窄的 policy owner，避免 downstream owner 在 descriptor、health 或 capability matrix 中各自重定义 seed rule。
- 本 FR 不改 `FR-0049` shape，只补其可消费 policy 语义。

## Integration 判断

#1156 issue label 为 `integration:local-only`，且本 FR 不修改 shared output shape、Syvert adapter payload、run id semantics 或 cross-repo contract。

因此 PR metadata 应申报：

- `integration_applicable=no`
- `integration_ref=none`
- `external_dependency=none`
- `merge_gate=local_only`
- `contract_surface=none`
- `joint_acceptance_needed=no`

## Live evidence 判断

本 PR 不声称：

- CloakBrowser runtime 已可用
- fingerprint seed 已在真实浏览器应用成功
- anti-detection baseline 已通过
- latest-head fresh live evidence 已采集

因此：

- `gate_applicability.in_scope=false`
- `live_evidence_record=N/A`
- 验证只需要 docs/spec/map/purity/diff checks 与 hosted checks

## 结论

建立 `FR-0059-cloakbrowser-fingerprint-seed-policy` formal suite 是 #1156 的正确落点。它应保持 refs-only 语义，为后续 evidence、health、capability owners 提供一个更窄、可 fail-closed 的 seed policy，而不是把 raw seed、hash disclosure 或 provider-private fingerprint internals 留到实现阶段临场判断。
