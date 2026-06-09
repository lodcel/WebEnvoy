# FR-0050 cloakbrowser.persistent Descriptor

Canonical Issue: #1147

## 背景

`#1147` 属于 `#1114 CloakBrowser Provider` 的 M10 descriptor lane，目标是在 capability matrix 与 health work items 进入消费前，冻结 `cloakbrowser.persistent` 的 provider descriptor delta。

上游 `FR-0033 Browser Provider Contract` 已冻结 provider identity、mode、engine、transport、capability、verification 与 limitation 的基础对象；`FR-0036 Provider Registry` 已允许登记 `cloakbrowser_managed` class，但明确不得暴露 CloakBrowser 私有 patch schema；`FR-0038 Provider Health / Doctor Contract` 已冻结 provider health / doctor report 的共享 carrier。

本 FR 只定义 `cloakbrowser.persistent` 的静态 descriptor：persistent CloakBrowser profile、extension workflow capability references、health requirement inputs、provider contract references，以及与 `#1146 cloakbrowser.direct Descriptor` 的差异边界。它不实现 health gate、native messaging doctor、extension capability gate、CloakBrowser runtime、XHS、Syvert 或 browser patch 行为。

`#1147` 的 issue meta 声明 `Close Semantics: work-item-complete`，且 scope 是 “Describe persistent CloakBrowser profile and extension workflow capabilities and health requirements”。因此本 formal suite 合入后只关闭 persistent descriptor freeze；capability matrix、health checks、fixtures、runtime implementation 与 live evidence 由后续 issue 承接。

## 目标

1. 冻结 `cloakbrowser.persistent` provider identity、mode、engine 与 transport descriptor。
2. 定义 persistent CloakBrowser profile reference、profile identity constraints 与 profile lifecycle expectations。
3. 定义 extension workflow capability references，覆盖 extension bridge、persistent profile extension、workflow attachment 与 artifact passthrough 的静态输入。
4. 定义 health requirement inputs，使 `#1149` capability matrix 与后续 health issues 可消费，但不定义 health result schema。
5. 明确 `cloakbrowser.persistent` 与 `cloakbrowser.direct` 的差异边界，避免 direct launch / final args evidence 与 persistent profile / extension workflow 混写。

## 非目标

- 不实现 provider registry parser、selection、doctor、runtime launch、extension install、native messaging bridge、Playwright、CLI、fixtures 或测试代码。
- 不定义 health / doctor result schema；后续 health issues 必须消费 `FR-0038`。
- 不定义 capability matrix rows、support levels、verification thresholds 或 action coverage；这些属于 `#1149`。
- 不定义 launch evidence、runtime attestation、fresh live evidence、redaction shape 或 artifact payload。
- 不把 CloakBrowser 私有 stealth patch、browser patch 参数、driver 内部状态、license token、账号策略或 provider broker credential 写进 WebEnvoy core contract。
- 不推进 `#1146 cloakbrowser.direct Descriptor`、`#1148 cloakbrowser.cloakserve Descriptor`、XHS、Syvert normalized result、official-chrome service worker 行为、default live_write 或 runtime/live actions。

## 功能需求

### 1. Descriptor 定位与 ownership

系统必须冻结一个稳定的 `cloakbrowser_persistent_descriptor` 对象。

约束：

- `cloakbrowser_persistent_descriptor` 是 CloakBrowser persistent variant 的 provider-specific descriptor carrier。
- 该对象必须可被后续 registry、capability matrix、health、evidence 与 fixtures issue 引用。
- 该对象不得被解释为 runtime status、health result、launch evidence、live evidence record、fixture、browser process snapshot、Syvert mapping 或 CloakBrowser 私有 patch manifest。
- 本 FR 只拥有 `cloakbrowser.persistent` 的 persistent descriptor delta，不拥有 direct、cloakserve、capability matrix、health result 或 runtime implementation。

### 2. Provider identity

`cloakbrowser.persistent` 必须冻结以下 identity：

- `provider_id`: `cloakbrowser.persistent`
- `provider_family`: `managed_browser_provider`
- `provider_version`: `v1`
- `contract_version`: `v1`
- `distribution_channel`: `external_adapter`
- `implementation_owner`: `cloakbrowser_provider_adapter`

约束：

- `provider_id` 是 WebEnvoy provider namespace 下的稳定 descriptor id，不得使用 browser profile name、CloakBrowser UI display name、license name 或 process name 代替。
- `provider_identity` 必须可映射到 `FR-0033.BrowserProviderIdentity`。
- identity 不证明 CloakBrowser 已安装、profile 已绑定、extension workflow 已启用、provider broker 可达、doctor 已通过或 live evidence 已生成。
- CloakBrowser license、workspace、account、broker credential 与 private provider state 不得进入 identity。

