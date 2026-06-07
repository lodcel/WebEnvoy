# FR-0033 Browser Provider Contract

Canonical Issue: #1123

## 背景

`#1123` 属于 M2 `provider-runtime-pr2-3-contracts`，目标是在进入 provider runtime 实现前，先冻结通用 Browser Provider contract。M1 已通过 `docs/dev/architecture/system-design/boundary.md` 明确 WebEnvoy、Syvert 与 Provider 的职责边界：

- WebEnvoy 是 CLI-first 的 Web 执行工具和运行时底座，不是 Agent 大脑。
- Syvert 是可选上层消费者，不是 WebEnvoy core 的组成部分。
- Provider 是执行能力、runtime 能力声明、健康诊断、证据产物或浏览器适配的承载单元，不等于 WebEnvoy core runtime，也不等于 Syvert 业务映射层。

当前缺口是：后续 `#1124/#1125/#1130` 等实现或契约事项需要稳定地判断“某个浏览器执行面能声明什么能力、验证到什么级别、哪些限制必须 fail-closed”，但仓库尚未冻结 provider identity、mode、browser engine、automation transport、capability declarations、verification level 与 limitations 的统一表达。

本 FR 只冻结 Browser Provider contract 的最小 formal 输入。它不实现 provider registry，不选择具体 provider，也不把任何私有浏览器 patch 或上层 normalized mapping 写成 WebEnvoy core 默认契约。

`#1123` 的 issue meta 已声明 `Close Semantics: fr-complete`，scope 是 “Define the stable Browser Provider contract”。因此本 PR 的 `Fixes #1123` 只关闭 Browser Provider Contract 的 contract-freeze FR；provider registry、doctor、selection、adapter implementation 与 runtime 行为由后续事项承接，不属于 `#1123` 自身关闭条件，也不关闭 `#1124/#1125/#1130`。

## 目标

1. 冻结 `browser_provider_contract` 的最小对象边界。
2. 冻结 provider identity、provider mode、browser engine、automation transport 的正式字段与枚举。
3. 冻结 capability declarations、verification level、limitations 与 fail-closed 判定规则。
4. 明确 Browser Provider contract 与 WebEnvoy core、Syvert consuming layer、CloakBrowser 或其他 provider 私有实现之间的边界。
5. 为后续 provider registry、runtime doctor、provider selection 或 adapter implementation 提供可直接引用的 formal 输入。

## 非目标

- 不实现 runtime/provider registry、provider selection、provider installation、doctor 命令或 CLI 行为；这些是 downstream implementation / consumer，不属于 `#1123` 的 `fr-complete` 关闭条件。
- 不修改 extension、native host、Playwright、runtime bootstrap、runtime status、live evidence 或任何外部可见执行行为。
- 不触碰 `#1124/#1125/#1130` 的实现范围。
- 不冻结 Syvert normalized result、Syvert business schema、Syvert provider adapter 或任何跨仓业务映射。
- 不把 CloakBrowser 或其他 provider 的私有 stealth patch、driver 内部状态、浏览器 patch 细节写成 WebEnvoy core contract。
- 不重定义 `FR-0015` 的 official Chrome persistent extension / runtime bootstrap / readiness contract。
- 不重定义 `FR-0016` 的 PR 级 live evidence gate。
- 不重定义 `FR-0020` 的反风控验证与 baseline 评估对象。

## 功能需求

### 1. Contract 定位与 ownership

- 系统必须冻结一个稳定的 `browser_provider_contract` 对象。
- `browser_provider_contract` 的 ownership 属于 WebEnvoy core provider/runtime formal boundary。
- 该对象只表达一个 provider 可被 WebEnvoy 消费前必须声明和验证的浏览器执行面事实。
- 该对象不得被解释为：
  - provider registry 记录
  - runtime 实例状态
  - Syvert normalized mapping schema
  - CloakBrowser 私有 patch manifest
  - live evidence record
  - anti-detection baseline record
- 后续实现若需要把 provider contract 持久化、登记或选择，必须在独立实现/contract issue 中定义 registry 或 selection 语义，不能反向修改本对象的职责。

### 2. Provider identity

`browser_provider_contract.provider_identity` 必须至少冻结以下字段：

- `provider_id`
- `provider_family`
- `provider_version`
- `contract_version`
- `distribution_channel`
- `implementation_owner`

约束：

