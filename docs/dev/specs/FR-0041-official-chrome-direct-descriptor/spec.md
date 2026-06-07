# FR-0041 official-chrome.direct Descriptor

Canonical Issue: #1137

## 背景

`#1137` 属于 M3-B official Chrome descriptors，目标是在 `FR-0033 Browser Provider Contract` 与 `FR-0036 Provider Registry` 已关闭后，冻结 official Chrome provider descriptor 的共享形状，并落成 `official-chrome.direct` 变体。

父项 `#1113` 已明确：

- `#1137` owns common official Chrome descriptor shape plus the direct variant。
- `#1138` owns persistent descriptor delta。
- `#1139` owns capability semantics and consumes `FR-0035`。
- M3 health issues consume `FR-0038`，不得重新定义 health result schema。
- launch evidence 与 official Chrome fixtures 由后续 issue 承接。

因此本 FR 只冻结 provider-specific descriptor carrier：它把 `FR-0033.browser_provider_contract` 与 `FR-0036.browser_provider_registry_entry` 可消费的 official Chrome 字段收敛为稳定 descriptor shape，并为 direct launch variant 固定直接启动行为与限制。它不实现 runtime，不要求 fresh live evidence，不定义 persistent extension / native messaging 行为。

## 目标

1. 冻结 `official_chrome_descriptor` 的共享字段和 ownership。
2. 冻结 `official-chrome.direct` 变体的 provider identity、mode、engine、transport、profile semantics、capability declaration references、limitation references 与 evidence reference slots。
3. 明确 direct variant 只表达 direct-launch-specific behavior and limitations。
4. 为 `#1138/#1139` 提供可消费输入，避免后续事项重写 common descriptor shape。
5. 保持本 PR 为文档 / contract carrier，不进入 runtime implementation、fixtures、health schema、capability matrix 或 launch evidence。

## 非目标

- 不定义 `official-chrome.persistent` 的 extension、native messaging、service worker、profile lock 或 persistent-specific delta；这些属于 `#1138`。
- 不定义 capability matrix 的支持/不支持语义、验证等级矩阵或 action coverage；这些属于 `#1139` 并消费 `FR-0035`。
- 不定义 provider health / doctor result schema；health issues 只消费 `FR-0038`。
- 不定义 launch evidence、runtime attestation record、fresh live evidence 要求或 fixture；这些由后续 M3-D issue 承接。
- 不实现 provider registry parser、selection、doctor、runtime launch、CLI、extension、native host、Playwright 或测试 fixture。
- 不改变 `FR-0033` 与 `FR-0036` 已冻结的基础 contract / registry shape。
- 不引入 Syvert normalized result、跨仓共享业务 schema、CloakBrowser-as-core 或外部 provider patch schema。

## 功能需求

### 1. Descriptor 定位与 ownership

系统必须冻结一个稳定的 `official_chrome_descriptor` 对象。

约束：

- `official_chrome_descriptor` 是 official Chrome provider-specific descriptor carrier。
- 它必须可被后续 registry、selection、capability matrix、health、evidence 与 fixtures issue 引用。
- 它不得被解释为 runtime status、health result、launch evidence、live evidence record、fixture、browser process snapshot 或 Syvert mapping。
- `official_chrome_descriptor.common_shape_owner` 必须指向 `#1137` / `FR-0041`。
- 后续 `official-chrome.persistent` descriptor 只能增加 persistent-specific delta，不得重写 common shape。

### 2. 共享 descriptor shape

`official_chrome_descriptor` 必须至少包含：

- `descriptor_id`
- `descriptor_version`
- `common_shape_owner`
- `variant_kind`
- `provider_identity`
- `provider_mode`
- `engine`
- `transport`
- `profile_semantics`
- `capability_declaration_refs`
- `limitation_refs`
- `evidence_reference_slots`
- `downstream_owners`
- `out_of_scope`

约束：

- `descriptor_version` 当前冻结为 `v1`。
- `variant_kind` 当前至少冻结 `direct`；`persistent` 只能由 `#1138` 增补。
- `provider_identity` 必须能映射到 `FR-0033.provider_identity`。
- `provider_mode` 必须复用 `FR-0033.ProviderMode`，不得引入 provider 私有 mode。
- `engine` 必须能映射到 `FR-0033.browser_engine`，Google Chrome stable 必须使用 `Google Chrome stable` canonical label。
- `transport` 必须能映射到 `FR-0033.automation_transport`。
- `capability_declaration_refs` 只保存 capability declaration 的引用，不表达 capability matrix semantics。
- `limitation_refs` 只保存 limitation 引用和 owner，不替代 fail-closed 规则。
- `evidence_reference_slots` 只声明未来证据引用槽位，不定义证据 record shape、freshness 或通过条件。

