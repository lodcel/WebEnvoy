# FR-0051 cloakbrowser.cloakserve Descriptor

Canonical Issue: #1148

## 背景

`#1148` 属于 M10 CloakBrowser lane，目标是在进入 `#1149` capability matrix 与 `#1152` limitation gate 前，先冻结 `cloakbrowser.cloakserve` descriptor 的静态边界。

父项 `#1114` 已明确：

- CloakBrowser 是可选 Browser Provider variants，不是 WebEnvoy core。
- CloakBrowser lane 不输出 Syvert normalized result，不承接 XHS business semantics。
- `#1146/#1147/#1148` 可并行准备 descriptor 输入，`#1149` 在 descriptor 输入冻结后消费 capability matrix。

本 FR 只定义 `cloakbrowser.cloakserve` 这个 CDP server / brokered provider variant 的 descriptor carrier。它消费 `FR-0033 Browser Provider Contract`、`FR-0035 Provider Capability Verification Model`、`FR-0036 Provider Registry`、`FR-0038 Provider Health Doctor Contract`、`FR-0040 Provider Evidence Kernel` 与 `FR-0041 Evidence Redaction Policy`，但不实现 runtime、health、limitation gate、fixtures、browser patching 或真实 live evidence。

## 目标

1. 冻结 `cloakbrowser.cloakserve` 的 provider identity、mode、engine、transport 与 lifecycle ownership。
2. 冻结 default extension disabling 边界：WebEnvoy extension / Native Messaging bridge 默认不可用，不得从 upstream extension support 推导为 WebEnvoy runtime ready。
3. 冻结 extension workflow experimental status：扩展加载只能作为后续 opt-in experimental reference，不能作为 #1148 的 supported capability。
4. 冻结 provider contract references、capability declaration refs、limitation refs 与 evidence reference slots。
5. 为 #1149 capability matrix 与 #1152 limitation gate 提供可消费的 fail-closed limitation 输入。

## 非目标

- 不定义或修改 `cloakbrowser.direct` / `cloakbrowser.persistent` descriptor；它们属于 #1146/#1147。
- 不定义 #1149 capability matrix support rows、verification thresholds、action coverage 或 default eligibility。
- 不定义 #1152 limitation gate、limitation parser、policy implementation 或 gate result schema。
- 不实现 health command、doctor command、launch envelope、runtime launch、provider selection、CLI、fixtures、tests、browser patching、extension install 或 Native Messaging。
- 不把 CloakBrowser 私有 source patch、fingerprint seed、driver internals、proxy handling 或 `cloakserve` process state 写成 WebEnvoy core contract。
- 不引入 Syvert normalized result、XHS business semantics、official Chrome service worker fix、live write 或 closeout evidence。
- 不声明 fresh live evidence、runtime attestation、real-browser closeout 或 production account readiness。

## 功能需求

### 1. Descriptor 定位与 ownership

系统必须冻结一个稳定的 `cloakbrowser_cloakserve_descriptor` 对象。

约束：

- `cloakbrowser_cloakserve_descriptor` 是 provider-specific static descriptor carrier。
- 它只表达 `cloakbrowser.cloakserve` 作为外部 CDP server / brokered execution surface 可被 WebEnvoy 后续 consumer 识别前需要声明的静态事实。
- 它不得被解释为 runtime status、provider health result、launch evidence、live evidence record、fixture、browser process snapshot、CloakBrowser patch manifest 或 Syvert mapping。
- `descriptor_owner` 必须指向 `#1148` / `FR-0051`。
- 后续 #1149/#1152 可以消费本 descriptor 的 identity、transport、limitation refs 与 evidence slots，但不得反向把 matrix/gate 语义写回本 suite。

### 2. Provider identity

`cloakbrowser.cloakserve` 必须冻结以下 identity：

- `descriptor_id`: `cloakbrowser.cloakserve`
- `descriptor_version`: `v1`
- `provider_id`: `cloakbrowser.cloakserve`
- `provider_family`: `managed_browser_provider`
- `provider_version`: `v1`
- `contract_version`: `v1`
- `distribution_channel`: `experimental`
- `implementation_owner`: `external_provider`