- `provider_id` 是 WebEnvoy 本地 provider contract namespace 下的稳定标识，不得使用显示名称、npm package name 或浏览器 profile 名称临时代替。
- `provider_family` 至少支持：
  - `official_chrome`
  - `chromium_compatible`
  - `managed_browser_provider`
  - `custom_provider`
- `provider_version` 表达 provider package / adapter / bridge 的版本，不等于浏览器版本。
- `contract_version` 表达本 contract shape 的版本，当前冻结为 `v1`。
- `distribution_channel` 至少支持：
  - `builtin`
  - `local_adapter`
  - `external_adapter`
  - `experimental`
- `implementation_owner` 只表达该 provider implementation 的责任边界，不授予其修改 WebEnvoy core contract 的权威。

### 3. Provider mode

`browser_provider_contract.provider_mode` 必须至少支持：

- `core_managed`
- `external_managed`
- `adapter_only`
- `diagnostic_only`

约束：

- `core_managed` 表示 WebEnvoy core 负责启动、连接或生命周期编排的 provider mode。
- `external_managed` 表示 provider 生命周期由外部系统或用户现场持有，WebEnvoy 只 attach / connect 到已存在的执行面。
- `adapter_only` 表示 provider 只提供 adapter / driver 能力，不声明可独立管理浏览器生命周期。
- `diagnostic_only` 表示 provider 只可用于健康诊断或证据解析，不得被业务命令选择为执行面。
- 后续 provider selection 必须 fail-closed 地拒绝把 `diagnostic_only` provider 作为业务执行 provider。

### 4. Browser engine 与 execution surface

`browser_provider_contract.browser_engine` 必须至少冻结：

- `engine_family`
- `browser_channel`
- `browser_version_range`
- `headless_policy`
- `extension_binding_support`
- `profile_binding_support`

约束：

- `engine_family` 至少支持：
  - `chrome`
  - `chromium`
  - `webkit`
  - `firefox`
  - `other`
- 当前 WebEnvoy official 主路径仍由 `FR-0015` 约束为 branded Google Chrome persistent extension 路线；本 FR 允许 contract 表达其他 engine family，但不把它们升级为当前主路径。
- `browser_channel` 若声明 Google Chrome stable，必须复用 `FR-0020` 已冻结的 canonical label `Google Chrome stable`，不得发明 `stable`、`chrome-stable` 等别名。
- `headless_policy` 至少支持：
  - `forbidden`
  - `allowed_for_dev_only`
  - `allowed`
  - `unknown`
- 对需要 real-browser evidence 或高风险 live 路径的能力，`headless_policy=allowed|unknown` 不得自动满足真实执行面要求；后续 gate 必须按对应 FR 继续验证。
- `extension_binding_support` 与 `profile_binding_support` 只表达 provider 能力声明，不替代 `FR-0015` / `FR-0003` 的 identity、profile lock 或 runtime readiness 判定。

### 5. Automation transport

`browser_provider_contract.automation_transport` 必须至少冻结：

- `transport_kind`
- `transport_owner`
- `command_surface`
- `attach_model`
- `native_messaging_support`
- `cdp_support`
- `playwright_support`

约束：

- `transport_kind` 至少支持：
  - `native_messaging`
  - `cdp`
  - `playwright`
  - `extension_bridge`
  - `os_input`
  - `hybrid`
  - `none`
- `transport_owner` 至少支持：
  - `webenvoy_core`
  - `provider`
  - `external_system`
  - `manual_user`
- `command_surface` 至少支持：
  - `runtime_control`
  - `page_automation`
  - `diagnostics`
  - `artifact_passthrough`
- `attach_model` 至少支持：
  - `launch`
  - `attach_existing`
  - `provider_brokered`
  - `not_attachable`
- `transport_kind=none` 或 `attach_model=not_attachable` 的 provider 不得被选择为业务执行 provider，只能进入 diagnostic / metadata 消费用途。
- 声明支持 CDP、Playwright 或 OS input 不代表 WebEnvoy 可以绕过浏览器内执行原则对目标站点独立发 HTTP 请求。
- 本 FR 不改变 `docs/dev/architecture/system-design.md` 中“浏览器内执行是唯一 HTTP 出口”的架构红线。

### 6. Capability declarations

`browser_provider_contract.capabilities` 必须至少能表达：

- `capability_id`
- `capability_kind`
- `supported_execution_layers`
- `supported_actions`
- `runtime_requirements`
- `evidence_outputs`
- `risk_constraints`
- `verification_level`
- `limitations`

