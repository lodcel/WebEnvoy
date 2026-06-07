# FR-0045 Persistent Extension Identity Health

Canonical Issue: #1140

## 背景

`#1140` 属于 `#1113 official-chrome Provider` 的 M3-C capability and health 批次，目标是在 official Chrome persistent provider 进入后续 provider admission 前，冻结 persistent extension identity 与 source binding 的 health check 定义。

本 FR 消费以下已冻结输入：

- `FR-0038 Provider Health / Doctor Contract`：持有 `provider_doctor_report`、`extension_load` check category、status、severity、blocking、evidence refs 与 fail-closed 语义。
- `FR-0040 Provider Evidence Kernel`：持有 provider evidence record、extension/profile evidence refs、freshness、redaction state 与 required evidence fail-closed 语义。
- `FR-0041 Evidence Redaction Policy`：持有 health evidence 的 sensitivity、locator、secret handling 与 disclosure boundary。
- `FR-0043 official-chrome.persistent Descriptor`：持有 `official-chrome.persistent` descriptor delta、persistent profile reference、extension binding refs 与 service worker/native messaging readiness refs。

本 FR 只定义 official Chrome persistent extension identity/source binding health check 如何消费上述契约。它不定义新的 health result schema，不实现 doctor command，不执行 Chrome / extension / Native Messaging / Playwright / browser live 检查，也不修改 runtime code。

`#1140` 的 issue meta 声明 `Close Semantics: work-item-complete`，且 scope 明确是 “only the persistent extension identity health check definition for official Chrome”。因此本 formal suite 合入后关闭 #1140 的 scoped check definition；native messaging health、service worker freshness、capability matrix、launch evidence、fixtures 与 runtime implementation 仍由各自 issue 承接。

## 目标

1. 冻结 `official-chrome.persistent` 的 persistent extension identity/source binding required health check 定义。
2. 规定该检查必须作为 `FR-0038.provider_doctor_report.checks[*]` 中的 `category=extension_load` check 被表达。
3. 明确 stable extension identity、profile-scoped installation/source binding 与 descriptor refs 的匹配要求。
4. 规定 health evidence refs 必须消费 `FR-0040` 与 `FR-0041` 的 evidence / redaction 边界。
5. 明确本 FR 不定义 native messaging health、service worker freshness、capability matrix、launch evidence、fixtures 或 live evidence。

## 非目标

- 不新增 `provider_doctor_report` 之外的 health result object、status enum、severity enum、blocking enum、outcome schema 或 private health payload。
- 不实现 `webenvoy provider doctor`、runtime status、extension probe、profile probe、parser、validator、fixture、CLI formatter 或 GitHub workflow。
- 不定义 Native Messaging host / manifest / allowed origins / bridge health；这些属于 #1141。
- 不定义 MV3 service worker freshness、wakeability、heartbeat、event page recovery 或 runtime message freshness；这些属于 #1142。
- 不定义 official Chrome capability matrix、support rows、verification thresholds 或 action coverage；这些属于 #1139。
- 不定义 launch evidence record、artifact identity、fresh live evidence、runtime attestation 或 redaction shape；#1143 消费 `FR-0040` 与 `FR-0041`。
- 不推进 official Chrome fixtures；这些属于 #1144。
- 不执行 live/browser/runtime/Syvert/CloakBrowser/XHS/account-touching 或 external-visible actions。

## 功能需求

### 1. Contract 定位与 ownership

系统必须把 persistent extension identity health 定义为 `FR-0038.provider_doctor_report` 的一个 required `extension_load` check profile。

约束：

- 本 FR 的 ownership 只覆盖 `official-chrome.persistent` 的 stable extension identity 与 source/profile binding health。
- check carrier 必须是 `FR-0038.provider_doctor_report.checks[*]`；不得创建 `persistent_extension_identity_health_result`、`extension_identity_report` 或其他并行 result shape。
- check category 必须为 `extension_load`。
- check status、severity、blocking、diagnostics、evidence_refs 与 aggregate outcome 必须复用 `FR-0038` 语义。
- check evidence locator、sensitivity、redaction state 与 public disclosure 必须消费 `FR-0040` 与 `FR-0041`。

### 2. Required check trigger

后续 doctor / admission consumer 面对 `official-chrome.persistent` 时，必须要求本 health check。

触发条件：

- `FR-0043.official-chrome.persistent.provider_id=official-chrome.persistent`。
- `FR-0043.engine.extension_binding_support=required`。
- `FR-0043.profile_semantics.profile_persistence=required` 且 `profile_binding_support=required`。
- `FR-0043.extension_binding.extension_binding_kind=persistent_profile_extension`。

约束：

