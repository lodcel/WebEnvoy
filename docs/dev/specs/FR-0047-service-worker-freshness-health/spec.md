# FR-0047 Extension Service Worker Freshness Health

Canonical Issue: #1142

## 背景

`#1142` 属于 `#1113 M3 official-chrome Provider` 的 M3-C capability and health batch。上游 `FR-0038 Provider Health / Doctor Contract` 已冻结 `provider_doctor_report`、check status、severity、blocking、diagnostics 与 evidence refs；`FR-0043 official-chrome.persistent Descriptor` 已为 persistent profile extension 暴露 `service_worker_readiness_ref`；`FR-0040 Provider Evidence Kernel` 与 `FR-0041 Evidence Redaction Policy` 已冻结 provider evidence refs、freshness、sensitivity 与 redaction 边界。

当前缺口是 official Chrome persistent provider 在 runtime admission 前，需要能判断 active extension bundle 与 MV3 service worker 当前执行代码是否匹配期望 bundle。该判断必须落在 FR-0038 health / doctor contract 内，不创建新的 health result schema。

本 FR 只冻结 extension service worker freshness / code identity health 的 contract delta。它不实现 doctor command、Chrome extension、Native Messaging、Playwright、runtime launch、live evidence、fixtures 或任何真实浏览器行为。

## 目标

1. 冻结 official Chrome persistent provider 的 active extension bundle freshness 与 service worker code identity 健康检查边界。
2. 明确该健康检查只消费 `FR-0038.provider_doctor_report`，不得定义新 health result schema。
3. 明确 service worker freshness 如何映射到 `FR-0038` 的 `extension_load` required check、status、failure semantics、blocking 与 evidence refs。
4. 明确 evidence refs 必须消费 `FR-0040` freshness / artifact identity 与 `FR-0041` redaction policy。
5. 明确与 `#1140` persistent extension identity health、`#1141` native messaging health、`#1139` capability matrix、`#1143` launch evidence、`#1144` fixtures 的 ownership 边界。

## 非目标

- 不定义新的 health result schema、runtime status schema、launch evidence record、fixture payload 或 capability matrix row。
- 不实现 service worker inspection、bundle hash calculation、Chrome extension reload、runtime admission、doctor command、CLI、native host、Playwright 或 browser automation code。
- 不定义 persistent extension identity health；extension id、installation source、profile installation identity 与 stable identity mismatch 属于 `#1140`。
- 不定义 native messaging health；host manifest、allowed origins、registration 与 bridge readiness 属于 `#1141`。
- 不定义 official Chrome capability matrix、support rows、verification thresholds 或 action coverage；这些属于 `#1139`。
- 不推进 `#1143` launch evidence、`#1144` fixtures、Syvert normalized result、CloakBrowser-as-core、browser patching、XHS runtime/live flows 或 account-touching actions。
- 不要求 fresh live evidence；本 FR 是 formal spec review PR，`live_evidence_record` 对本 PR 为 `N/A`。

## 功能需求

### 1. Ownership 与 contract 定位

- 系统必须把 `extension_service_worker_freshness_health` 定义为 `FR-0038.provider_doctor_report` 内的 official Chrome persistent provider health delta。
- 该 delta 只表达 active extension bundle freshness 与 service worker code identity。
- 该 delta 不得被解释为:
  - extension persistent identity health
  - native messaging health
  - runtime attestation
  - live evidence record
  - launch evidence record
  - capability matrix
  - fixture schema
- 后续实现若要输出该健康结果，必须输出合法的 `FR-0038.provider_doctor_report`，并保持 FR-0038 fail-closed 语义。

### 2. Provider 与 descriptor 输入

该健康检查只适用于:

- `provider_id=official-chrome.persistent`
- `FR-0043.extension_binding.extension_binding_kind=persistent_profile_extension`
- `FR-0043.extension_binding.service_worker_readiness_ref` 存在

约束:

- `provider_id`、`provider_contract_version`、`provider_version` 必须按 FR-0038 report identity 从 provider contract / descriptor 输入对齐。
- `service_worker_readiness_ref` 是 readiness locator，不是 ready/pass 证据。
- descriptor 缺少 service worker readiness ref 时，本 health delta 对 persistent provider 必须 fail-closed。
- `official-chrome.direct`、Chromium fallback、Chrome for Testing fallback 或 developer-only staged extension 不能被写成本 FR 的 official Chrome persistent service worker freshness 主路径。