约束：

- `provider_id` 是 WebEnvoy provider namespace 下的稳定 descriptor id。
- `provider_family=managed_browser_provider` 表达该 variant 通过外部 managed browser / CDP server 暴露执行面；它不表示 WebEnvoy core 管理 CloakBrowser binary lifecycle。
- `distribution_channel=experimental` 要求后续 selection / registry / launch owner 默认 opt-in，不能把该 provider 放入默认 business execution set。
- identity 存在不证明 CloakBrowser 已安装、版本安全、`cloakserve` 已启动、CDP endpoint 安全、runtime 已连接、profile 可用或 live evidence 已通过。

### 3. Provider mode 与 engine

`cloakbrowser.cloakserve` 必须声明：

- `provider_mode`: `external_managed`
- `engine_family`: `chromium`
- `browser_channel`: `CloakBrowser Chromium`
- `browser_version_range`: `provider_managed`
- `headless_policy`: `unknown`
- `extension_binding_support`: `none`
- `profile_binding_support`: `unknown`

约束：

- `provider_managed` 表示浏览器版本由 CloakBrowser package / image / service owner 管理，#1148 不验证版本、binary checksum 或 installation state。
- `headless_policy=unknown` 不满足 real-browser、headed anti-detection 或 live evidence gate；需要这些能力时必须由后续 health/evidence owner 证明。
- `extension_binding_support=none` 是 WebEnvoy 消费边界：`cloakserve` descriptor 默认不提供 WebEnvoy extension binding。
- `profile_binding_support=unknown` 必须在需要 profile persistence、account state 或 profile identity 的 capability 中 fail-closed，直到 #1149/#1152 或 health owner 提供更窄规则。

### 4. Transport

`cloakbrowser.cloakserve` 必须声明：

- `transport_kind`: `cdp`
- `transport_owner`: `provider`
- `command_surface`: `runtime_control`, `page_automation`, `diagnostics`, `artifact_passthrough`
- `attach_model`: `provider_brokered`
- `native_messaging_support`: `none`
- `cdp_support`: `supported`
- `playwright_support`: `supported`

约束：

- transport 只表达 WebEnvoy 后续 consumer 可以通过 provider-brokered CDP surface 连接；它不证明 endpoint 可达、安全、隔离或已通过 doctor。
- `native_messaging_support=none` 必须阻断任何需要 WebEnvoy Native Messaging bridge 的 capability。
- `playwright_support=supported` 只表达 CDP / Playwright attach 形态可被后续 owner 消费；不得绕过“浏览器内执行是唯一 HTTP 出口”的架构红线。
- `cloakserve` endpoint security、binding host、authentication、origin guard、fingerprint parameter handling 与 process cleanup 必须由后续 health / limitation / evidence owner 验证；#1148 只冻结 descriptor limitations。

### 5. Default extension disabling

`cloakbrowser.cloakserve.extension_workflow` 必须冻结为：

- `default_extension_binding`: `disabled`
- `webenvoy_extension_bridge`: `unsupported_by_default`
- `native_messaging_bridge`: `unsupported`
- `extension_paths_input`: `experimental_reference_only`
- `extension_runtime_evidence`: `not_provided_by_descriptor`
- `extension_workflow_owner`: `future_owner`

约束：

- 即使上游 CloakBrowser 文档或版本支持 extension loading，WebEnvoy consumer 也不得把该事实解释为 WebEnvoy extension bridge ready。
- `extension_paths_input=experimental_reference_only` 只能作为后续 experimental opt-in owner 的输入，不得在 #1148 中升级为 supported capability。
- default extension disabling 命中 extension runtime、Native Messaging、service worker、WebEnvoy content script 或 relay bridge capability 时，必须 fail-closed。
- 后续如果要启用扩展 workflow，必须新增或消费独立 owner，至少覆盖 extension identity、install mode、service worker readiness、Native Messaging policy、profile binding 与 evidence freshness。

