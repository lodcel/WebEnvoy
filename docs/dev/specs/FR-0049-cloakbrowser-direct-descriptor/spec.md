# FR-0049 cloakbrowser.direct Descriptor

Canonical Issue: #1146

## 背景

`#1146` 属于 M10 CloakBrowser lane，目标是在 `FR-0033 Browser Provider Contract`、`FR-0036 Provider Registry` 与 `FR-0037 Launch Envelope Extraction` 已存在后，冻结 `cloakbrowser.direct` descriptor 的静态输入。父项 `#1114` 已明确 CloakBrowser 是可选 Browser Provider surface：

- CloakBrowser 不是 WebEnvoy core。
- CloakBrowser 不输出 Syvert normalized result。
- CloakBrowser 不承接 XHS business semantics。
- `#1146/#1147/#1148` 可分别冻结 direct、persistent 与 cloakserve descriptor 输入。
- `#1149` 后续消费三个 descriptor 输入，比较 profile、extension、native messaging、final args 与 fingerprint seed evidence。

因此本 FR 只冻结 `cloakbrowser.direct` descriptor carrier：它把 `FR-0033.browser_provider_contract`、`FR-0036.browser_provider_registry_entry` 与 `FR-0037.launch_envelope` 可消费的 direct CloakBrowser 字段收敛为稳定静态输入，并固定 extension path handling、final args evidence limits、provider contract references 与 limitation boundary。它不实现 runtime，不声明 fresh live evidence，不定义 persistent / cloakserve delta，不暴露 CloakBrowser 私有 patch schema。

## 目标

1. 冻结 `cloakbrowser_descriptor` 的 direct variant 字段和 ownership。
2. 冻结 `cloakbrowser.direct` 的 provider identity、mode、engine、transport、profile semantics、extension path handling、final args evidence slots、capability declaration references 与 limitation refs。
3. 明确 direct variant 只表达 direct-launch-specific behavior and limitations。
4. 为 `#1149 CloakBrowser Capability Matrix` 提供可消费的 descriptor facts。
5. 保持本 PR 为 docs / spec / descriptor carrier，不进入 runtime implementation、fixtures、health schema、capability matrix、launch evidence 或 live action。

## 非目标

- 不定义 `cloakbrowser.persistent` 的 persistent profile、extension identity、native messaging readiness、profile lock 或 account safety delta；这些属于 `#1147`。
- 不定义 `cloakbrowser.cloakserve` 的 service / broker / remote attach / health delta；这些属于 `#1148`。
- 不定义 CloakBrowser capability matrix support rows、verification thresholds 或 action coverage；这些属于 `#1149` 并消费 `FR-0035`。
- 不定义 provider health / doctor result schema；后续 health issue 必须消费 `FR-0038`。
- 不定义 launch evidence record、runtime attestation record、redaction shape、fixture payload 或 fresh live evidence。
- 不实现 provider registry parser、selection、doctor、runtime launch、extension install、native messaging、Playwright、CLI、fixtures 或 tests。
- 不把 CloakBrowser 设为 WebEnvoy core、默认 provider、browser patching 主路径或 Syvert provider adapter。
- 不冻结 CloakBrowser 私有 stealth patch、driver 内部状态、账号策略、指纹种子值或浏览器 patch schema。
- 不改变 official Chrome direct / persistent / health / launch evidence / service worker behavior。

## 功能需求

### 1. Descriptor 定位与 ownership

系统必须冻结一个稳定的 `cloakbrowser_descriptor` direct variant。

约束：

- `cloakbrowser_descriptor` 是 CloakBrowser provider-specific descriptor carrier。
- `descriptor_id` 当前固定为 `cloakbrowser.direct`。
- `descriptor_version` 当前冻结为 `v1`。
- `variant_kind` 当前本 suite 只落成 `direct`。
- `common_shape_owner` 必须指向 `#1146` / `FR-0049`。
- descriptor 必须可被后续 registry、selection、capability matrix、health、evidence 与 fixture issue 引用。
- descriptor 不得被解释为 runtime status、health result、launch evidence、live evidence record、fixture、browser process snapshot、CloakBrowser private patch manifest 或 Syvert mapping。
- 后续 `cloakbrowser.persistent` 与 `cloakbrowser.cloakserve` 只能增加各自 variant delta，不得重写本 direct descriptor 的字段语义。

### 2. 共享 direct descriptor shape

`cloakbrowser_descriptor` 必须至少包含：