### 3. FR-0038 check mapping

后续实现必须把该健康检查表达为 `provider_doctor_report.checks[*]`:

- `category=extension_load`
- provider-level check 使用 `capability_id=N/A`
- 若某 capability 的 runtime requirement 依赖 extension binding，可额外输出 capability-level `capability_readiness`，但不得改变本 health delta 的 result shape

约束:

- 本 FR 不新增 FR-0038 check category、status、severity、blocking 或 outcome 枚举。
- required extension binding 命中时，该 check 是 required check。
- check 缺失、status 为 `fail|unknown`、或唯一 required evidence 不可用时，必须按 FR-0038 fail-closed。
- service worker freshness 不得满足 `runtime_attested` 或 `live_evidence_attested`；doctor pass 最高只能推进到 `doctor_checked`。

### 4. Freshness 与 code identity 结论

该 health check 的 machine-readable diagnostics 必须至少能表达以下结论字段，作为 `FR-0038.ProviderDoctorDiagnostics` 的稳定 `code` 与 observed / expected value:

- expected extension bundle identity locator
- observed active service worker script identity locator
- expected bundle version or digest locator
- observed service worker code digest locator
- active worker lifecycle state
- freshness comparison result
- remediation hint

约束:

- identity locator 可以是 digest、artifact id、logical ref、redacted path token 或 report-local locator。
- raw extension source、private absolute path、profile path、bootstrap payload、token、Cookie、storage 或 account data 不得进入 diagnostics、summary、PR body 或 public artifact。
- `freshness comparison result` 至少要能区分:
  - expected and observed match
  - observed stale
  - observed unknown
  - expected identity missing
  - observed identity missing
  - evidence redaction invalid
- 后续实现可以使用更具体的 diagnostic `code`，但不得改变 FR-0038 object shape。

### 5. Status、severity 与 blocking

后续实现必须按以下最低语义映射:

| Condition | FR-0038 status | severity | blocking |
|---|---|---|---|
| expected bundle identity and observed active service worker code identity match | `pass` | `info` | `none` |
| service worker lifecycle is temporarily unavailable but recoverable evidence exists | `warn` | `warning` | `capability_blocking` or `provider_blocking` according to requested scope |
| observed service worker code digest is stale or mismatched | `fail` | `error` | `provider_blocking` when provider extension binding is required |
| expected bundle identity is missing | `fail` | `fatal` | `provider_blocking` |
| observed identity cannot be collected | `unknown` | `error` | `provider_blocking` when extension binding is required |
| required evidence has redaction gap or invalid locator | `fail` | `error` | `provider_blocking` |

约束:

- `warn` 不得被当作 ready。若目标 provider / capability admission 需要 extension binding fresh, `warn` 必须进入 recovery / defer / deny 路径。
- stale、unknown、missing expected identity、missing observed identity 或 redaction invalid 命中 required extension binding 时必须 fail-closed。
- `severity=fatal` 必须对应 `blocking=provider_blocking`。

### 6. Evidence refs

该 health check 必须通过 FR-0038 `evidence_refs` 引用证据，并消费 FR-0040 / FR-0041:

- FR-0038 `evidence_refs[*].kind` 优先使用 `extension_state_ref` 或 `doctor_artifact_ref`。
- 对应 provider evidence 侧 locator 必须可映射到 FR-0040 `provider_evidence_record.evidence_refs[*]`，优先使用 `kind=extension_binding_ref`、`kind=provider_health_ref` 或 `kind=runtime_observation_ref`。
- freshness 必须能表达是否满足当前 doctor / runtime admission 输入；历史 artifact 只能作为背景。
- sensitivity 与 redaction 必须按 FR-0041 执行。

约束:

- service worker source、extension installation path、profile path、raw command output、manifest path 与 local artifact root 默认至少为 `sensitive`，必须使用 redacted/private locator。
- extension private payload、bootstrap secret、Cookie、storage、token 或 account material 默认为 `secret`，不得作为 raw evidence。
- `redaction_required|policy_missing|invalid` 命中 required evidence 时，health check 不得为 `pass`。
- `historical_background` evidence 不得满足 current freshness requirement。

### 7. Boundary relations

本 FR 必须保持以下边界:

- 与 `FR-0038`: 只消费 `provider_doctor_report` 与 check semantics，不新增 health schema。
- 与 `FR-0040`: 只消费 provider evidence refs、freshness、artifact identity 与 blocking reason 语义，不定义 launch evidence record。
- 与 `FR-0041`: 只消费 sensitivity、redaction state、locator 与 secret handling policy，不新增 redaction enum。
- 与 `FR-0043`: 消费 persistent descriptor 的 `service_worker_readiness_ref`，不改 descriptor common shape 或 persistent delta。
- 与 `#1140`: 不判断 stable extension id、profile installation identity、extension source ownership 或 persistent extension identity mismatch。
- 与 `#1141`: 不判断 native host manifest、allowed origins、host registration 或 bridge readiness。
- 与 `#1139`: 不声明 capability support matrix 或 default eligibility。
- 与 `#1143`: 不生成 launch evidence artifact。
- 与 `#1144`: 不生成 official Chrome fixtures。

## GWT 验收场景

### 场景 1：健康结果必须使用 FR-0038

Given 后续实现需要报告 official Chrome persistent service worker freshness
When 输出 health result
Then result 必须是合法的 `FR-0038.provider_doctor_report`
And service worker freshness 必须表达为 `category=extension_load`
And 不得出现新的 top-level health result schema

### 场景 2：active service worker 代码过期时阻断

Given expected bundle digest 与 observed active service worker code digest 不一致
When provider doctor 计算 service worker freshness
Then check status 必须为 `fail`
And blocking 必须为 `provider_blocking` when extension binding is required
And outcome 不得把 provider 写成 doctor pass

### 场景 3：缺少 expected identity 时 fail-closed

Given persistent descriptor 提供 service worker readiness ref
And health input 缺少 expected bundle identity locator
When provider doctor 评估 extension service worker freshness
Then check 必须为 `fail`
And severity 必须为 `fatal`
And diagnostics code 必须稳定表达 expected identity missing

### 场景 4：redaction gap 不得 pass

Given service worker evidence 的唯一 locator 包含未脱敏 private profile path
When health check 生成 evidence refs
Then redaction state 必须为 `invalid` 或 `redaction_required`
And check 不得为 `pass`
And required extension binding 必须 fail-closed

### 场景 5：历史 artifact 不能证明当前 freshness

Given evidence ref freshness 是 `historical_background`
When current doctor input 要求 active service worker freshness
Then historical evidence 只能作为背景
And check 必须输出 `unknown` 或 `fail`
And 不得把历史 artifact 当作 current ready proof

### 场景 6：不越界到相邻 health

Given reviewer 检查 FR-0047 suite
When suite 提到 persistent extension identity 或 native messaging readiness
Then 只能作为 ownership boundary 或 downstream dependency
And 不得定义 #1140 或 #1141 的 health semantics

## 异常与边界场景

- `provider_id` 不是 `official-chrome.persistent` 时，本 health delta 不得作为 official Chrome persistent service worker freshness 结果消费。
- descriptor 缺少 `service_worker_readiness_ref` 时，consumer 必须 fail-closed 或要求 descriptor 修复。
- observed service worker lifecycle 临时不可用时，不得直接 pass；只能 warn / unknown 并进入 recovery、defer 或 deny。
- expected 与 observed identity 来源冲突时，必须取更保守结论并输出 source conflict diagnostic。
- raw extension source、profile path、private absolute path、token、Cookie、storage 或 bootstrap secret 进入 evidence 时，必须按 FR-0041 输出 redaction invalid / secret leak blocker。
- 只存在 `runtime.ping`、bootstrap ack 或 native bridge ready 时，不得证明 service worker code identity fresh。
- 本 PR 不产出 latest-head live evidence，PR metadata 中 `live_evidence_record` 必须为 `N/A`。

## 验收标准

1. FR-0047 formal suite 使用固定路径 `docs/dev/specs/FR-0047-service-worker-freshness-health/` 并映射 canonical issue `#1142`。
2. suite 明确 service worker freshness / code identity health 只消费 FR-0038 provider doctor report，不定义新 schema。
3. suite 明确 FR-0038 `extension_load` check、status、severity、blocking、diagnostics 与 fail-closed 映射。
4. suite 明确 evidence refs 消费 FR-0040 freshness / artifact identity 与 FR-0041 redaction policy。
5. suite 明确不承接 #1140、#1141、#1139、#1143、#1144 或 runtime/live/browser 行为。
6. GWT 与异常场景覆盖 stale worker、missing expected identity、redaction gap、historical evidence 与 ownership boundary。
