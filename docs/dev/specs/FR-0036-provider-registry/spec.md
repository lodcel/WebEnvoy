# FR-0036 Provider Registry

Canonical Issue: #1125

## 背景

`#1125` 是 M2 Provider Runtime Foundation 的 work item，目标是在 `FR-0033 Browser Provider Contract` 已合入后，冻结 provider registry 的最小共享形状。`FR-0033` 已定义 `browser_provider_contract`，并明确它不是 registry row、runtime status 或 provider selection。当前缺口是后续 driver、doctor、selection 或 provider adapter 需要一个统一的登记入口来引用 official Chrome、CloakBrowser 与未来 remote browser provider，而不是在各驱动中硬编码 provider 分支。

本 suite 只定义 `browser_provider_registry` 的 formal carrier。它不实现运行时代码、不选择 provider、不启动浏览器、不连接 CloakBrowser 或 remote provider，也不改变 official Chrome 主路径。

`#1125` 的 issue meta 声明 `Type: Work Item` 与 `Close Semantics: work-item-complete`。因此本 PR 若完整冻结 registry shape，可使用 `Fixes #1125` 收口该 work item；它不关闭 `#1124/#1126/#1127/#1128/#1130`。

## 目标

1. 冻结 `browser_provider_registry` 与 `browser_provider_registry_entry` 的最小对象边界。
2. 明确 registry entry 如何引用 `FR-0033.browser_provider_contract`，并禁止用 registry 私有字段重写 contract。
3. 为 official Chrome、CloakBrowser managed provider 与 future remote browser provider 提供可登记的 provider class 形状。
4. 明确 registry lookup、entry status、priority、default eligibility 与 fail-closed 规则。
5. 为后续 provider doctor、selection、adapter implementation 与 runtime 行为提供正式输入，但不在本 work item 实现这些行为。

## 非目标

- 不实现 provider registry 解析器、持久化表、CLI 命令、doctor、selection、driver 或 runtime 行为。
- 不修改 extension、native host、Playwright、official Chrome runtime bootstrap 或任何外部可见执行行为。
- 不把 CloakBrowser 设为 WebEnvoy core 或默认 provider。
- 不冻结 CloakBrowser 私有 stealth patch、driver 内部状态、账号策略或浏览器 patch schema。
- 不冻结 Syvert normalized result、业务 schema、provider adapter mapping 或联合验收逻辑。
- 不触碰 `#1124/#1126/#1127/#1128/#1130` 的范围。
- 不重定义 `FR-0033` 已冻结的 provider identity、mode、browser engine、automation transport、capability、verification 或 limitation 字段。

## 功能需求

### 1. Registry 定位与 ownership

系统必须冻结一个稳定的 `browser_provider_registry` 对象。

约束：

- registry 属于 WebEnvoy core provider/runtime formal boundary。
- registry 只负责登记 provider contract snapshot、provider class、可解析 locator、entry status 与选择前置元数据。
- registry 不表达 runtime instance、browser process、profile lock、live evidence record、doctor result、selection decision 或 Syvert mapping。
- registry consumer 必须先解析 entry，再校验 entry 所引用的 `browser_provider_contract`。
- 后续实现不得绕过 registry，在 driver 中按 provider family/name 写硬编码分支来决定 provider 形态。

### 2. Registry identity

`browser_provider_registry` 必须至少包含：

- `registry_id`
- `registry_version`
- `contract_ref`
- `owner`
- `entries`

约束：

- `registry_id` 是 WebEnvoy provider registry namespace 下的稳定标识。
- `registry_version` 当前冻结为 `v1`。
- `contract_ref` 必须指向 `FR-0033.browser_provider_contract` 的 contract version，例如 `FR-0033.browser_provider_contract.v1`。
- `owner` 只表达该 registry 的维护责任边界，不授予其修改 `FR-0033` contract 的权威。
- `entries` 必须非空；空 registry 不能被声明为 provider runtime foundation 已完成。

### 3. Registry entry

`browser_provider_registry_entry` 必须至少包含：

- `entry_id`
- `provider_id`
- `provider_class`
- `contract_ref`
- `contract_snapshot`
- `registry_status`
- `default_eligibility`
- `priority`
- `locator`
- `selection_tags`
- `constraints`