- required check 缺失时，`provider_doctor_report` 对 persistent provider admission 必须 fail-closed。
- 若 capability runtime requirement 包含 `extension_binding` 或 `provider_doctor_passed`，本 check 失败或 unknown 时对应 capability 必须 fail-closed。
- direct variant `official-chrome.direct` 不适用本 check；不得把 direct 的 `extension_binding_support=none` 解释为 persistent identity health pass。

### 3. Extension identity match

本 check 必须验证 observed extension identity 与 expected extension identity ref 一致。

必须覆盖的 identity facts：

- expected provider id 为 `official-chrome.persistent`。
- expected extension identity ref 来自 `FR-0043.extension_binding.extension_identity_ref`。
- observed extension id 与 expected stable extension id 匹配。
- observed manifest identity / version 可追溯到 expected extension identity ref。
- observed browser channel 仍为 `Google Chrome stable`，不得用 Chromium、Chrome for Testing、headless-only 或 provider patch 替代。

约束：

- extension id 缺失、mismatch、unknown 或来源不可追溯时，check 必须 `status=fail|unknown`，并至少 `blocking=provider_blocking`，除非后续正式 FR 明确只阻断某个 optional capability。
- 仅看到 extension runtime ping、bootstrap ack 或 service worker wake signal，不足以证明 extension identity match。
- 本 FR 不冻结 extension distribution mechanism；Chrome Web Store、external extension、developer mode unpacked 等安装方式不得在本 FR 被写成正式方案。

### 4. Source and profile binding match

本 check 必须验证 observed extension installation/source binding 与 selected persistent profile 绑定一致。

必须覆盖的 binding facts：

- expected profile reference 来自 `FR-0043.profile_semantics.profile_reference`。
- observed extension installation 是 profile-scoped installation，不是 per-run staged extension。
- observed extension source / installation ref 与 expected `extension_installation_ref` 匹配。
- observed profile binding 与 selected named profile / profile locator ref 匹配。
- observed binding 不来自 unrelated profile、ephemeral direct profile、temporary staged extension 或 mismatched source locator。

约束：

- profile-scoped installation 缺失、source mismatch、profile mismatch、ephemeral profile contamination 或 staged extension fallback 命中时，本 check 必须 fail-closed。
- profile lock ownership、stale lock、account safety 与 login state readiness 不由本 FR 定义；本 check 只能要求与 persistent profile ref 的 identity/source binding 一致。
- 本 check 不得把 profile binding match 写成 profile lock ready 或 account ready。

### 5. Evidence refs consumption

本 check 必须用 evidence refs 表达证明来源，不得内嵌敏感 runtime 原文。

必须消费的 evidence ref 边界：

- 在 `FR-0038.provider_doctor_report.checks[*].evidence_refs` 中使用 `extension_state_ref`、`profile_state_ref` 或 `doctor_artifact_ref` 等既有 kind。
- 若引用 provider evidence record，必须使用 `FR-0040.provider_evidence_record.evidence_refs[*]` 中的 `extension_binding_ref`、`profile_binding_ref`、`browser_channel_attestation` 或 `provider_health_ref` 等既有 kind。
- evidence ref 必须表达 availability；required evidence `unavailable|partial` 时必须 fail-closed。
- sensitive locator 必须遵循 `FR-0041`，使用 redacted/private/opaque locator，不得公开 raw path、profile path、extension private path、cookie、token、storage、auth header 或 secret。
- `redaction_state=redaction_required|policy_missing|invalid` 命中 required evidence 时，check 必须 fail-closed。

约束：

- `sensitivity=secret` 的 raw value 不得进入 spec sample、PR body、stdout summary 或 unredacted artifact。
- Evidence freshness 不得被本 check 提升为 `runtime_attested` 或 `live_evidence_attested`；doctor pass 最高只能到 `doctor_checked`。
- 本 FR 不要求 latest-head fresh live evidence；PR metadata 的 `live_evidence_record` 必须为 `N/A`。

### 6. Diagnostics and failure semantics

本 check 的 diagnostics 必须复用 `FR-0038.provider_doctor_diagnostics` 的机器可读语义，至少说明 observed/expected mismatch 类型、影响范围与 remediation hint。

必须 fail-closed 的 failure classes：

- expected extension identity ref 缺失或不可解析。
- observed extension id 缺失、unknown 或与 expected stable extension id 不匹配。
- observed extension source / installation ref 与 expected ref 不匹配。
- observed profile binding 与 selected persistent profile ref 不匹配。
- observed binding 来自 per-run staged extension、ephemeral direct profile 或 unrelated profile。
- browser channel 不是 `Google Chrome stable`。
- required evidence unavailable、partial、redaction invalid 或 policy missing。
- check 试图用 service worker freshness、native messaging readiness、runtime bootstrap ack 或 live evidence claim 替代 extension identity/source binding match。

