# FR-0043 official-chrome.persistent Descriptor

Canonical Issue: #1138

## 背景

`#1138` 属于 M3-B official Chrome descriptors，目标是在 `#1137` / `FR-0042` 已冻结 official Chrome common descriptor shape 与 `official-chrome.direct` 变体后，只补齐 `official-chrome.persistent` 的 persistent-specific descriptor delta。

本 FR 消费以下已关闭输入：

- `FR-0042 official-chrome.direct Descriptor`：持有 `official_chrome_descriptor` common shape 与 direct variant。
- `FR-0033 Browser Provider Contract`：提供 provider identity、mode、engine、transport、capability、verification 与 limitation 的基础 contract。
- `FR-0036 Provider Registry`：提供 provider registry entry 与 registry alignment 形状。

本 FR 不重新定义 `FR-0042` 的 common shape，也不定义 health result schema、launch evidence record、redaction shape、runtime implementation 或 fresh live evidence。它只冻结 persistent profile reference、persistent extension binding、native messaging readiness references、profile identity constraints，以及与 direct variant 的必要对照说明。

## 目标

1. 将 `official_chrome_descriptor.variant_kind` 的可消费范围增补为 `persistent`，但不改变 common shape 字段语义。
2. 冻结 `official-chrome.persistent` 的 provider identity 与 persistent-specific delta。
3. 明确 persistent profile reference、persistent extension binding、native messaging readiness references 与 profile identity constraints 的 descriptor 边界。
4. 为 `#1139` capability matrix、M3-C health issues、`#1143` launch evidence 与 `#1144` fixtures 提供可消费静态输入。
5. 保持本 PR 为 formal descriptor contract carrier，不进入 runtime、health schema、evidence schema、fixture 或 live action。

## 非目标

- 不重写 `FR-0042` 已冻结的 `official_chrome_descriptor` common fields、common ownership 或 direct variant。
- 不定义 health / doctor result schema；`#1140/#1141/#1142` 必须消费 `FR-0038`。
- 不定义 launch evidence record、runtime attestation record、redaction shape 或 fresh live evidence；`#1143` 消费 `FR-0040` 与 `FR-0041`。
- 不定义 capability matrix support rows、verification thresholds 或 action coverage；这些属于 `#1139` 并消费 `FR-0035`。
- 不实现 provider registry parser、selection、doctor、runtime launch、extension install、native host、Playwright、CLI、fixtures 或 tests。
- 不推进 CloakBrowser、Syvert normalized result、browser patching、full XHS driver、live write 或 runtime/live actions。

## 功能需求

### 1. Descriptor delta 定位与 ownership

`official-chrome.persistent` 必须被定义为 `FR-0042.official_chrome_descriptor` common shape 的一个 variant delta。

约束：

- `common_shape_owner` 仍必须指向 `#1137` / `FR-0042`。
- 本 FR 只能增补 persistent-specific 字段与约束，不得重新解释 common 字段。
- persistent delta 不是 runtime status、profile lock state、extension runtime state、native messaging session、health result、launch evidence、live evidence record 或 fixture。
- 后续 consumer 若需要 runtime readiness，必须消费 `FR-0038`、`FR-0040`、`FR-0041` 或对应 runtime owner。

### 2. Persistent provider identity

`official-chrome.persistent` 必须冻结以下 identity：

- `provider_id`: `official-chrome.persistent`
- `provider_family`: `official_chrome`
- `provider_version`: `v1`
- `contract_version`: `v1`
- `distribution_channel`: `builtin`
- `implementation_owner`: `webenvoy_core`

约束：

- `provider_id` 必须与 `official-chrome.direct` 不同。
- identity 只表达 provider descriptor namespace，不证明 Chrome 已安装、profile 已绑定、extension 已安装、native messaging 已 ready 或 doctor 已通过。
- `provider_identity` 必须继续可映射到 `FR-0033.BrowserProviderIdentity`。

### 3. Persistent mode 与 engine delta

`official-chrome.persistent` 必须声明：

- `provider_mode`: `core_managed`
- `engine_family`: `chrome`
- `browser_channel`: `Google Chrome stable`
- `browser_version_range`: `system_installed`
- `headless_policy`: `forbidden`
- `extension_binding_support`: `required`
- `profile_binding_support`: `required`

约束：

- `Google Chrome stable` 必须保持 `FR-0033` canonical label。
- `system_installed` 只表达依赖本机 branded Google Chrome stable，不表示本 PR 已完成安装验证。
- persistent descriptor 必须保持 headful real browser 路线；不得用 headless、Chrome for Testing、Chromium fallback 或 provider patch 替代 official Chrome stable descriptor。
- `required` 表示 persistent provider 的执行前置需要 extension/profile binding；它不自证 binding 已满足。