- `descriptor_id`
- `descriptor_version`
- `common_shape_owner`
- `variant_kind`
- `provider_identity`
- `provider_mode`
- `engine`
- `transport`
- `profile_semantics`
- `extension_path_handling`
- `final_args_evidence`
- `fingerprint_seed_boundary`
- `capability_declaration_refs`
- `limitation_refs`
- `evidence_reference_slots`
- `downstream_owners`
- `out_of_scope`

约束：

- `provider_identity` 必须能映射到 `FR-0033.provider_identity`。
- `provider_mode` 必须复用 `FR-0033.ProviderMode`。
- `engine` 必须能映射到 `FR-0033.browser_engine`。
- `transport` 必须能映射到 `FR-0033.automation_transport`。
- `extension_path_handling` 只能描述 Launch Envelope 如何传入 extension asset locators；不得内联本机敏感路径、extension secret、runtime bootstrap secret 或 extension id pass result。
- `final_args_evidence` 只能声明未来 redacted final args snapshot 的引用槽位与披露限制；不得把 final args snapshot 解释为 browser honored、runtime ready、anti-detection pass 或 live evidence。
- `fingerprint_seed_boundary` 只能声明 seed policy ownership 与 redaction rule；不得暴露具体 seed 值或 provider private patch schema。
- `capability_declaration_refs` 只保存 capability declaration 的引用，不表达 capability matrix semantics。
- `limitation_refs` 只保存 limitation 引用和 owner，不替代 fail-closed 规则。
- `evidence_reference_slots` 只声明未来证据引用槽位，不定义证据 record shape、freshness 或通过条件。

### 3. Provider identity

`cloakbrowser.direct` 必须冻结以下 identity：

- `provider_id`: `cloakbrowser.direct`
- `provider_family`: `managed_browser_provider`
- `provider_version`: `v1`
- `contract_version`: `v1`
- `distribution_channel`: `external_adapter`
- `implementation_owner`: `cloakbrowser_provider_adapter`

约束：

- `provider_id` 是 WebEnvoy provider namespace 下的稳定 descriptor id，不得用 binary path、CLI flag、profile name、process name 或 external product display name 代替。
- `provider_family=managed_browser_provider` 只表示该 provider 由外部 managed browser capability 承载；它不把 CloakBrowser 变成 WebEnvoy core。
- `distribution_channel=external_adapter` 表示需要外部 adapter / provider installation fact；本 FR 不证明 adapter 已安装或可运行。
- `implementation_owner` 只表达责任边界，不授予 provider 修改 WebEnvoy core contract 的权威。
- identity 不证明 provider 已安装、已授权、已启动、已通过 doctor 或已产生 live evidence。

### 4. Direct variant mode 与 engine

`cloakbrowser.direct` 必须声明：

- `provider_mode`: `core_managed`
- `engine_family`: `chromium`
- `browser_channel`: `CloakBrowser managed Chromium`
- `browser_version_range`: `provider_managed`
- `headless_policy`: `forbidden`
- `extension_binding_support`: `supported`
- `profile_binding_support`: `none`

约束：

- `core_managed` 只表示 WebEnvoy 后续 direct adapter 可以发起本地 provider launch / connect 编排；它不表示 CloakBrowser 是 WebEnvoy core。
- `provider_managed` 表示 browser version 由 CloakBrowser provider / adapter 证明；本 PR 不验证版本、安装状态或 runtime readiness。
- direct variant 必须默认 headful real browser 路线，不得用 headless launch 满足 real-browser 或 live evidence gate。
- `extension_binding_support=supported` 表示 direct launch 可消费 extension path locator 并把其作为 launch input；它不承诺 stable extension id、persistent profile extension 或 service worker freshness。
- `profile_binding_support=none` 表示 direct variant 不承诺 persistent profile binding；persistent profile semantics 属于 `#1147`。

### 5. Direct variant transport

`cloakbrowser.direct` 必须声明：

- `transport_kind`: `hybrid`
- `transport_owner`: `provider`
- `command_surface`: `runtime_control`, `page_automation`, `diagnostics`, `artifact_passthrough`
- `attach_model`: `launch`
- `native_messaging_support`: `none`
- `cdp_support`: `supported`
- `playwright_support`: `supported`

约束：