约束：

- `capability_kind` 至少支持：
  - `browser_runtime`
  - `page_automation`
  - `extension_runtime`
  - `native_bridge`
  - `artifact_provider`
  - `diagnostic_provider`
- `supported_execution_layers` 只能使用既有 `L3 | L2 | L1` 执行层枚举，不得发明 provider 私有层级。
- `supported_actions` 至少支持 `read | write | download | diagnose`。
- `diagnose` 不是用户业务能力面；它只用于 provider doctor / health / evidence inspection。
- `runtime_requirements` 只表达执行前置，例如 profile、extension binding、native messaging、target tab、real browser、headless policy 等要求；不得把这些要求误写成“已经验证通过”的事实。
- `evidence_outputs` 只声明 provider 能产出或透传哪些证据引用；不替代 `FR-0016.live_evidence_record` 或 `FR-0020` validation record。
- `limitations` 必须可机器读取，并参与 fail-closed 判定。

### 7. Verification level

`browser_provider_contract.verification` 必须至少冻结 provider-level 与 capability-level 的验证级别：

- `declared_only`
- `static_checked`
- `doctor_checked`
- `runtime_attested`
- `live_evidence_attested`

约束：

- `declared_only` 只表示 provider 自报，不足以进入业务执行默认选择。
- `static_checked` 表示 contract shape、字段、枚举和本地文件/配置引用已静态通过。
- `doctor_checked` 表示 provider doctor 或等价健康检查已通过，但不等于真实页面闭环成功。
- `runtime_attested` 表示 runtime attach / bootstrap / readiness 级事实已被当前对应 runtime contract 验证。
- `live_evidence_attested` 表示存在符合适用 PR / issue / FR 门禁要求的 live evidence；该级别不得由本 FR 自行伪造，必须引用对应最新 head / run / artifact 事实。
- 后续实现若要求执行业务命令，必须根据 capability 风险选择最低可接受 verification level；低于最低级别时必须 fail-closed。

### 8. Limitations 与 fail-closed 边界

`browser_provider_contract.limitations` 必须至少支持以下类型：

- `unsupported_engine`
- `unsupported_channel`
- `headless_only`
- `no_extension_binding`
- `no_profile_binding`
- `no_native_messaging`
- `no_real_browser_attestation`
- `diagnostic_only`
- `experimental_only`
- `provider_private_patch_required`
- `unknown`

fail-closed 规则：

- 任何 `unknown` limitation 在影响目标 capability 的情况下，都必须被视为阻断，除非后续 FR 明确冻结了更窄的降级规则。
- `provider_private_patch_required` 只能说明 provider 依赖私有实现能力；它不得把私有 patch 细节提升为 WebEnvoy core contract。
- `diagnostic_only` provider 不得被选择为业务执行 provider。
- 需要 extension / native messaging / profile 绑定的 capability，在对应 support 字段缺失或未知时必须阻断。
- 需要 real browser / latest-head live evidence 的门禁，不得用 `doctor_checked`、stub、fake host 或 provider 自报替代。

### 9. 明确边界关系

本 FR 必须明确：

- 与 WebEnvoy core：Browser Provider contract 是 core 可消费的 provider 声明，不替代 CLI-first command contract、runtime bootstrap 或 execution strategy。
- 与 Syvert：该 contract 不包含 Syvert normalized result、业务 schema、project state 或 product workflow；integration gate 只锚定 WebEnvoy provider-runtime foundation，不引入 Syvert external dependency。
- 与 CloakBrowser / 私有 provider：可以声明 provider 需要私有 patch 或 managed browser 能力，但不得冻结其 patch 字段、stealth 参数或内部 driver 状态。
- 与 `FR-0015`：official Chrome runtime migration、persistent extension binding、runtime bootstrap 和 readiness 仍由 `FR-0015` 持有。
- 与 `FR-0016`：PR 级 live evidence gate 仍由 `FR-0016` 持有。
- 与 `FR-0020`：反风控验证与 baseline 评估仍由 `FR-0020` 持有。

## GWT 验收场景

### 场景 1：provider 自报能力但未验证时不得默认执行

Given 一个 provider contract 声明支持 `read` 和 `L3`
And 对应 capability 的 `verification_level=declared_only`
When 后续 provider selection 准备把它作为业务执行 provider
Then selection 必须按目标 capability 的最低验证要求 fail-closed
And 不得把 provider 自报当作 runtime ready 或 live evidence ready

