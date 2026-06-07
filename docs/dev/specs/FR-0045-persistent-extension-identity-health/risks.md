# FR-0045 风险与缓解

## 风险等级

High。

理由：本 FR 冻结 official Chrome persistent provider admission 前的 extension identity/source binding health check definition。虽然本 PR 不实现 runtime 行为，但错误定义会影响后续 doctor/admission/fixtures 对 persistent provider 的 fail-closed 判断。

## 主要风险

### 1. 新增并行 health result schema

风险：为了表达 persistent extension identity，新增 `persistent_extension_identity_health_result` 或私有 payload，绕过 FR-0038。

影响：M3-C health issues 不能共享 doctor parser、blocking outcome 与 evidence refs，后续 gate 无法统一消费。

缓解：spec 与 contract 明确唯一 carrier 是 `FR-0038.provider_doctor_report.checks[*].category=extension_load`。

### 2. Descriptor refs 被误读为 health pass

风险：后续 consumer 看到 FR-0043 的 extension/profile refs 后直接认定 extension identity healthy。

影响：绕过 actual doctor/admission check，可能把未安装、mismatch 或 staged extension 当作 persistent provider ready。

缓解：本 FR 要求 expected/observed identity/source/profile binding match；required check 缺失、unknown 或 mismatch 时 fail-closed。

### 3. Source/profile mismatch 被 runtime ping 掩盖

风险：extension runtime ping、bootstrap ack 或 service worker wake signal 成功后，被误写成 extension identity/source binding pass。

影响：可能绑定到错误 profile、per-run staged extension 或 unrelated source，破坏 persistent identity 边界。

缓解：GWT 明确 ping/freshness 不替代 identity/source binding；service worker freshness 由 #1142 持有。

### 4. Native Messaging health 混入本 PR

风险：本 FR 顺手定义 native host manifest、allowed origins、host registration 或 bridge readiness。

影响：#1141 ownership 被架空，并可能把 extension identity 与 Native Messaging transport 混成一个不可审查的检查。

缓解：非目标和 sibling boundary 明确 #1141 owns native messaging health。

### 5. Health evidence 泄露敏感路径或账号信息

风险：spec sample、PR body、stdout summary 或 artifact ref 暴露 raw profile path、extension private path、cookie、token、storage、auth header 或 account marker。

影响：泄露本机环境、账号或认证状态。

缓解：evidence refs 消费 FR-0040 与 FR-0041；sensitive locator 必须 redacted/private/opaque；secret raw value 禁止进入 public/unredacted surface。

### 6. Doctor pass 被误当作 runtime/live attestation

风险：persistent extension identity health pass 被写成 runtime ready、live evidence accepted 或 latest-head runtime proof。

影响：绕过 runtime admission 和 live evidence gate。

缓解：本 FR 明确 doctor pass 最高只到 `doctor_checked`；PR metadata `live_evidence_record=N/A`。

### 7. PR scope 混入 implementation 或 fixtures

风险：formal spec PR 同时修改 runtime、extension、tests、fixtures 或 launch evidence。

影响：spec review 与 implementation review 混写，导致 #1140 无法作为 scoped definition 收口。

缓解：allowed write paths 固定为 FR-0045 suite 与 sync map；运行 docs/spec/map/diff/purity checks。

## 回滚

如 suite 被判定边界错误，使用 revert PR 移除 `FR-0045-persistent-extension-identity-health` suite 与 `.github/spec-issue-sync-map.yml` 中 #1140 映射。由于本 PR 不实现 runtime 行为，无需数据迁移、profile 清理、extension uninstall、secret rotation 或 external runtime rollback。
