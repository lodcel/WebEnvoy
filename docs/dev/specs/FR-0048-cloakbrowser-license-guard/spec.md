# FR-0048 CloakBrowser License Guard

Canonical Issue: #1145

## 背景

`#1145` 属于 M10 CloakBrowser Provider lane，目标是在任何 CloakBrowser provider adapter、descriptor、health 或 release packaging 推进前，先冻结 license / binary ownership 边界。上游 `FR-0033 Browser Provider Contract` 已允许表达 `managed_browser_provider`，并明确 CloakBrowser 私有 patch、driver state 与 browser patch schema 不进入 WebEnvoy core contract；`FR-0040 Provider Evidence Kernel` 与 `FR-0041 Evidence Redaction Policy` 已冻结 provider evidence refs、binary locator 与 redaction 规则。

当前缺口是：后续 CloakBrowser lane 需要可机器检查的 guard 来证明 WebEnvoy 仓库、release artifact、fixtures、PR metadata 与 docs examples 不会捆绑或再分发 CloakBrowser 二进制；同时 operator 必须明确自行安装 / 授权该 binary，并提供 license acknowledgement 与 binary source evidence，供后续 `#1212 License / Binary Packaging Audit` 消费。

本 FR 只冻结 CloakBrowser license guard 的 formal contract。它不实现 runtime behavior、provider adapter、descriptor、health doctor、official Chrome、XHS、Syvert、browser patching、release script 或 packaging automation。

`#1145` 的 issue meta 已声明 `Close Semantics: fr-complete`，scope 是 “Prevent bundled redistribution of CloakBrowser binary; record operator-installed binary, license acknowledgement and binary source evidence.” 因此本 suite 的交付结果是冻结 license guard formal suite，为 #1212 audit 与后续 implementation / closeout 消费提供输入。Formal spec review PR 不自动关闭 #1145；release / packaging closeout 由 #1212 消费本 suite 后独立完成。

## 目标

1. 冻结 CloakBrowser binary 不得随 WebEnvoy 仓库、release artifact、fixture、example 或 CI artifact 捆绑 / 再分发的边界。
2. 冻结 operator-installed binary 作为唯一允许的 CloakBrowser binary ownership 模型。
3. 冻结 license acknowledgement 的最小机器字段、缺失阻断与人工责任边界。
4. 冻结 binary source evidence 的最小 evidence ref、provenance、freshness、redaction 与 fail-closed 规则。
5. 明确 #1212 License / Binary Packaging Audit 可消费本 guard，但不得在 closeout 中临场重定义 license / binary packaging contract。

## 非目标

- 不实现 CloakBrowser runtime behavior、provider adapter、descriptor、health doctor、launch、selection、registry entry、CLI command、browser patching 或 executable discovery。
- 不修改 `src/commands`、`src/runtime`、extension、Native Messaging、Playwright、scripts、GitHub workflows、githooks 或 release automation。
- 不冻结 CloakBrowser 私有 patch schema、stealth 参数、driver 内部状态、账号策略、broker 协议或 binary internal manifest。
- 不把 CloakBrowser 设为 WebEnvoy core、default provider、official Chrome replacement 或 browser patching 主路径。
- 不改变 `FR-0033.browser_provider_contract`、`FR-0038.provider_doctor_report`、`FR-0040.provider_evidence_record` 或 `FR-0041.evidence_redaction_policy` 的字段 shape。
- 不定义 Syvert normalized result、Syvert provider adapter、shared business schema、XHS driver 或 live evidence closeout。
- 不执行真实浏览器、真实账号、真实 profile、external visible、live read/write 或 account-touching 操作。

## 功能需求

### 1. Guard ownership 与 contract 定位

系统必须冻结一个稳定的 `cloakbrowser_license_guard` contract。

约束：

- `cloakbrowser_license_guard` 的 ownership 属于 WebEnvoy provider governance / release packaging boundary。
- 该 contract 只表达 CloakBrowser binary ownership、license acknowledgement 与 binary source evidence 的准入和审计边界。
- 该 contract 不得被解释为：
  - provider registry row
  - browser provider contract replacement
  - provider doctor report
  - runtime launch envelope
  - CloakBrowser private patch manifest
  - release artifact manifest
  - Syvert adapter payload
- 后续实现若要执行 CloakBrowser provider adapter、descriptor、health 或 release packaging，必须先消费本 guard，不得以 provider-specific 私有字段绕过 license / binary packaging 阻断。

### 2. No bundled redistribution

WebEnvoy 仓库和 release carrier 必须默认禁止以下内容：