### 6. Capability declaration references

`cloakbrowser.cloakserve.capability_declaration_refs` 必须只表达引用：

- `FR-0033.browser_provider_contract.capabilities`
- `FR-0035.provider_capability_verification_model`
- `#1149 CloakBrowser Capability Matrix`
- `#1152 CloakBrowser Limitation Gate`

约束：

- 本 FR 不声明 `read/write/download/diagnose` 的支持矩阵。
- 本 FR 不声明 `L3/L2/L1` action coverage、minimum verification state 或 default selection policy。
- #1149 可以消费本 descriptor 的 identity/mode/engine/transport/default extension disabling/limitation refs，但不得反向修改 #1148 descriptor owner。
- #1152 可以消费本 descriptor 的 limitation refs 与 fail-closed boundary，但不得把 #1152 gate result schema 写入本 descriptor。

### 7. Limitation references

`cloakbrowser.cloakserve.limitation_refs` 必须至少声明：

- `cloakserve_external_lifecycle`
- `cloakserve_distribution_experimental`
- `cloakserve_headless_policy_unknown`
- `cloakserve_profile_binding_unknown`
- `cloakserve_default_extension_disabled`
- `cloakserve_extension_workflow_experimental_only`
- `cloakserve_no_webenvoy_extension_binding`
- `cloakserve_no_native_messaging`
- `cloakserve_no_descriptor_level_runtime_readiness`
- `cloakserve_no_latest_head_live_evidence`
- `cloakserve_cdp_endpoint_security_not_attested`
- `cloakserve_provider_private_patch_required`

约束：

- limitation refs 是 descriptor boundary ids，不是 full capability matrix。
- `cloakserve_default_extension_disabled` 与 `cloakserve_extension_workflow_experimental_only` 必须被 #1149/#1152 视为 capability-level fail-closed 输入。
- `cloakserve_provider_private_patch_required` 只表达该 provider 依赖 CloakBrowser 私有 browser implementation；不得展开 patch schema 或把 patch 细节写入 WebEnvoy core。
- `cloakserve_cdp_endpoint_security_not_attested` 命中 remote CDP、network exposure、origin guard、auth 或 fingerprint routing 场景时必须保持 blocked / deny，直到后续 owner 提供证据。

### 8. Evidence reference slots

`cloakbrowser.cloakserve.evidence_reference_slots` 必须只声明以下槽位：

- `static_descriptor_ref`
- `provider_contract_ref`
- `registry_entry_ref`
- `capability_matrix_ref`
- `limitation_gate_ref`
- `health_result_ref`
- `launch_evidence_ref`
- `fixture_ref`

约束：

- 本 FR 只能满足 `static_descriptor_ref` 与 descriptor-level `provider_contract_ref`。
- `capability_matrix_ref` 由 #1149 填充。
- `limitation_gate_ref` 由 #1152 填充。
- `health_result_ref` 必须消费 `FR-0038` 或后续 CloakBrowser health owner。
- `launch_evidence_ref` 必须消费 `FR-0040` 与 `FR-0041` 的 evidence / redaction boundary。
- `fixture_ref` 只能由后续 fixture owner 填充；#1148 默认不创建 fixture。
- 槽位存在不表示对应证据已生成、fresh、passed 或可用于 closeout。

### 9. Registry alignment

后续 registry consumer 若登记 `cloakbrowser.cloakserve`，必须：

- 使用 `provider_id=cloakbrowser.cloakserve`。
- 保持 `contract_snapshot` 满足 `FR-0033.browser_provider_contract.v1`。
- 将 `distribution_channel=experimental`、`provider_mode=external_managed` 与本 FR limitation refs 一并登记。
- 将 provider-specific descriptor fields 保留在 `cloakbrowser_cloakserve_descriptor` 中，不在 registry 私有字段复制第二套 shape。

约束：

- 本 FR 不创建 registry row，不实现 resolver，不设置 default eligibility。
- `default_eligibility` 不得因为 descriptor 存在而自动为 `eligible`。
- registry、selection 或 runtime admission 必须继续消费 #1149/#1152/health/evidence owner。