约束：

- `provider_id` 必须精确等于 `contract_snapshot.provider_identity.provider_id`。
- `contract_ref` 是 entry 对 contract snapshot 的 stable ref；它不是文件路径或 runtime store 主键。
- `contract_snapshot` 必须满足 `FR-0033.browser_provider_contract`。
- `registry_status` 只表达登记状态，不表达 doctor/runtime/live 验证通过。
- `default_eligibility` 只表达是否允许进入后续默认选择候选；它不等于被选中。
- `priority` 只用于后续 selection 的排序输入；相同 priority 不允许用隐式 driver 顺序决定 provider。
- `locator` 只表达 provider implementation 或 external broker 的解析线索，不允许内联 secret、token、cookie 或 private patch payload。

### 4. Provider class

`provider_class` 必须至少支持：

- `official_chrome`
- `cloakbrowser_managed`
- `remote_browser`
- `custom_local`
- `diagnostic`

约束：

- `official_chrome` 用于登记 WebEnvoy official branded Google Chrome persistent extension 主路径，仍受 `FR-0015` 与 `FR-0033` 约束。
- `cloakbrowser_managed` 只能表达 managed browser provider 类别；不得把 CloakBrowser 私有 patch schema 写入 registry。
- `remote_browser` 只能表达未来 remote browser broker / adapter 类别；不得在本 suite 中冻结远端协议、认证方式或 network transport。
- `custom_local` 用于本地外部 adapter 或实验 provider，不得绕过 `FR-0033` fail-closed。
- `diagnostic` 只能用于 doctor、health 或 artifact inspection，不得成为业务默认执行 provider。

### 5. Registry status 与 default eligibility

`registry_status` 必须至少支持：

- `declared`
- `static_checked`
- `disabled`
- `deprecated`
- `blocked`

`default_eligibility` 必须至少支持：

- `eligible`
- `not_eligible`
- `diagnostic_only`
- `experimental_only`

约束：

- `declared` 只表示 entry 存在，不足以进入默认业务选择。
- `static_checked` 只表示 registry entry shape 与 `FR-0033` contract snapshot 已静态通过，不等于 runtime ready。
- `disabled`、`deprecated`、`blocked` entry 不得进入默认业务选择。
- `diagnostic_only` 与 `experimental_only` 不得进入默认业务选择，除非后续 issue 明确冻结更窄的 opt-in 规则。
- `default_eligibility=eligible` 仍必须继续校验 provider contract 的 verification level、limitations、capability requirements 与 runtime gate。

### 6. Locator 与 resolver

`locator` 必须至少能表达：

- `locator_kind`
- `locator_ref`
- `version_constraint`
- `integrity_ref`

`locator_kind` 至少支持：

- `builtin`
- `local_adapter`
- `external_adapter`
- `remote_broker`
- `diagnostic_only`

约束：

- `builtin` 可引用 WebEnvoy 内置 provider implementation 的稳定逻辑名。
- `local_adapter` 与 `external_adapter` 只表达 adapter locator，不表达该 adapter 已安装或已通过 doctor。
- `remote_broker` 只表达未来 broker locator，不冻结认证、连接协议或运行时 SLA。
- `integrity_ref` 可为空；若存在，后续实现必须以它作为静态校验输入。
- locator 不得成为绕过 `contract_snapshot` 的第二套 provider schema。

### 7. Constraints 与 fail-closed

`constraints` 必须至少能表达：

- `requires_contract_version`
- `requires_registry_status`
- `minimum_verification_level`
- `disallowed_limitations`
- `requires_opt_in`
- `out_of_scope_actions`

约束：

- `requires_contract_version` 当前必须匹配 `FR-0033.browser_provider_contract.v1`。
- `minimum_verification_level` 低于目标 capability 要求时必须阻断。
- 命中 `disallowed_limitations` 时必须阻断。
- `requires_opt_in=true` 时不得进入默认业务选择。
- `out_of_scope_actions` 必须至少覆盖本 work item 明确不承接的 live/runtime 行为，例如 `provider_selection`、`runtime_launch`、`cloakbrowser_as_core`、`syvert_normalized_result`。

### 8. 最小登记基线