### 3. Persistent mode 与 engine descriptor

`cloakbrowser.persistent` 必须声明：

- `provider_mode`: `external_managed`
- `engine_family`: `chromium`
- `browser_channel`: `CloakBrowser managed Chromium`
- `browser_version_range`: `provider_managed`
- `headless_policy`: `forbidden`
- `extension_binding_support`: `required`
- `profile_binding_support`: `required`

约束：

- `external_managed` 表示 CloakBrowser 或其 provider adapter 持有 browser lifecycle，WebEnvoy 只消费 brokered / attachable execution surface。
- `provider_managed` 只表达 browser binary 与 version 由 CloakBrowser provider 管理，不表示 WebEnvoy 已验证版本、patch 或 channel。
- persistent descriptor 必须保持 headed real browser route；不得用 headless、Chrome for Testing、official Chrome direct launch 或 unmanaged Chromium fallback 替代。
- `required` 只表达 persistent provider 的执行前置需要 profile / extension binding；不得写成 binding 已 ready。
- CloakBrowser private patch presence 只能以 limitation / health input 表达，不得展开 patch schema。

### 4. Persistent transport descriptor

`cloakbrowser.persistent` 必须声明：

- `transport_kind`: `hybrid`
- `transport_owner`: `provider`
- `command_surface`: `runtime_control`, `page_automation`, `diagnostics`, `artifact_passthrough`
- `attach_model`: `provider_brokered`
- `native_messaging_support`: `required`
- `cdp_support`: `supported`
- `playwright_support`: `supported`

约束：

- `hybrid` 表示 persistent variant 可能同时消费 CloakBrowser broker / extension bridge / native messaging / CDP 或 Playwright 编排输入。
- `provider_brokered` 表示 WebEnvoy 不直接拥有 browser lifecycle，后续 runtime admission 必须验证 broker attachment、selected profile 与 target context。
- native messaging readiness 必须以 health requirement input 表达，不得在 descriptor 中定义 doctor payload 或 message envelope。
- transport 声明不得绕过“浏览器内执行是唯一 HTTP 出口”的架构红线。

### 5. Persistent profile reference

`cloakbrowser.persistent.profile_semantics` 必须至少包含：

- `profile_kind`: `cloakbrowser_persistent_profile`
- `profile_persistence`: `required`
- `login_state_reuse`: `expected_when_profile_ready`
- `profile_locking`: `required`
- `cleanup_expectation`: `preserve_profile_state`
- `profile_reference`: `CloakBrowserPersistentProfileReference`
- `profile_identity_constraints`: `CloakBrowserProfileIdentityConstraint[]`

约束：

- `profile_reference` 是逻辑引用，不得内联 cookie、token、账号凭据、license secret、完整本机敏感路径或 provider broker credential。
- `profile_reference` 必须能表达 profile namespace、profile locator ref、provider workspace ref 与 selected profile identity ref，但这些值必须使用 redacted / opaque / report-local locator。
- profile readiness、lock ownership、stale lock、concurrent use、account safety、login state 与 provider workspace availability 必须由 health / runtime owner 判定；descriptor 只能声明 required references。
- `login_state_reuse=expected_when_profile_ready` 不等于登录态已存在、账号可用或目标站点会话安全。
- cleanup expectation 表示 persistent provider 不应按 direct ephemeral cleanup 处理 profile，不定义具体 cleanup implementation。

### 6. Extension workflow capability references

`cloakbrowser.persistent.extension_workflow` 必须至少包含：

- `workflow_kind`: `persistent_profile_extension_workflow`
- `extension_binding_kind`: `provider_managed_persistent_extension`
- `extension_identity_ref`
- `extension_installation_ref`
- `extension_runtime_ref`
- `workflow_capability_refs`
- `native_bridge_ref`
- `artifact_passthrough_ref`

约束：

- `workflow_capability_refs` 只引用后续 capability matrix 或 provider contract capability rows，不在本 FR 声明 business action support matrix。
- extension identity、installation、runtime、native bridge 与 artifact passthrough 都是 static reference slots 或 health inputs，不是 ready/pass 结果。
- 本 FR 不定义 extension install procedure、allowed origins、manifest schema、service worker freshness、runtime message freshness、workflow command envelope 或 artifact payload。
- extension workflow 不得把 CloakBrowser 私有 automation script、stealth patch setting、driver internal state 或 account operation strategy 写进 WebEnvoy core descriptor。