- `hybrid` 只表达 provider-managed launch + WebEnvoy adapter / Playwright / CDP orchestration。
- `transport_owner=provider` 表示 final browser process and patch behavior 由 CloakBrowser provider / adapter 持有；WebEnvoy 只能消费其 contract 和证据。
- `native_messaging_support=none` 不得扩展为 persistent provider 的 Native Messaging delta；该 delta 属于 `#1147`。
- transport 声明不得绕过“浏览器内执行是唯一 HTTP 出口”的架构红线。
- 本 FR 不定义 launch envelope instance、process lifecycle schema、runtime readiness schema、provider broker protocol 或 evidence artifact。

### 6. Profile semantics

`cloakbrowser.direct.profile_semantics` 必须至少包含：

- `profile_kind`: `ephemeral_provider_profile`
- `profile_persistence`: `not_guaranteed`
- `login_state_reuse`: `not_promised`
- `profile_locking`: `not_promised`
- `cleanup_expectation`: `provider_managed_best_effort_cleanup`
- `persistent_delta_owner`: `#1147`

约束：

- direct variant 不承诺恢复用户长期登录态。
- direct variant 不承诺跨 run profile persistence。
- direct variant 不定义 persistent profile path、profile lock、account safety health、extension identity 或 native host binding。
- 若后续实现需要真实 profile lock、persistent profile identity 或 login state readiness，必须消费 `#1147` 与对应 health / evidence owner，而不是回写本 direct descriptor。

### 7. Extension path handling

`cloakbrowser.direct.extension_path_handling` 必须至少包含：

- `extension_input_source`: `FR-0037.launch_envelope.runtime_bindings.extension_paths`
- `extension_binding_mode`: `dev_unpacked_extension`
- `accepted_locator_kinds`: `extension_asset_ref`, `workspace_artifact_ref`
- `path_materialization_owner`: `launch_admission_or_adapter`
- `path_redaction_policy`: `redacted_locator_only`
- `stable_extension_identity`: `not_promised`

约束：

- extension paths 必须来自 Launch Envelope 的 `extension_paths` locator；descriptor 不得自行定义第二套 extension path schema。
- extension paths 只允许引用扩展资产 locator，不得承载 run/session secret、Cookie、token、proxy credential、fingerprint seed 或 full local sensitive path。
- adapter 可在 launch-time materialize locator 为本机路径，但 materialized path 不得作为 descriptor static field 落库。
- final args evidence 只能披露 redacted locator、path hash、basename 或 allowlisted arg key；不得披露完整本机路径或 private extension content。
- `stable_extension_identity=not_promised` 表示 direct descriptor 不证明 extension id、service worker freshness、Native Messaging allowed origins 或 persistent install source。
- `dev_unpacked_extension` 在本 FR 中只适用于 CloakBrowser direct optional provider，不改变 official Chrome persistent extension 主路径。

### 8. Final args evidence limits

`cloakbrowser.direct.final_args_evidence` 必须至少包含：

- `evidence_kind`: `redacted_final_args_snapshot`
- `evidence_owner`: `future_launch_evidence_owner`
- `freshness_requirement`: `current_launch_when_required`
- `allowed_disclosure`: `arg_keys`, `redacted_values`, `extension_locator_refs`, `path_hashes`, `provider_contract_ref`, `launch_envelope_ref`
- `forbidden_disclosure`: `full_local_paths`, `cookies`, `tokens`, `proxy_credentials`, `fingerprint_seed_values`, `private_patch_payload`, `page_content`
- `proves`: `launch_input_shape_only`
- `does_not_prove`: `browser_honored_args`, `runtime_ready`, `health_pass`, `anti_detection_pass`, `live_evidence_attested`

约束：

- final args evidence slot 只说明未来 launch evidence owner 可以产出 redacted snapshot。
- final args snapshot 不等于 launch success、runtime attestation、doctor pass、anti-detection validation、fresh live evidence 或 capability allow。
- 若 consumer 需要当前 launch evidence，必须由后续 launch evidence owner 按 `FR-0040` / `FR-0041` / `FR-0037` 提供 accepted artifact；本 descriptor 不能替代。
- unknown、missing、unredacted 或 stale final args evidence 在影响目标 capability 时必须 fail-closed。

### 9. Fingerprint seed boundary

`cloakbrowser.direct.fingerprint_seed_boundary` 必须至少包含：

- `seed_policy`: `provider_managed`
- `seed_ref_policy`: `redacted_locator_only`
- `patch_manifest_ref_policy`: `provider_private_ref_only`
- `rotation_policy`: `provider_managed`
- `disclosure_boundary`: `no_seed_values_no_private_patch_schema`

约束：