本 suite 必须能表达以下三类 entry：

- official Chrome stable builtin provider
- CloakBrowser managed provider placeholder
- future remote browser provider placeholder

约束：

- official Chrome entry 可登记为 `static_checked` 的 builtin provider，但不表示当前 PR 产生 fresh runtime evidence。
- CloakBrowser entry 必须带有 private provider limitation 或 opt-in constraint，不能进入默认业务选择。
- remote browser entry 必须保持 `declared` 或 `blocked`，不能声明远端 broker 可用。
- 三类 entry 都必须通过 `FR-0033.browser_provider_contract` 形状表达 capabilities，而不是在 registry 私有字段中复制一套能力枚举。

## GWT 验收场景

### 场景 1：driver 通过 registry 解析 provider，而不是硬编码分支

Given 一个 driver 需要知道 `official-chrome-stable` 的 provider 形态
And `browser_provider_registry.entries` 中存在 `provider_id=official-chrome-stable`
When 后续实现解析该 provider
Then 实现必须按 `provider_id` 精确 lookup registry entry
And 必须读取 entry 中的 `contract_snapshot`
And 不得通过 driver 内部硬编码的 provider family 分支替代 registry lookup

### 场景 2：CloakBrowser 只能登记为 managed provider placeholder

Given registry 中存在 `provider_class=cloakbrowser_managed` 的 entry
And 该 entry 带有 `requires_opt_in=true`
When 后续 selection 评估默认业务 provider
Then 该 entry 不得进入默认候选
And registry 不得暴露 CloakBrowser 私有 patch schema
And WebEnvoy core 不得因此变成 CloakBrowser-as-core

### 场景 3：remote browser provider 未冻结运行时协议时 fail-closed

Given registry 中存在 `provider_class=remote_browser` 的 entry
And `registry_status=declared`
When 后续 selection 评估业务执行 provider
Then selection 必须 fail-closed
And 该 entry 只能作为未来 remote provider contract 输入
And 不得推断远端 broker 已可连接

### 场景 4：entry 与 contract provider_id 不一致时阻断

Given 一个 registry entry 的 `provider_id=official-chrome-stable`
And 其 `contract_snapshot.provider_identity.provider_id=other-provider`
When registry parser 校验 entry
Then parser 必须拒绝该 entry
And 不得继续进入 provider selection 或 runtime admission

### 场景 5：eligible 不等于 runtime ready

Given 一个 registry entry 的 `default_eligibility=eligible`
And 对应 contract capability 的 `verification_level=declared_only`
When 后续业务命令需要 runtime-attested provider
Then selection 必须按 verification level 不足 fail-closed
And 不能把 registry eligibility 当成 runtime readiness

## 异常与边界场景

- registry entry 缺少 `contract_snapshot`、`contract_ref` 或 `provider_id` 时，必须视为无效 entry。
- 同一 registry 内出现重复 `provider_id` 且没有后续实现冻结的版本选择规则时，必须阻断，不得按数组顺序取第一条。
- `registry_status=disabled|deprecated|blocked` 的 entry 不得进入默认业务候选。
- `default_eligibility=diagnostic_only|experimental_only` 的 entry 不得进入默认业务候选。
- locator 指向 remote broker 时，不得把 broker locator 当成认证或连接已验证事实。
- registry 不得把 provider private patch details、secret、cookie、profile-local absolute path 或 Syvert mapping schema 放入 `contract_snapshot` 外的私有字段。
- `priority` 缺失或冲突时，不得让驱动用硬编码 provider family 兜底；后续 selection 必须定义明确 tie-breaker 后才能消费。

## 验收标准

1. `browser_provider_registry` 与 `browser_provider_registry_entry` 的字段、枚举和 ownership 已冻结。
2. registry entry 到 `FR-0033.browser_provider_contract` 的引用、snapshot 校验和 provider_id 一致性规则已冻结。
3. official Chrome、CloakBrowser managed provider 与 future remote browser provider 的最小登记形状已覆盖。
4. `registry_status`、`default_eligibility`、locator、constraints 与 fail-closed 规则已覆盖。
5. 本 suite 没有实现 provider runtime、selection、doctor、driver、CloakBrowser core 或 Syvert normalized result。