### 7. Health requirement inputs

`cloakbrowser.persistent.health_requirement_inputs` 必须至少声明以下 inputs：

- `expected_binary_source_ref`
- `provider_broker_ref`
- `profile_binding_ref`
- `extension_binding_ref`
- `native_messaging_ref`
- `display_mode_ref`
- `provider_private_patch_presence_ref`
- `capability_readiness_ref`

约束：

- health requirement inputs 必须消费 `FR-0038.provider_doctor_report`，不得新增 parallel health result object。
- `expected_binary_source_ref` 是 FR-0038 doctor/admission input，不来自 provider identity，也不得内联 raw path 或 secret。
- `provider_private_patch_presence_ref` 只能要求后续 health owner 证明 provider-managed route 与 declared limitation 一致，不得公开 patch fields。
- required health check 缺失、unknown、fail 或 evidence redaction invalid 时，后续 admission 必须 fail-closed。
- doctor pass 最高只能把 provider/capability 推进到 `doctor_checked`；不得自证 runtime ready、target tab ready 或 live evidence ready。

### 8. Capability declaration references

`cloakbrowser.persistent.capability_declaration_refs` 必须只表达引用：

- `FR-0033.browser_provider_contract.capabilities`
- `FR-0035.provider_capability_verification_model`
- `FR-0038.provider_doctor_report`
- `#1149 CloakBrowser Capability Matrix`

约束：

- 本 FR 不声明 persistent variant 支持哪些 business capability、action、layer 或 verification threshold。
- #1149 可以消费 persistent descriptor 的 identity/mode/engine/transport/profile/extension workflow/health inputs。
- #1149 不得反向改写本 descriptor ownership 或把 capability support rows 写回本 FR。

### 9. Limitation references

`cloakbrowser.persistent.limitation_refs` 必须至少声明：

- `persistent_requires_cloakbrowser_managed_profile`
- `persistent_requires_profile_binding`
- `persistent_requires_extension_workflow_binding`
- `persistent_requires_native_messaging`
- `persistent_requires_provider_broker_attachment`
- `persistent_provider_private_patch_required`
- `persistent_no_descriptor_level_health_pass`
- `persistent_no_descriptor_level_runtime_readiness`
- `persistent_no_latest_head_live_evidence`

约束：

- limitation refs 是 descriptor 边界说明，不是 capability fail-closed matrix。
- `persistent_provider_private_patch_required` 只能说明 provider 依赖 CloakBrowser managed/private capability；不得暴露 patch schema。
- `persistent_no_latest_head_live_evidence` 只说明本 spec PR 不产出 fresh evidence，不表示后续 persistent runtime 不能产出 evidence。
- required binding refs 命中 runtime requirement 时，后续 selection / health / launch owner 必须继续验证，不得因 descriptor 存在而放行。

### 10. Evidence reference slots

`cloakbrowser.persistent.evidence_reference_slots` 必须至少声明：

- `static_descriptor_ref`
- `registry_entry_ref`
- `capability_matrix_ref`
- `health_result_ref`
- `launch_evidence_ref`
- `fixture_ref`

约束：

- 本 FR 只能满足 `static_descriptor_ref`。
- `health_result_ref` 必须消费 `FR-0038`。
- `launch_evidence_ref` 必须消费后续 launch / evidence owner；slot 存在不表示 launch evidence 已生成、fresh 或通过。
- `fixture_ref` 由后续 fixture owner 填充，本 FR 不创建 fixture payload。

### 11. 与 direct descriptor 的差异边界

`cloakbrowser.persistent` 与 `cloakbrowser.direct` 必须保持以下差异：

- persistent 使用 `provider_id=cloakbrowser.persistent`；direct variant 必须使用不同 provider id。
- persistent 使用 `provider_mode=external_managed` 与 `attach_model=provider_brokered`；direct launch / final args evidence 属于 `#1146`。
- persistent 需要 managed persistent profile、extension workflow binding、native messaging 与 provider broker attachment；direct 不得从本 FR 继承这些 required inputs。
- persistent 不定义 direct extension path handling、final args evidence limits、direct launch envelope 或 direct cleanup semantics。
- direct descriptor 不得被解释为 persistent profile / extension workflow health pass；persistent descriptor 也不得被解释为 direct launch readiness。

### 12. Registry alignment

后续 registry consumer 若登记 `cloakbrowser.persistent`，必须：