### 3. Provider identity

`official-chrome.direct` 必须冻结以下 identity：

- `provider_id`: `official-chrome.direct`
- `provider_family`: `official_chrome`
- `provider_version`: `v1`
- `contract_version`: `v1`
- `distribution_channel`: `builtin`
- `implementation_owner`: `webenvoy_core`

约束：

- `provider_id` 是 WebEnvoy provider namespace 下的稳定 descriptor id，不得用 CLI flag、browser profile name 或 process name 代替。
- `official-chrome.direct` 与后续 `official-chrome.persistent` 必须是不同 provider descriptor；二者不得共享同一 provider id。
- identity 不证明 provider 已安装、已启动、已通过 doctor 或已产生 live evidence。

### 4. Direct variant mode 与 engine

`official-chrome.direct` 必须声明：

- `provider_mode`: `core_managed`
- `engine_family`: `chrome`
- `browser_channel`: `Google Chrome stable`
- `browser_version_range`: `system_installed`
- `headless_policy`: `forbidden`
- `extension_binding_support`: `none`
- `profile_binding_support`: `none`

约束：

- `system_installed` 表示 direct variant 依赖本机 branded Google Chrome stable，可由后续 runtime/doctor 验证，不表示本 PR 已验证安装状态。
- direct variant 必须默认 headful real browser 路线，不得用 headless 启动满足 official Chrome descriptor。
- `extension_binding_support=none` 与 `profile_binding_support=none` 只表达 direct variant 不承诺 persistent binding；不得据此定义 persistent extension / native messaging 的负面 schema。
- direct variant 不得被描述为 `FR-0015` persistent extension 主路径的替代实现。

### 5. Direct variant transport

`official-chrome.direct` 必须声明：

- `transport_kind`: `playwright`
- `transport_owner`: `webenvoy_core`
- `command_surface`: `runtime_control`, `page_automation`, `diagnostics`
- `attach_model`: `launch`
- `native_messaging_support`: `none`
- `cdp_support`: `supported`
- `playwright_support`: `supported`

约束：

- direct variant 只表达 WebEnvoy core 可直接 launch official Chrome 并通过 Playwright/CDP 编排页面自动化。
- `native_messaging_support=none` 不得扩展为 persistent provider 的 native messaging delta；该 delta 属于 `#1138`。
- transport 声明不得绕过“浏览器内执行是唯一 HTTP 出口”的架构红线。
- 本 FR 不定义 launch envelope、process lifecycle schema、runtime readiness schema 或 evidence artifact。

### 6. Profile semantics

`official-chrome.direct.profile_semantics` 必须至少包含：

- `profile_kind`: `ephemeral_direct_profile`
- `profile_persistence`: `not_guaranteed`
- `login_state_reuse`: `not_promised`
- `profile_locking`: `not_promised`
- `cleanup_expectation`: `best_effort_runtime_cleanup`
- `persistent_delta_owner`: `#1138`

约束：

- direct variant 不承诺恢复用户长期登录态。
- direct variant 不承诺跨 run profile persistence。
- direct variant 不定义 persistent profile path、extension id、native host id、service worker freshness 或 account safety health schema。
- 若后续实现需要真实 profile lock、extension identity 或 native messaging readiness，必须消费 `#1138` 与 health/evidence owner，而不是回写本 common shape。

### 7. Capability declaration references

`official-chrome.direct.capability_declaration_refs` 必须只表达引用：

- `FR-0033.browser_provider_contract.capabilities`
- `FR-0035.provider_capability_verification_model`
- `#1139 official Chrome Capability Matrix`

约束：

- 本 FR 不声明 direct variant 支持哪些业务 capability、action、layer 或 verification threshold。
- 本 FR 不把 `read/write/download/diagnose` 的支持关系写成 matrix。
- 后续 capability matrix 必须消费本 descriptor 的 identity/mode/engine/transport/profile semantics，但不得反向改写 common descriptor shape。

### 8. Limitation references

`official-chrome.direct.limitation_refs` 必须至少声明以下 direct-specific limitations：

- `direct_no_persistent_profile_guarantee`
- `direct_no_extension_binding`
- `direct_no_native_messaging`
- `direct_no_login_state_reuse_promise`
- `direct_no_latest_head_live_evidence`

约束：

- limitations 是 descriptor 边界说明，不是 capability fail-closed matrix。
- `direct_no_latest_head_live_evidence` 只说明本 PR 不产出 fresh live evidence；不得被解释为后续 direct runtime 永远不能产出 evidence。
- limitation refs 必须能被后续 #1139/#1140-#1144 消费，但其具体 matrix、health、evidence 或 fixture 判定由对应 owner 冻结。