约束：

- `status=unknown` 在影响 persistent provider admission 时必须 fail-closed。
- `status=fail` 不得对应 `blocking=none`。
- provider-level identity/source mismatch 默认 `blocking=provider_blocking`。
- 若后续 capability-specific consumer 只请求不依赖 persistent extension binding 的 diagnostic-only capability，可在独立 FR 中定义 narrower exception；本 FR 不提供该例外。

### 7. Boundary with sibling M3-C health issues

本 FR 必须保持以下边界：

- #1141 owns Native Messaging health：native host identity、manifest registration、allowed origins、bridge reachability 与 transport health 不在本 FR 定义。
- #1142 owns service worker freshness：MV3 service worker lifecycle、freshness、wakeability 与 runtime message freshness 不在本 FR 定义。
- #1139 owns capability matrix：本 FR 不声明 persistent provider 支持哪些 business capability。
- #1143 owns launch evidence：本 FR 不定义 launch artifact、runtime attestation 或 evidence record shape。
- #1144 owns official Chrome fixtures：本 FR 不创建 fixture payload。

## GWT 验收场景

### 场景 1：persistent provider 缺少 extension identity check 时阻断

Given `official-chrome.persistent` descriptor 声明 `extension_binding_support=required`
And provider doctor report 没有 `category=extension_load` 的 persistent extension identity check
When 后续 provider admission 消费 doctor report
Then persistent provider admission 必须 fail-closed
And 不得把 descriptor refs 当作 extension identity health pass

### 场景 2：extension id mismatch 时阻断 provider

Given expected extension identity ref 指向 stable extension id
And observed extension id 与 expected stable extension id 不一致
When persistent extension identity health check 聚合结果
Then check 必须为 `status=fail`
And `blocking=provider_blocking`
And provider outcome 不得提升到 `doctor_checked`

### 场景 3：source/profile mismatch 不等于 service worker freshness

Given observed extension id 匹配 expected stable extension id
And observed installation 来自 unrelated profile 或 per-run staged extension
When health check 判断 source binding
Then check 必须 fail-closed
And 不得用 service worker wake signal 或 runtime ping 替代 source/profile binding match

### 场景 4：health evidence 必须按 FR-0041 脱敏

Given extension binding evidence 引用了 profile locator 或 extension source locator
When doctor report 写入 evidence refs
Then locator 必须使用 redacted/private/opaque ref
And raw profile path、raw extension path、cookie、token 或 storage 内容不得进入 PR body、stdout summary 或 spec sample

### 场景 5：native messaging health 留给 #1141

Given extension identity/source binding check 已通过
And Native Messaging allowed origin 或 host registration 仍 unknown
When reviewer 检查 FR-0045 范围
Then 本 FR 不得声明 native messaging health pass
And downstream admission 仍必须等待 #1141 对应 health check 或后续 owner

### 场景 6：本 PR 不要求 live evidence

Given 本 suite 只冻结 persistent extension identity health definition
When PR metadata 声明 live evidence
Then `live_evidence_record` 必须为 `N/A`
And 不得把 doctor check definition 写成 latest-head live evidence

## 异常与边界场景

- `provider_id` 不是 `official-chrome.persistent`：不得应用本 check profile。
- `extension_binding_support` 不是 `required`：不得把本 check 结果强行套用为 persistent provider admission。
- expected extension identity ref 缺失：required input 缺失，必须 fail-closed。
- observed identity / source / profile binding 任一为 unknown：影响 persistent provider admission 时必须 fail-closed。
- evidence ref 缺失、不可用、redaction invalid 或 policy missing：若该 evidence 是 required check 的依据，必须 fail-closed。
- check 声称 service worker fresh、native messaging ready、runtime bootstrap ready、runtime attested 或 live evidence attested：视为 scope violation。
- check 内嵌 secret、cookie、token、storage、raw profile path 或 raw extension private path：视为脱敏违规。

## 验收标准

1. 本 suite 已冻结 `official-chrome.persistent` persistent extension identity/source binding health check definition。
2. 本 suite 明确 check carrier 为 `FR-0038.provider_doctor_report.checks[*]` 的 `category=extension_load`，未新增 health result schema。
3. 本 suite 已规定 identity match、source/profile binding match、evidence refs、redaction 与 fail-closed 规则。
4. 本 suite 明确不定义 #1141 native messaging health、#1142 service worker freshness、#1139 capability matrix、#1143 launch evidence、#1144 fixtures 或 runtime implementation。
5. 当前 PR 只修改 `docs/dev/specs/FR-0045-persistent-extension-identity-health/**` 与 `.github/spec-issue-sync-map.yml`，并使用 `Fixes #1140` 关闭 scoped work item。