- CloakBrowser executable、installer、archive、launcher binary 或 provider-supplied native component。
- CloakBrowser binary 的复制件、压缩包、缓存、fixture、sample artifact 或 CI artifact。
- 可还原 CloakBrowser proprietary payload 的 patch、diff、bundle、encrypted blob 或 encoded blob。
- 指向仓库内 binary copy 的 path、checksum 或 artifact locator。

约束：

- 任何 CloakBrowser binary 或可还原 payload 出现在 repository tracked files、release artifact、public artifact、fixture 或 example 中，都必须视为 `bundled_binary_detected` blocker。
- 仓库可以保存 operator 安装说明、logical provider id、redacted locator、evidence ref、acknowledgement record 与 audit checklist；这些内容不得包含 binary payload。
- 允许记录 binary checksum / version 结论，但不得把 checksum 当作 redistribution permission。
- 后续 #1212 packaging audit 必须把 “no bundled binary” 作为 release gate required evidence，而不是 advisory note。

### 3. Operator-installed binary model

CloakBrowser binary 的唯一允许 ownership 模型是 `operator_installed_binary`。

约束：

- operator 负责在自己的运行环境中安装、授权、升级、保管和卸载 CloakBrowser binary。
- WebEnvoy 只能引用 operator-provided binary locator 或 provider broker locator；locator 必须按 `FR-0041` 脱敏，不得公开 private absolute path。
- WebEnvoy 不得下载、托管、镜像、缓存、vendor、repack 或自动再分发 CloakBrowser binary。
- 如果后续实现需要自动发现 binary，只能发现 operator-installed source；发现结果必须进入 evidence refs 和 redaction policy，不得复制 binary。
- operator-installed binary 不自动满足 provider selection、doctor pass、runtime readiness 或 live evidence；这些仍由对应 FR / implementation gate 判定。

### 4. License acknowledgement

`cloakbrowser_license_guard.license_acknowledgement` 必须至少冻结以下字段：

- `acknowledgement_id`
- `acknowledgement_version`
- `operator_ref`
- `provider_id`
- `license_terms_ref`
- `acknowledged_at`
- `acknowledgement_method`
- `acknowledgement_scope`
- `acknowledgement_status`
- `evidence_refs`

约束：

- `acknowledgement_version` 当前冻结为 `v1`。
- `operator_ref` 必须是 opaque / redacted ref，不得包含 raw account identifier、email、phone、license key 或 billing data。
- `license_terms_ref` 只能引用 operator-provided terms locator、vendor public terms locator、internal legal approval ref 或 opaque evidence ref；不得复制完整第三方 license text 到 WebEnvoy formal spec、fixture 或 PR body。
- `acknowledgement_method` 至少支持：
  - `operator_attestation`
  - `legal_review_ref`
  - `vendor_account_ref`
  - `manual_record`
- `acknowledgement_scope` 至少支持：
  - `local_development`
  - `internal_testing`
  - `production_runtime`
  - `release_packaging_audit`
- `acknowledgement_status` 至少支持：
  - `acknowledged`
  - `pending`
  - `rejected`
  - `expired`
  - `unknown`
- `pending|rejected|expired|unknown` 命中 CloakBrowser provider execution、packaging audit 或 release gate 时必须 fail-closed。
- license acknowledgement 只证明 operator 已确认许可责任；它不授予 WebEnvoy 再分发 binary 的权限。

### 5. Binary source evidence

`cloakbrowser_license_guard.binary_source_evidence` 必须至少冻结以下字段：

- `binary_source_evidence_id`
- `provider_id`
- `source_kind`
- `source_ref`
- `source_owner`
- `version_ref`
- `checksum_ref`
- `installed_by`
- `collected_at`
- `freshness`
- `sensitivity`
- `redaction_state`
- `artifact_identity`
- `evidence_refs`

约束：

- `source_kind` 至少支持：
  - `operator_installed_binary`
  - `vendor_account_download`
  - `provider_broker_locator`
  - `manual_locator`
  - `unknown`
- `source_owner` 至少支持：
  - `operator`
  - `vendor`
  - `provider`
  - `unknown`
- `installed_by` 至少支持：
  - `operator`
  - `manual_user`
  - `external_system`
  - `unknown`
- `freshness` 必须消费 `FR-0040` freshness 语义，至少能区分 `current_record`、`current_launch`、`current_pr_head`、`historical_background` 与 `not_applicable`。
- `source_ref`、`version_ref` 与 `checksum_ref` 只能是 redacted locator、artifact id、logical id、hash locator 或 opaque handle；不得公开 private absolute path、license key、vendor account id 或 raw download URL containing credential。
- `source_kind=unknown`、`source_owner=unknown`、`installed_by=unknown` 或 required evidence redaction invalid 时，必须阻断 CloakBrowser provider eligibility 和 #1212 release packaging closeout。