### 4. Persistent transport delta

`official-chrome.persistent` 必须声明：

- `transport_kind`: `hybrid`
- `transport_owner`: `webenvoy_core`
- `command_surface`: `runtime_control`, `page_automation`, `diagnostics`, `artifact_passthrough`
- `attach_model`: `launch`
- `native_messaging_support`: `required`
- `cdp_support`: `supported`
- `playwright_support`: `supported`

约束：

- hybrid transport 只表示 persistent provider 同时依赖 extension bridge / native messaging readiness 与 Playwright/CDP 编排。
- native messaging readiness 必须以引用表达，不得在本 FR 定义 health result payload。
- transport 声明不得绕过“浏览器内执行是唯一 HTTP 出口”的架构红线。
- 本 FR 不冻结 launch envelope、process lifecycle schema、runtime readiness schema 或 evidence artifact。

### 5. Persistent profile reference

`official-chrome.persistent.profile_semantics` 必须增补 persistent-specific fields：

- `profile_kind`: `persistent_profile`
- `profile_persistence`: `required`
- `login_state_reuse`: `expected_when_profile_ready`
- `profile_locking`: `required`
- `cleanup_expectation`: `preserve_profile_state`
- `profile_reference`: `PersistentProfileReference`
- `profile_identity_constraints`: `ProfileIdentityConstraint[]`

约束：

- `profile_reference` 是逻辑引用，不得内联 secret、cookie、完整本机敏感路径或账号凭据。
- profile readiness、lock ownership、stale lock、concurrent use 与 account safety 必须由 runtime / health owner 判定；descriptor 只能声明 required references。
- `login_state_reuse=expected_when_profile_ready` 不等于登录态已存在或账号可用。
- cleanup expectation 表示 persistent provider 不应按 direct ephemeral cleanup 处理 profile，不定义具体清理实现。

### 6. Persistent extension binding

`official-chrome.persistent` 必须增补 `extension_binding`：

- `extension_binding_kind`: `persistent_profile_extension`
- `extension_identity_ref`: stable extension identity reference
- `extension_installation_ref`: profile-scoped installation reference
- `extension_runtime_ref`: extension runtime readiness reference
- `service_worker_readiness_ref`: MV3 service worker readiness reference

约束：

- 本 FR 只冻结引用槽位与约束，不定义 extension install procedure、Chrome Web Store / external extension / developer mode 分发方案。
- extension id、manifest version、allowed origins 或 native host allowed origins 如需进入实现，必须由对应 runtime / installation / evidence owner 在后续事项中冻结。
- service worker readiness 是 health / runtime 判定输入，不得在 descriptor 中写成 ready result schema。

### 7. Native messaging readiness references

`official-chrome.persistent` 必须增补 `native_messaging_readiness_refs`：

- `native_host_identity_ref`
- `native_host_manifest_ref`
- `allowed_origins_ref`
- `host_registration_ref`
- `bridge_readiness_ref`

约束：

- refs 只表达 persistent provider 需要哪些 native messaging readiness 输入。
- 本 FR 不定义 native host manifest schema、host registration implementation、message envelope、doctor result 或 runtime status。
- native messaging 不得被用来把目标站点 HTTP 请求移出浏览器进程。

### 8. Capability declaration references

`official-chrome.persistent.capability_declaration_refs` 必须继续只表达引用：

- `FR-0033.browser_provider_contract.capabilities`
- `FR-0035.provider_capability_verification_model`
- `#1139 official Chrome Capability Matrix`

约束：

- 本 FR 不声明 persistent variant 支持哪些 business capability、action、layer 或 verification threshold。
- #1139 可以消费 persistent descriptor 的 identity/mode/engine/transport/profile/extension/native messaging refs。
- #1139 不得反向改写 `FR-0042` common shape 或本 FR persistent delta ownership。

### 9. Limitation references

`official-chrome.persistent.limitation_refs` 必须至少声明：

- `persistent_requires_profile_binding`
- `persistent_requires_extension_binding`
- `persistent_requires_native_messaging`
- `persistent_requires_profile_identity_match`
- `persistent_no_descriptor_level_runtime_readiness`
- `persistent_no_latest_head_live_evidence`

约束：

- limitation refs 是 descriptor 边界说明，不是 capability fail-closed matrix。
- required binding refs 命中 runtime requirement 时，后续 selection / health / launch owner 必须继续验证，不得因 descriptor 存在而放行。
- `persistent_no_latest_head_live_evidence` 只说明本 spec PR 不产出 fresh evidence，不表示后续 persistent runtime 不能产出 evidence。