- 使用 `provider_id=cloakbrowser.persistent`。
- 使用 `provider_class=cloakbrowser_managed` 或后续正式 registry owner 冻结的等价 class。
- 保持 `contract_snapshot` 满足 `FR-0033.browser_provider_contract.v1`。
- 将 persistent-specific fields 保留在 provider-specific descriptor carrier 中，不在 registry private fields 复制第二套 shape。
- 保留 opt-in / private provider limitation，不能进入默认业务选择。

约束：

- 本 FR 不创建 registry row，不实现 resolver，不设置 runtime default selection。
- registry entry 存在不得被解释为 CloakBrowser installed、profile ready、extension workflow ready、health pass 或 live evidence pass。

## GWT 验收场景

### 场景 1：persistent descriptor 只冻结 static inputs

Given `cloakbrowser.persistent` descriptor 已定义
When reviewer 检查 profile、extension workflow 与 health requirement inputs
Then descriptor 必须只包含 static refs、constraints 与 downstream owner references
And 不得包含 health result、runtime ready、launch evidence、fixture payload 或 live evidence

### 场景 2：persistent profile 不内联敏感信息

Given persistent profile reference 指向 CloakBrowser managed profile
When descriptor 写入 profile locator、workspace ref 或 identity constraint
Then 必须使用 redacted / opaque / report-local locator
And 不得内联 cookie、token、license secret、账号凭据、raw profile path 或 broker credential

### 场景 3：extension workflow refs 不等于 capability support

Given `extension_workflow.workflow_capability_refs` 已存在
When #1149 capability matrix 判断 supported actions 与 verification thresholds
Then #1149 必须消费 FR-0033/FR-0035/FR-0038 与本 descriptor refs
And 本 FR 不得提前声明 read/write/download/diagnose support matrix

### 场景 4：health inputs 不等于 doctor pass

Given health requirement inputs 包含 native messaging、extension binding 与 provider broker refs
When provider admission 判断 `cloakbrowser.persistent` 是否可执行业务命令
Then 必须继续消费 FR-0038 doctor report 或后续 runtime attestation
And 不得把 descriptor refs 解释为 doctor pass、runtime ready 或 live evidence ready

### 场景 5：persistent 与 direct 边界分离

Given `#1146 cloakbrowser.direct Descriptor` 定义 direct launch capability 与 final args evidence boundary
When reviewer 检查 `cloakbrowser.persistent`
Then persistent descriptor 不得定义 direct launch args、direct extension path handling 或 direct cleanup semantics
And direct descriptor 不得被要求承担 persistent profile / extension workflow health inputs

### 场景 6：private patch 不进入 WebEnvoy core schema

Given CloakBrowser provider 依赖 private managed browser capability
When descriptor 表达该依赖
Then 只能使用 `persistent_provider_private_patch_required` limitation 或 health input ref
And 不得暴露 stealth patch field、browser patch parameter、driver state 或 provider secret

## 异常与边界场景

- `provider_id` 不是 `cloakbrowser.persistent`：不得作为 #1147 persistent descriptor 消费。
- `provider_mode` 不是 `external_managed` 或 `attach_model` 不是 `provider_brokered`：不得作为 CloakBrowser persistent descriptor 消费，除非后续正式 FR 修订该边界。
- descriptor 缺少 profile reference、extension workflow refs、native messaging ref 或 provider broker ref：后续 consumer 必须 fail-closed。
- descriptor 出现 health result payload、capability matrix rows、launch evidence record、fixture payload、runtime implementation detail、XHS flow 或 Syvert normalized result：视为 scope violation。
- descriptor 内联 secret、cookie、token、license key、storage、raw sensitive path、account credential 或 provider broker credential：视为 secret boundary violation。
- descriptor 将 doctor pass、runtime attestation、target tab readiness 或 live evidence attestation 写成 descriptor fact：视为 verification boundary violation。

## 验收标准

1. `FR-0050` 已冻结 `cloakbrowser.persistent` provider identity、mode、engine、transport、profile semantics、extension workflow refs、health requirement inputs、capability refs、limitation refs 与 evidence slots。
2. 本 suite 明确 persistent descriptor 只提供 static refs 与 downstream owner inputs，不定义 health schema、runtime readiness、capability matrix、fixture、launch evidence 或 fresh live evidence。
3. 本 suite 已明确与 `cloakbrowser.direct` 的差异边界，不推进 #1146 direct launch / final args evidence scope。
4. 本 suite 不暴露 CloakBrowser private patch schema、driver state、license secret、account credential 或 provider broker credential。
5. spec map 已将 `FR-0050` 映射到 canonical issue `#1147`。