### 6. Evidence refs 与 redaction

本 guard 必须消费 `FR-0040.provider_evidence_record.evidence_refs` 与 `FR-0041.evidence_redaction_policy`。

约束：

- CloakBrowser binary locator 默认至少为 `sensitive`。
- license key、vendor account credential、download token、Cookie、auth header、proxy credential、fingerprint seed、provider private patch payload 默认为 `secret`。
- public PR body、stdout summary、fixture、spec sample 或 release note 不得出现 raw private path、raw binary locator、license key、vendor account id、download credential 或 binary payload。
- `redaction_required|policy_missing|invalid` 命中 required license / binary evidence 时必须 fail-closed。
- Evidence ref pass 只证明 evidence disclosure boundary 满足 policy；不提升到 runtime_attested 或 live_evidence_attested。

### 7. Provider contract 与 registry 消费边界

后续 CloakBrowser provider declaration 或 registry entry 必须保持以下关系：

- `FR-0033.provider_family` 可使用 `managed_browser_provider`。
- `FR-0033.limitations` 必须保留 `provider_private_patch_required` 或等价 private provider limitation，直到后续 provider-specific contract 明确更窄边界。
- Provider registry 可以保存 logical provider id 与 guard refs，但不得保存 CloakBrowser binary payload、private patch schema 或 raw binary path。
- Provider selection 必须在目标 capability 需要 CloakBrowser execution 时检查 license acknowledgement、binary source evidence 与 no-bundled-binary conclusion；缺失时 fail-closed。
- Diagnostic-only / metadata-only consumption 可以读取 redacted guard refs，但不得因此把 provider 标记为 business execution eligible。

### 8. #1212 audit consumption

`#1212 License / Binary Packaging Audit` 必须能消费本 guard 形成 release gate evidence。

最小 audit inputs：

- `no_bundled_binary_conclusion`
- `repository_scan_ref`
- `release_artifact_scan_ref`
- `license_acknowledgement_ref`
- `binary_source_evidence_ref`
- `redaction_policy_ref`
- `blocking_reasons`

约束：

- #1212 可以验证 repository / release artifact 不含 CloakBrowser binary，但不得新增与本 FR 冲突的 license acknowledgement 字段或 binary ownership model。
- #1212 如果发现 binary payload、raw private locator、license acknowledgement 缺失、binary source unknown 或 redaction invalid，必须输出 blocker，并保持 closeout 未完成。
- #1212 的 audit pass 不表示 runtime provider ready、live evidence accepted 或 CloakBrowser adapter implementation complete。

### 9. Fail-closed rules

以下情况必须 fail-closed：

- 仓库、release artifact、fixture、example 或 CI artifact 中发现 CloakBrowser binary 或可还原 proprietary payload。
- license acknowledgement 缺失、过期、被拒绝、unknown 或 scope 不覆盖目标用途。
- binary source evidence 缺失、unknown、无法证明 operator-installed source 或 freshness 不满足目标 gate。
- evidence ref redaction 为 `redaction_required|policy_missing|invalid`。
- public surface 暴露 raw private path、raw binary locator、license key、vendor account id、download credential、Cookie、token、auth header 或 provider private patch payload。
- provider selection、doctor、launch 或 release gate 试图用 provider self-declaration 替代 license / binary guard evidence。

## GWT 验收场景

### 场景 1：仓库中发现 CloakBrowser binary 时阻断

Given #1212 release packaging audit 扫描 WebEnvoy repository tracked files
And 扫描结果发现 CloakBrowser executable 或可还原 proprietary payload
When audit 计算 license / binary packaging gate
Then gate 必须输出 `bundled_binary_detected`
And closeout 必须 fail-closed
And 不得把 checksum、operator acknowledgement 或 provider self-declaration 当作放行理由

### 场景 2：operator-installed binary 是唯一允许模型

Given CloakBrowser provider declaration 引用 binary source
When source kind 是 `operator_installed_binary`
And binary locator 已按 FR-0041 脱敏
And license acknowledgement status 是 `acknowledged`
Then provider 可以继续进入后续 provider-specific doctor / selection gate
And 本 FR 不得把该 provider 直接提升为 runtime ready

### 场景 3：license acknowledgement 缺失时阻断

Given CloakBrowser binary source evidence 存在
And license acknowledgement status 是 `unknown`
When provider selection 或 #1212 audit 需要 CloakBrowser execution / release packaging 结论
Then guard 必须 fail-closed
And blocker 必须包含 license acknowledgement 缺口