- `provider_managed` 只表示 fingerprint seed / patch 由 CloakBrowser provider 管理；它不证明 seed 已正确应用。
- descriptor 可引用 redacted locator 或 provider private ref，但不得展开 private patch schema、seed values、stealth parameters 或 driver internal state。
- 任何 fingerprint consistency、anti-detection baseline 或 behavior validation 必须消费 `FR-0020` 或后续 CloakBrowser-specific validation owner。
- seed policy 为 unknown、raw seed 泄露或 private patch payload 进入 descriptor / PR metadata 时必须阻断。

### 10. Capability declaration references

`cloakbrowser.direct.capability_declaration_refs` 必须只表达引用：

- `FR-0033.browser_provider_contract.capabilities`
- `FR-0035.provider_capability_verification_model`
- `#1149 CloakBrowser Capability Matrix`

约束：

- 本 FR 不声明 direct variant 支持哪些 business capability、action、layer 或 verification threshold。
- 本 FR 不把 `read/write/download/diagnose` 的支持关系写成 matrix。
- `#1149` 可以读取 descriptor identity/mode/engine/transport/profile/extension/final-args/fingerprint semantics。
- `#1149` 不得反向改写本 descriptor shape 或把 descriptor 存在解释为 runtime ready。

### 11. Limitation references

`cloakbrowser.direct.limitation_refs` 必须至少声明以下 direct-specific limitations：

- `direct_no_persistent_profile_guarantee`
- `direct_no_login_state_reuse_promise`
- `direct_extension_paths_are_locator_only`
- `direct_no_stable_extension_identity`
- `direct_no_native_messaging`
- `direct_final_args_evidence_redacted_only`
- `direct_no_descriptor_level_runtime_readiness`
- `direct_no_latest_head_live_evidence`
- `direct_provider_private_patch_not_core_contract`
- `direct_fingerprint_seed_not_disclosed`

约束：

- limitation refs 是 descriptor 边界说明，不是 capability fail-closed matrix。
- `direct_no_latest_head_live_evidence` 只说明本 PR 不产出 fresh live evidence；不得被解释为后续 direct runtime 永远不能产出 evidence。
- `direct_provider_private_patch_not_core_contract` 只说明 provider 可能依赖私有能力；不得把私有 patch 细节提升为 WebEnvoy core contract。
- limitation refs 必须能被 `#1149` 消费，但其具体 matrix、health、evidence 或 fixture 判定由对应 owner 冻结。

### 12. Evidence reference slots

`cloakbrowser.direct.evidence_reference_slots` 必须只声明以下槽位：

- `static_descriptor_ref`
- `registry_entry_ref`
- `capability_matrix_ref`
- `health_result_ref`
- `launch_evidence_ref`
- `final_args_evidence_ref`
- `fixture_ref`

约束：

- 本 FR 只能填充 `static_descriptor_ref`。
- `registry_entry_ref` 等待 registry consumer 或后续 implementation owner 填充。
- `capability_matrix_ref` 由 `#1149` 填充。
- `health_result_ref` 由后续 CloakBrowser health owner 填充，并消费 `FR-0038`。
- `launch_evidence_ref` 与 `final_args_evidence_ref` 由后续 launch evidence owner 填充，并消费 `FR-0037`、`FR-0040` 与 `FR-0041`。
- `fixture_ref` 由后续 fixture owner 填充。
- 槽位存在不表示对应证据已生成、已通过或 fresh。

### 13. Registry alignment

后续 registry consumer 若登记 `cloakbrowser.direct`，必须：

- 使用 `provider_id=cloakbrowser.direct`。
- 使用 `provider_class=cloakbrowser_managed` 或后续 CloakBrowser-specific class owner 明确冻结的等价值。
- 使用 `contract_snapshot` 表达 `FR-0033.browser_provider_contract.v1` 可消费字段。
- 保持 direct-specific descriptor fields 作为 provider-specific descriptor carrier，不在 registry 私有字段中复制第二套 shape。
- 维持 `requires_opt_in=true`，直到后续 selection / health / evidence owner 明确冻结更窄的默认 eligibility 规则。

约束：

- 本 FR 不创建 fixture，不登记实际 registry row，不实现 resolver，不设置 runtime default selection。
- registry entry 的 `default_eligibility` 不得被本 FR 预设为 runtime ready。
- registry / selection 不得把 CloakBrowser 设为 WebEnvoy core 或默认 provider。

## GWT 验收场景

### 场景 1：direct descriptor 冻结 direct launch 输入