### 场景 2：diagnostic-only provider 不得执行业务命令

Given `provider_mode=diagnostic_only`
And provider 声明了 `diagnostic_provider` capability
When 后续业务命令请求选择执行 provider
Then 该 provider 不得作为业务执行面
And 只能用于 doctor、health 或 evidence inspection 语义

### 场景 3：CloakBrowser 私有 patch 不进入 core contract

Given 一个 managed browser provider 依赖私有 stealth patch
When reviewer 检查 `browser_provider_contract`
Then contract 只能记录 `provider_private_patch_required` limitation 或等价 capability requirement
And 不得冻结私有 patch 字段、driver 内部状态或 browser patch 细节

### 场景 4：Syvert normalized mapping 不进入 provider contract

Given Syvert 未来可能消费 WebEnvoy 的 provider 执行结果
When reviewer 检查本 FR 的对象与字段
Then 不应出现 Syvert normalized result、业务 schema 或 product workflow 字段
And 不因“未来 Syvert 可能消费”引入 Syvert external dependency
And PR metadata 仍必须按 provider/shared-contract gate 标记 `contract_surface=execution_provider`

### 场景 5：缺少 extension binding 支持时必须阻断相关 capability

Given 某个 capability 的 `runtime_requirements` 要求 extension binding
And provider contract 的 `extension_binding_support=none|unknown`
When 后续 runtime admission 评估该 capability
Then 必须返回可解释阻断
And 不得静默降级到未绑定 extension 的执行路径

### 场景 6：browser channel canonical label 不得漂移

Given provider contract 声明 Google Chrome stable
When reviewer 检查 `browser_engine.browser_channel`
Then 字段值必须复用 `Google Chrome stable`
And 不得使用 `stable`、`chrome-stable` 或其他别名

## 异常与边界场景

- `provider_id` 缺失或使用 display name/profile name 充当稳定 ID：视为 contract invalid。
- `contract_version` 缺失或不是 `v1`：视为当前 formal contract 不可消费。
- `provider_mode=diagnostic_only` 却声明可执行业务 `read/write/download`：必须 fail-closed。
- `transport_kind=none` 或 `attach_model=not_attachable` 却声明可执行业务命令：必须 fail-closed。
- capability 声明的 `supported_execution_layers` 不在 `L3/L2/L1` 内：视为 contract invalid。
- capability 需要 real browser attestation，但 verification 只到 `doctor_checked`：不得通过真实执行门禁。
- limitation 中存在影响目标 capability 的 `unknown`：默认阻断。
- provider contract 出现 Syvert normalized 字段、CloakBrowser 私有 patch 参数或 runtime registry 字段：视为范围漂移。

## 验收标准

1. `browser_provider_contract` 的 identity、mode、browser engine、automation transport、capabilities、verification、limitations 与 fail-closed 边界已冻结。
2. 套件已明确它不是 Syvert normalized mapping、不是 WebEnvoy Agent brain、不是 CloakBrowser 私有 patch 细节、不是 provider registry 实现。
3. 套件已明确与 `FR-0015`、`FR-0016`、`FR-0020` 和 M1 boundary document 的 ownership 关系。
4. 当前 PR 只承载 formal spec review，不混入 runtime/provider registry、adapter implementation、external runtime behavior 或治理五文件修改。
5. PR metadata 使用 `Fixes #1123`，且仅关闭 `#1123` 的 Browser Provider Contract contract-freeze FR；不关闭 `#1124/#1125/#1130` 等 downstream implementation / consumer。
6. PR metadata 声明 provider/shared-contract integration gate：
  - `integration_applicable=yes`
  - `integration_ref=#1111`
  - `shared_contract_changed=yes`
  - `external_dependency=none`
  - `merge_gate=integration_check_required`
  - `contract_surface=execution_provider`
  - `joint_acceptance_needed=no`

## 依赖与前置条件

- GitHub 事项：
  - `#1123` Browser Provider Contract
  - `#1111` Provider Runtime Foundation
- 上游基线：
  - `vision.md`
  - `docs/dev/roadmap.md`
  - `docs/dev/architecture/system-design.md`
  - `docs/dev/architecture/system-design/boundary.md`
  - `FR-0015-official-chrome-runtime-migration`
  - `FR-0016-live-evidence-governance-gate`
  - `FR-0020-anti-detection-validation-baseline`
- 后续但不由本 FR 承接：
  - `#1124`
  - `#1125`
  - `#1130`