## GWT 验收场景

### 场景 1：cloakserve descriptor 只冻结静态 provider 边界

Given `cloakbrowser.cloakserve` descriptor 已定义
When reviewer 检查 descriptor fields
Then descriptor 必须包含 identity、mode、engine、transport、extension workflow、capability refs、limitation refs 与 evidence slots
And 不得包含 runtime status、health result、launch evidence、fixture payload 或 browser patch schema

### 场景 2：default extension disabling 必须 fail-closed

Given `cloakbrowser.cloakserve.extension_workflow.default_extension_binding=disabled`
When 后续 capability matrix 或 limitation gate 判定 extension runtime、Native Messaging 或 WebEnvoy relay bridge capability
Then 必须输出 blocked / deny，除非后续 owner 提供明确 opt-in、runtime attestation 与 evidence refs
And 不得把 upstream extension loading support 当作 WebEnvoy extension bridge ready

### 场景 3：extension workflow 只能作为 experimental reference

Given descriptor 声明 `extension_paths_input=experimental_reference_only`
When 后续 owner 尝试消费 extension paths
Then 必须先建立独立 owner 覆盖 extension identity、install mode、service worker readiness、Native Messaging policy、profile binding 与 evidence freshness
And #1148 不得被解释为 extension workflow support approval

### 场景 4：cloakserve CDP transport 不等于 runtime ready

Given descriptor 声明 `cdp_support=supported` 与 `attach_model=provider_brokered`
When selection 或 runtime admission 判断能否执行业务命令
Then 必须继续消费 FR-0033/FR-0035/#1149/#1152/FR-0038/FR-0040/FR-0041 或对应 runtime facts
And 不得把 CDP endpoint 存在解释为 runtime ready 或 live evidence passed

### 场景 5：limitation evidence boundary 可被 #1152 消费

Given #1152 limitation gate 消费本 descriptor
When limitation gate 遇到 `cloakserve_headless_policy_unknown`、`cloakserve_profile_binding_unknown`、`cloakserve_cdp_endpoint_security_not_attested` 或 `cloakserve_no_latest_head_live_evidence`
Then gate 必须保留 fail-closed 判定，直到对应 health/evidence owner 提供可追溯 evidence ref
And descriptor 本身不得伪造 verified_at、run_id、head_sha 或 artifact identity

## 异常与边界场景

- descriptor 缺少 `descriptor_owner=#1148` 或 `descriptor_version=v1` 时，不得作为 #1148 static descriptor 消费。
- `provider_id` 不是 `cloakbrowser.cloakserve` 时，不得作为 #1148 cloakserve descriptor 消费。
- descriptor 使用 `distribution_channel=builtin` 或 `provider_mode=core_managed` 时，视为 scope violation，除非后续 scheduler 授权重开范围。
- descriptor 将 extension workflow 写为 supported / required，或省略 `cloakserve_default_extension_disabled` 时，视为 default extension disabling boundary violation。
- descriptor 出现 health result schema、launch evidence record、limitation gate result、fixture payload、runtime implementation detail、CloakBrowser patch schema 或 live action proof 时，视为 scope violation。
- descriptor 内联 cookie、token、账号凭据、完整敏感本机路径、CDP auth secret 或 provider private patch details 时，视为 secret / provider-private boundary violation。

## 验收标准

1. `FR-0051` 只定义 `cloakbrowser.cloakserve` descriptor，不修改 #1146/#1147/#1149/#1152 owner 边界。
2. default extension disabling、extension workflow experimental status、provider contract refs、limitation refs 与 evidence slots 已冻结。
3. 本 suite 未定义 capability matrix、limitation gate implementation、health schema、launch evidence、fresh live evidence、fixtures 或 runtime implementation。
4. `cloakserve` limitations 已足够 #1149 capability matrix 与 #1152 limitation gate 消费。
5. spec map 已将 `FR-0051` 映射到 canonical issue `#1148`。