Given `cloakbrowser.direct` descriptor 已定义
When reviewer 检查 descriptor fields
Then descriptor 必须包含 identity、mode、engine、transport、profile semantics、extension path handling、final args evidence limits、fingerprint seed boundary、capability refs、limitation refs 与 evidence slots
And 不得包含 persistent profile lock、Native Messaging readiness、cloakserve broker protocol、health schema、capability matrix rows、launch artifact、fixture payload 或 runtime implementation

### 场景 2：extension paths 只能来自 Launch Envelope locator

Given `cloakbrowser.direct.extension_path_handling.extension_input_source=FR-0037.launch_envelope.runtime_bindings.extension_paths`
When 后续 launch consumer materialize extension paths
Then consumer 必须只消费 redacted locator 或 artifact ref
And 不得把 full local path、run/session secret、Cookie、token、proxy credential 或 fingerprint seed 写入 descriptor / PR metadata

### 场景 3：final args evidence 不等于 runtime ready

Given `cloakbrowser.direct.final_args_evidence.evidence_kind=redacted_final_args_snapshot`
When reviewer 判断本 PR 是否提供 launch evidence
Then 该 slot 只能表示未来 redacted evidence 位置
And 本 PR 不要求 launch artifact、runtime attestation、anti-detection validation、fresh live evidence 或 final args fixture

### 场景 4：provider private patch 不进入 WebEnvoy core contract

Given `cloakbrowser.direct.fingerprint_seed_boundary.seed_policy=provider_managed`
When descriptor 引用 provider patch 或 fingerprint seed policy
Then descriptor 只能保留 redacted locator / private ref
And 不得展开 seed value、stealth parameter、driver internal state 或 private patch schema

### 场景 5：capability matrix 不能在 #1146 中提前定义

Given `cloakbrowser.direct.capability_declaration_refs` 指向 `#1149`
When 后续 capability matrix issue 消费 direct descriptor
Then #1149 可以读取 descriptor facts
And #1146 不得提前声明 direct variant 的 supported action matrix、support level 或 verification threshold

### 场景 6：registry consumer 不得把 descriptor 当成 default provider

Given registry entry 后续引用 `cloakbrowser.direct`
And descriptor 声明 `provider_family=managed_browser_provider`
When selection 或 runtime admission 判断是否可执行业务命令
Then 必须继续消费 FR-0033/FR-0036/FR-0035/FR-0038/FR-0040/FR-0041 或对应 runtime evidence
And 不得把 descriptor 存在本身解释为 runtime ready、default eligible 或 live evidence attested

## 异常与边界场景

- descriptor 缺少 `common_shape_owner=#1146` 时，不得作为 #1146 direct variant 消费。
- `provider_id` 与 `cloakbrowser.direct` 不一致时，不得作为 #1146 direct descriptor 消费。
- direct descriptor 使用 `profile_binding_support=required`、persistent profile path、profile lock schema 或 login state ready result 时，视为 scope violation。
- direct descriptor 使用 `native_messaging_support=required|supported` 或写入 native host manifest / allowed origins 时，视为 scope violation；该范围属于 persistent / future owner。
- extension path handling 出现 full local sensitive path、run/session secret、extension private content 或 stable extension id pass result 时，必须阻断。
- final args evidence 出现 full local path、Cookie、token、proxy credential、fingerprint seed value、private patch payload、page content 或未脱敏 provider secret 时，必须阻断。
- descriptor 使用 `runtime_attested`、`runtime_observed` 或 `live_evidence_attested` 但没有对应 accepted evidence owner 时，必须阻断。
- descriptor 把 CloakBrowser 设为 WebEnvoy core、默认 provider、official Chrome 替代主路径、Syvert normalized mapping 或 XHS business semantics 时，视为 scope violation。

## 验收标准

1. `FR-0049` 只定义 `cloakbrowser.direct` descriptor，并映射 canonical issue `#1146`。
2. `cloakbrowser.direct` 的 identity、mode、engine、transport、profile semantics、extension path handling、final args evidence limits、fingerprint seed boundary、capability refs、limitation refs 与 evidence slots 已冻结。
3. Descriptor facts 已足够让 `#1149` 消费 direct variant 输入。
4. 本 suite 不定义 persistent / cloakserve delta、capability matrix、health schema、launch evidence、fresh live evidence、fixtures 或 runtime implementation。
5. 本 suite 不把 CloakBrowser 设为 WebEnvoy core、默认 provider、browser patching 主路径、Syvert adapter 或 XHS semantics owner。