### 10. Evidence reference slots

`official-chrome.persistent.evidence_reference_slots` 必须沿用 `FR-0042` slots，并允许 persistent consumer 在后续 owner 中填充：

- `static_descriptor_ref`
- `registry_entry_ref`
- `capability_matrix_ref`
- `health_result_ref`
- `launch_evidence_ref`
- `fixture_ref`

约束：

- 本 FR 只能满足 `static_descriptor_ref`。
- `health_result_ref` 必须消费 `FR-0038`。
- `launch_evidence_ref` 必须消费 `FR-0040` 与 `FR-0041` 的 evidence / redaction 边界。
- slot 存在不表示对应 evidence 已生成、fresh 或通过。

### 11. Registry alignment

后续 registry consumer 若登记 `official-chrome.persistent`，必须：

- 使用 `provider_id=official-chrome.persistent`。
- 保持 `contract_snapshot` 满足 `FR-0033.browser_provider_contract.v1`。
- 将 persistent-specific fields 保留在 provider-specific descriptor carrier 中，不在 registry 私有字段复制第二套 shape。
- 对 `FR-0036.provider_class=official_chrome` 的消费保持 persistent extension 主路径语义，但不得把 registry entry 存在解释为 runtime ready。

约束：

- 本 FR 不创建 registry row，不实现 resolver，不设置 runtime default selection。
- `default_eligibility` 仍必须受 verification、limitations、health 与 evidence owners 约束。

## GWT 验收场景

### 场景 1：persistent descriptor 只增补 delta

Given `FR-0042` 已冻结 `official_chrome_descriptor` common shape
When reviewer 检查 `official-chrome.persistent`
Then persistent descriptor 必须保留 `common_shape_owner=#1137`
And 只能增补 persistent profile、extension binding、native messaging readiness 与 profile identity constraints
And 不得重写 common descriptor fields 的语义

### 场景 2：persistent identity 与 direct identity 分离

Given `official-chrome.direct` 已使用 `provider_id=official-chrome.direct`
When persistent descriptor 定义 provider identity
Then provider id 必须为 `official-chrome.persistent`
And 不得与 direct variant 共用 provider id

### 场景 3：persistent refs 不等于 runtime ready

Given persistent descriptor 声明 profile、extension 与 native messaging refs
When selection、health 或 launch consumer 判断能否执行
Then 必须继续消费 FR-0033/FR-0036/FR-0038/FR-0040/FR-0041 或对应 runtime facts
And 不得把 descriptor refs 解释为 ready/pass evidence

### 场景 4：health schema 不在本 FR 定义

Given `native_messaging_readiness_refs` 包含 `bridge_readiness_ref`
When reviewer 查找 health result payload
Then 本 FR 只能指向 readiness reference
And health result schema 必须由 M3-C health issues 消费 `FR-0038` 后定义

### 场景 5：launch evidence 不在本 FR 定义

Given evidence slots 包含 `launch_evidence_ref`
When reviewer 判断本 PR 是否需要 fresh live evidence
Then 该 slot 只能表示未来引用位置
And 本 PR 不要求 launch artifact、redaction record、fresh live evidence 或 runtime run

## 异常与边界场景

- descriptor 缺少 `common_shape_owner=#1137` 时，不得作为 `FR-0042` common shape 的 persistent delta 消费。
- `provider_id` 不是 `official-chrome.persistent` 时，不得作为 #1138 persistent descriptor 消费。
- persistent descriptor 使用 `extension_binding_support=none|unknown` 或 `profile_binding_support=none|unknown` 时，不得作为 persistent provider descriptor 消费。
- persistent descriptor 缺少 profile reference、extension binding 或 native messaging readiness refs 时，后续 consumer 必须 fail-closed。
- descriptor 出现 health result schema、launch evidence record、redaction shape、capability matrix rows、fixture payload、runtime implementation detail 或 live action proof 时，视为 scope violation。
- descriptor 内联 cookie、token、账号凭据、完整敏感本机路径或 native host secret 时，视为 profile identity / secret boundary violation。

## 验收标准

1. `FR-0043` 只定义 `official-chrome.persistent` persistent-specific descriptor delta，并明确消费 `FR-0042` common shape。
2. persistent provider identity、mode、engine、transport、profile reference、extension binding、native messaging refs 与 profile identity constraints 已冻结。
3. 本 suite 未定义 capability matrix、health schema、launch evidence、redaction shape、fresh live evidence、fixtures 或 runtime implementation。
4. registry alignment 只说明后续 consumer 如何引用 descriptor，不创建 registry row 或 runtime default selection。
5. spec map 已将 `FR-0043` 映射到 canonical issue `#1138`。