### 9. Evidence reference slots

`official-chrome.direct.evidence_reference_slots` 必须只声明以下槽位：

- `static_descriptor_ref`
- `registry_entry_ref`
- `capability_matrix_ref`
- `health_result_ref`
- `launch_evidence_ref`
- `fixture_ref`

约束：

- 本 FR 只能填充 `static_descriptor_ref` 与未来 registry alignment 所需的静态引用语义。
- `capability_matrix_ref` 由 `#1139` 填充。
- `health_result_ref` 由 M3-C health issues 填充，并消费 `FR-0038`。
- `launch_evidence_ref` 由 M3-D launch evidence issue 填充。
- `fixture_ref` 由 official Chrome fixtures issue 填充。
- 槽位存在不表示对应证据已生成、已通过或 fresh。

### 10. Registry alignment

后续 registry consumer 若登记 `official-chrome.direct`，必须：

- 使用 `provider_id=official-chrome.direct`。
- 使用 `provider_class=official_chrome`。
- 使用 `contract_snapshot` 表达 `FR-0033.browser_provider_contract.v1` 可消费字段。
- 保持 direct-specific descriptor fields 作为 provider-specific descriptor carrier，不在 registry 私有字段中复制第二套 shape。

约束：

- registry entry 的 `default_eligibility` 不得被本 FR 预设为 runtime ready。
- 本 FR 不创建 fixture，不登记实际 registry row，不实现 resolver。

## GWT 验收场景

### 场景 1：direct descriptor 只冻结 common shape 与 direct variant

Given `official-chrome.direct` descriptor 已定义
When reviewer 检查 descriptor fields
Then descriptor 必须包含 common official Chrome shape 的 identity、mode、engine、transport、profile semantics、capability refs、limitation refs 与 evidence slots
And 不得包含 persistent extension / native messaging / service worker delta

### 场景 2：capability matrix 不能在 #1137 中提前定义

Given `official-chrome.direct.capability_declaration_refs` 指向 `#1139`
When 后续 capability matrix issue 消费 direct descriptor
Then #1139 可以读取 descriptor identity/mode/engine/transport/profile semantics
And #1137 不得提前声明 direct variant 的 supported action matrix 或 verification threshold

### 场景 3：evidence slots 不等于 launch evidence

Given `official-chrome.direct.evidence_reference_slots` 包含 `launch_evidence_ref`
When reviewer 判断本 PR 是否需要 fresh live evidence
Then 该 slot 只能表示未来引用位置
And 本 PR 不要求 fresh live evidence、launch artifact 或 fixture

### 场景 4：direct profile semantics 不承诺 persistent behavior

Given direct descriptor 的 `profile_kind=ephemeral_direct_profile`
When 后续 persistent descriptor issue 定义 persistent profile behavior
Then persistent issue 必须只添加 persistent-specific delta
And 不得修改 #1137 冻结的 common descriptor shape

### 场景 5：registry consumer 不得把 descriptor 当成 runtime ready

Given registry entry 后续引用 `official-chrome.direct`
And descriptor 声明 `provider_mode=core_managed`
When selection 或 runtime admission 判断是否可执行业务命令
Then 必须继续消费 FR-0033/FR-0036/FR-0035/FR-0038 或对应 runtime evidence
And 不得把 descriptor 存在本身解释为 runtime ready

## 异常与边界场景

- descriptor 缺少 `common_shape_owner=#1137` 时，后续 persistent descriptor 不得消费它作为 shared shape。
- `variant_kind` 不是 `direct` 且不由后续 owner 明确冻结时，consumer 必须 fail-closed。
- `provider_id` 与 `official-chrome.direct` 不一致时，不得作为 #1137 direct variant 消费。
- `browser_channel` 未使用 `Google Chrome stable` 时，不得作为 official Chrome stable direct descriptor 消费。
- direct descriptor 出现 extension id、native host id、persistent profile path、service worker freshness、health result schema、capability matrix rows、launch artifact 或 fixture payload 时，视为 scope violation。

## 验收标准

1. `official_chrome_descriptor` common shape 已冻结，且 owner 明确为 `#1137` / `FR-0041`。
2. `official-chrome.direct` 的 identity、mode、engine、transport、profile semantics、capability refs、limitation refs 与 evidence slots 已冻结。
3. direct-specific limitations 只覆盖 direct launch 边界，不定义 persistent-specific delta。
4. 本 suite 不定义 capability matrix、health schema、launch evidence、fresh live evidence 或 fixtures。
5. spec map 已将 `FR-0041` 映射到 canonical issue `#1137`。