### 场景 4：binary source evidence 不得公开 raw path

Given binary source evidence 需要表达 operator-installed binary locator
When evidence 写入 PR body、public artifact、fixture 或 spec sample
Then locator 不得包含 private absolute path
And 必须使用 opaque handle、hash locator 或 `<redacted:path:cloakbrowser-binary>`
And sensitivity 至少为 `sensitive`

### 场景 5：#1212 只能消费不能重定义 guard

Given #1212 执行 License / Binary Packaging Audit
When audit 需要判断 no bundled binary、license acknowledgement 与 binary source evidence
Then audit 必须引用 `FR-0048.cloakbrowser_license_guard.v1`
And 不得新增允许 WebEnvoy 再分发 CloakBrowser binary 的降级规则
And audit pass 不得声明 CloakBrowser runtime implementation complete

## 异常与边界场景

### 1. Binary payload 伪装为非 binary 资产

- 压缩包、base64 / hex / encrypted blob、patch bundle、fixture 或 sample artifact 只要可还原 CloakBrowser proprietary binary material，必须按 `redistribution_payload_detected` 阻断。
- checksum、filename、logical provider id 或 redacted locator 可以保留；任何可恢复 payload 不得保留。

### 2. Operator-installed locator 不可公开

- operator-installed binary locator 如果来自 private absolute path、vendor account download、provider broker 或 local environment handle，公开面只能使用 opaque handle、hash locator、artifact identity 或 redacted token。
- raw path / credential-bearing URL 已进入 PR body、fixture、public artifact 或 docs sample 时，必须标记为 `raw_private_locator_leaked` 或 `secret_or_license_material_leaked`，并先清理泄露面再重新验证。

### 3. License acknowledgement scope 不覆盖目标用途

- `acknowledged` 只在 scope 覆盖当前用途时有效。
- 例如只覆盖 `local_development` 的 acknowledgement 不得满足 `production_runtime` 或 `release_packaging_audit`。
- scope mismatch 必须输出 `license_scope_mismatch`，不得降级为 advisory warning。

### 4. Binary source freshness 不满足当前 gate

- `historical_background` evidence 只能作为背景；当 provider selection、doctor input 或 #1212 closeout 要求 current evidence 时，必须提供满足目标 gate 的 current record / launch / PR head evidence。
- stale evidence 必须输出 `binary_source_evidence_stale`，不得用 provider self-declaration 替代。

### 5. Provider 自报与 guard evidence 冲突

- 如果 CloakBrowser provider 自报已安装、已授权或可运行，但 license acknowledgement / binary source evidence 缺失或阻断，以 guard evidence 为准。
- provider self-declaration 只能作为 background metadata；不能解除 required guard blocker。

### 6. #1212 audit 发现本 FR 未覆盖的新 license 风险

- #1212 如果发现本 FR 未覆盖的新 license / redistribution 风险，必须停在 closeout blocker 或拆出正式 spec 修订，不得在 closeout 中临场放宽 ownership model。
- 在新正式输入合入或 scheduler 明确冻结前，release packaging audit 必须保持 fail-closed。

## 验收标准

本 FR 完成时必须满足：

1. `spec.md` 冻结 no bundled redistribution、operator-installed binary、license acknowledgement、binary source evidence 与 #1212 audit consumption。
2. `contracts/cloakbrowser-license-guard.md` 给出可机器消费的最小 contract shape、enum、example 与 fail-closed 规则。
3. `data-model.md` 明确本 FR 不新增 runtime schema，仅新增 license / binary guard record 与 evidence refs 的 formal shape。
4. `research.md` 记录 #1145 / #1212 / FR-0033 / FR-0040 / FR-0041 输入依据，并明确不作第三方法律结论、不下载或验证 CloakBrowser binary。
5. `risks.md` 覆盖 binary redistribution、license responsibility、sensitive locator leak、provider-private leakage、#1212 audit drift 与 spec-only 被误读风险。
6. `TODO.md` 明确 spec review checklist、后续 implementation / audit candidates 与当前 PR scope。
7. 本 suite 不修改 runtime/code/scripts/workflows，不执行 live/browser/account actions，不引入 Syvert、XHS、official Chrome 或 browser patching 范围。

## 完成定义

本 PR 是 #1145 的 formal license guard carrier。PR 合入只表示 CloakBrowser license / binary redistribution guard formal suite 已冻结，可以被 #1212 和后续 CloakBrowser provider implementation / closeout 消费。它不自动关闭 #1145，也不表示 #1212 closeout、CloakBrowser descriptor、health、runtime adapter、provider selection 或 live evidence 已完成。
