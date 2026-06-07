# FR-0035 Error and Exit Code Taxonomy Alignment

Canonical Issue: #1133

## 背景

FR-0001 已冻结 current v1 CLI 的最小错误壳和退出码集合：参数错误、未知命令、未实现命令、运行时不可用、执行失败。FR-0004 在该错误壳内补充最小观察、错误分类和结构化诊断。FR-0034 又冻结 Command Envelope v2 的未来输出壳，要求 `ok=false` 时 `errors[0]` 必须能映射回 v1 `error.code`、`error.message`、`error.retryable`，并且所有 v2 错误都必须能 loss-minimized 地转换回 v1 error shape。

#1133 的职责是在 FR-0034 之后冻结一套 WebEnvoy-local 的错误与退出码 taxonomy，让后续实现能够一致处理 validation、risk gate denied、provider unavailable、runtime failure、closeout failure、schema/evidence failure，而不是在各命令或后续 FR 中临场发明错误码、类别和退出码。

本 FR 只冻结 formal/spec 契约，不修改 CLI、runtime、provider、closeout 或 live evidence 行为。

## 目标

1. 冻结错误类别、错误码族、退出码类别与 retryable 语义的对应关系。
2. 将 #1133 要求的六类失败面映射到 FR-0034 `ErrorV2.category`、v1 `error.code` 和稳定 exit code class。
3. 保留 FR-0001 current v1 consumer 兼容性：默认输出不变，既有退出码不被重编号。
4. 明确 schema/evidence failure、closeout failure 与 runtime failure 的边界，避免全部落入泛化执行失败。
5. 明确 risk gate denied 是本仓库本地风险门禁错误，不等于外部 provider/shared-contract integration gate。
6. 为后续实现事项提供测试输入，但不实现 CLI/runtime 行为。

## 非目标

- 不实现新的 CLI formatter、错误生成器、runtime handler、provider adapter 或 closeout evaluator。
- 不改变默认 stdout JSON、stderr 边界或当前命令语法。
- 不修改 FR-0001 已冻结的既有退出码数值。
- 不关闭或实现 #1134、#1135、#1136。
- 不把 WebEnvoy 输出提升为 Syvert normalized result。
- 不冻结 Syvert adapter、Provider adapter、CloakBrowser provider 或跨仓共享执行契约。
- 不把 live evidence PR metadata 替换为 v2 `evidence` 字段。

## Functional Requirements

### 1. Taxonomy ownership

本 FR 冻结 WebEnvoy-local command error taxonomy。

约束：

- taxonomy 只服务 WebEnvoy CLI / Command Envelope v2 / current v1 compatibility。
- taxonomy 可以被未来 adapter 消费，但不定义 Syvert normalized result 或 provider adapter payload。
- 后续命令级 spec 可以新增更具体错误码，但必须挂接到本 FR 冻结的 error family 与 exit code class。

### 2. Error family

错误族冻结为：

| Error family | 语义 | FR-0034 category | 默认 retryable |
|---|---|---|---|
| `validation` | argv、params、schema 或调用方输入不满足契约 | `cli` | `false` |
| `risk_gate_denied` | WebEnvoy 本地风险门禁拒绝继续执行 | `risk` | `false` |
| `provider_unavailable` | 所需浏览器执行面、扩展、native messaging、平台适配器或命令 provider 不可用 | `environment` 或 `runtime` | `true` |
| `runtime_failure` | 运行时链路已进入但在页面、请求、交互、连接或执行阶段失败 | `runtime`、`page`、`request`、`action`、`account` 或 `unknown` | 按诊断判定 |
| `closeout_failure` | closeout/admission/gate/evaluator 未满足关闭条件或证据无法完成收口 | `evidence` 或 `risk` | `false` |
| `schema_evidence_failure` | 输出 schema、证据契约或 required evidence 无法满足 | `evidence` 或 `cli` | `false` |

约束：

- `errors[0]` 必须选择最接近主失败原因的 error family。
- 多错误场景中只能有一个 primary error；其他错误作为 related errors。
- `validation` 不得用于掩盖 runtime 中途失败。
- `runtime_failure` 不得用于掩盖本地风险门禁拒绝或 closeout 条件未满足。
- `schema_evidence_failure` 不得只作为 warning；当它阻断主目标或兼容输出时必须让 `ok=false`。

### 3. Error code families

本 FR 冻结以下错误码族和最小 canonical codes：

| Error family | Canonical error code | 兼容关系 |
|---|---|---|
| `validation` | `ERR_CLI_INVALID_ARGS` | 继承 FR-0001 |
| `risk_gate_denied` | `ERR_RISK_GATE_DENIED` | 新增，后续实现映射到风险门禁 |
| `provider_unavailable` | `ERR_PROVIDER_UNAVAILABLE` | 新增，区别于现有 runtime unavailable 但可降级映射 |
| `runtime_failure` | `ERR_RUNTIME_UNAVAILABLE` / `ERR_EXECUTION_FAILED` | 继承 FR-0001 |
| `closeout_failure` | `ERR_CLOSEOUT_FAILED` | 新增，closeout-only 失败 |
| `schema_evidence_failure` | `ERR_SCHEMA_EVIDENCE_FAILED` | 新增，schema/evidence contract 失败 |

约束：

- FR-0001 既有 `ERR_CLI_UNKNOWN_COMMAND` 与 `ERR_CLI_NOT_IMPLEMENTED` 保留为 CLI routing 子类；它们属于 validation-adjacent routing errors，但不属于 #1133 六类主映射之一。
- 新增错误码不得破坏 current v1 error shape；v1 consumer 仍读取 `error.code` 字符串。
- 后续实现可以新增命令级细分码，例如 `ERR_EVIDENCE_REQUIRED_UNAVAILABLE`，但必须声明其 parent canonical code 或 exit code class。

### 4. Exit code class

退出码类别冻结为：

| Exit code | Class | Primary families |
|---:|---|---|
| `0` | `success` | none |
| `2` | `validation` | `validation` |
| `3` | `unknown_command` | FR-0001 routing |
| `4` | `not_implemented` | FR-0001 routing |
| `5` | `provider_unavailable` | `provider_unavailable` |
| `6` | `runtime_failure` | `runtime_failure` |
| `7` | `risk_gate_denied` | `risk_gate_denied` |
| `8` | `closeout_failure` | `closeout_failure` |
| `9` | `schema_evidence_failure` | `schema_evidence_failure` |

约束：

- `0` 到 `6` 的既有含义不得重编号。
- 新增 `7` 到 `9` 只在后续实现显式引入对应错误时使用。
- 同一 primary error family 在不同命令下必须返回同一 exit code class。
- 多错误场景的进程退出码必须由 `errors[0]` 的 primary family 决定。

### 5. FR-0034 `ErrorV2` alignment

后续 v2 error 必须至少包含：

- `code`
- `message`
- `retryable`
- `category`
- `family`
- `exit_code`

约束：

- `family` 与 `exit_code` 是本 FR 在 FR-0034 `ErrorV2` 上的加法约束。
- `category` 仍使用 FR-0034 的枚举，不新增跨仓 category。
- `errors[0].exit_code` 必须等于进程退出码，除非命令以 sidecar/preview 方式生成 v2 而不控制进程退出；该例外必须在 `operational.compat` 中披露。
- v1 conversion 时，`errors[0].code`、`message`、`retryable` 仍生成 v1 `error`。

### 6. Retryable semantics

retryable 语义冻结为：

- `validation` 默认不可重试，除非调用方修正输入。
- `risk_gate_denied` 默认不可自动重试，必须通过显式风险升级、dry_run/recon 或人工允许改变门禁条件。
- `provider_unavailable` 可重试，但重试前应先恢复 provider/runtime/profile/extension/native messaging。
- `runtime_failure` 由诊断决定；网络短暂失败可重试，页面结构变化、账号限制或不可继续交互不可盲目重试。
- `closeout_failure` 默认不可自动重试；必须先补齐 readiness、admission、evidence 或 blocker 拆分。
- `schema_evidence_failure` 默认不可自动重试；必须先修正 schema/evidence contract 或 evidence producer。

### 7. Evidence and closeout boundary

schema/evidence failure 与 closeout failure 的区别如下：

- `schema_evidence_failure`：命令输出或 evidence object 本身不满足契约，例如 required evidence 缺失、schema 校验失败、artifact locator 不可解析。
- `closeout_failure`：closeout/admission/gate/evaluator 消费证据后判定关闭条件不满足，例如 latest-head fresh evidence 缺失、readiness matrix 未达标、formal gate 未通过。

约束：

- 当 evidence object 不存在或不合法时，优先归类为 `schema_evidence_failure`。
- 当 evidence object 存在但不能满足关闭条件时，优先归类为 `closeout_failure`。
- 两者都不能替代 PR 级 live evidence metadata；PR 若落入真实 Live Evidence 专项门禁，仍必须按仓库 PR metadata 规则提供最新证据。

### 8. Provider unavailable boundary

`provider_unavailable` 表示命令所需执行面或 provider 未达到可执行状态。

允许示例：

- official browser/runtime 未就绪。
- Chrome Extension 或 Native Messaging 链路不可用。
- 命令需要的平台 provider/adapter 未安装、未注册或当前不可连接。
- provider readiness/audit 明确阻断进入执行。

约束：

- 已进入执行后发生页面、请求或动作失败，应优先归类为 `runtime_failure`。
- provider unavailable 不等于 Syvert provider adapter contract；本 FR 不定义跨仓 provider payload。
- current v1 兼容路径中，可以将 provider unavailable 降级映射为 `ERR_RUNTIME_UNAVAILABLE` / exit `5`，但 v2 taxonomy 应保留 `ERR_PROVIDER_UNAVAILABLE`。

### 9. Risk gate denied boundary

`risk_gate_denied` 表示 WebEnvoy 本地风险门禁拒绝执行、升级或写入。

约束：

- 风险门禁拒绝必须产生 blocking error，不能只作为 warning。
- 若命令因 dry_run/recon 策略正常返回且主目标完成，可用 warning 或 operational limits 披露未进入 live，不应误报 `risk_gate_denied`。
- risk gate denied 不代表 integration merge gate 失败，也不触发本 PR 的 integration-gated metadata。

## GWT 验收场景

### 场景 1：validation 映射到稳定退出码

Given 调用方传入不满足契约的参数
When 后续实现生成 v2 error
Then `ok=false`
And `errors[0].family=validation`
And `errors[0].code=ERR_CLI_INVALID_ARGS`
And `errors[0].category=cli`
And `errors[0].exit_code=2`
And v1 conversion 仍能生成 `error.code=ERR_CLI_INVALID_ARGS`

### 场景 2：risk gate denied 不被当作 runtime failure

Given 命令请求进入风险受控动作
And WebEnvoy 本地风险门禁拒绝继续执行
When 后续实现生成错误输出
Then `ok=false`
And `errors[0].family=risk_gate_denied`
And `errors[0].code=ERR_RISK_GATE_DENIED`
And `errors[0].category=risk`
And 进程退出码为 `7`
And 不使用 `ERR_EXECUTION_FAILED` 掩盖门禁拒绝

### 场景 3：provider unavailable 可与 runtime failure 区分

Given 命令需要 browser/provider readiness
And 所需 provider 未就绪或不可连接
When 命令在进入页面执行前失败
Then `errors[0].family=provider_unavailable`
And `errors[0].code=ERR_PROVIDER_UNAVAILABLE`
And `errors[0].exit_code=5`
And `retryable=true`

### 场景 4：runtime failure 保留 FR-0004 诊断

Given 命令已进入运行时执行链路
And 页面请求或动作阶段发生阻断性失败
When 后续实现生成 v2 error
Then `errors[0].family=runtime_failure`
And `errors[0].category` 能在 `runtime`、`page`、`request`、`action`、`account` 或 `unknown` 中选择最贴近失败面的值
And `errors[0].exit_code=6`
And `errors[0].diagnosis` 遵守 FR-0004 脱敏、截断和 failure_site 规则

### 场景 5：closeout failure 与 evidence schema failure 分离

Given evidence object 存在且 schema 合法
And closeout evaluator 判定关闭条件未满足
When 后续实现生成错误输出
Then `errors[0].family=closeout_failure`
And `errors[0].code=ERR_CLOSEOUT_FAILED`
And `errors[0].exit_code=8`
And 不把该结果误归类为 provider unavailable

### 场景 6：schema/evidence failure 阻断兼容输出

Given 命令声明 required evidence 或 v2 envelope schema 必须满足契约
And required evidence 缺失或 schema 校验失败
When 后续实现生成错误输出
Then `errors[0].family=schema_evidence_failure`
And `errors[0].code=ERR_SCHEMA_EVIDENCE_FAILED`
And `errors[0].exit_code=9`
And 不能只用 warning 代替 blocking error

### 场景 7：多错误场景由 primary error 决定退出码

Given 同一命令同时发现 provider readiness 失败和 evidence locator 缺失
When provider readiness 是最早阻断执行的主失败原因
Then `errors[0].family=provider_unavailable`
And related error 可记录 schema/evidence failure
And 进程退出码仍为 `5`

### 场景 8：本 taxonomy 不生成 Syvert normalized result

Given 上层系统未来可能消费 WebEnvoy command output
When 本 FR 冻结错误与退出码 taxonomy
Then 输出仍是 WebEnvoy-local command error contract
And 不出现 Syvert normalized schema、provider result mapping 或跨仓 shared contract 字段
And PR integration metadata 可保持 local-only

## 异常与边界场景

- 未知命令和未实现命令继续使用 FR-0001 `ERR_CLI_UNKNOWN_COMMAND` / exit `3` 与 `ERR_CLI_NOT_IMPLEMENTED` / exit `4`，不强行折叠进 #1133 六类失败面。
- 如果 validation 与 schema/evidence failure 同时出现，且调用方输入 schema 错误发生在执行前，优先使用 `validation`；如果是命令产物或 evidence producer 违反输出契约，优先使用 `schema_evidence_failure`。
- 如果 risk gate denied 后仍采到 partial observation，该 observation 只能作为 evidence/diagnosis 辅助，不能把主错误改成 runtime failure。
- 如果 provider unavailable 与 runtime failure 难以区分，后续实现必须以是否已进入目标执行面作为判定边界；未进入执行面用 provider unavailable，已进入后失败用 runtime failure。
- 如果 closeout evaluator 本身不可用，属于 provider unavailable 或 runtime failure；如果 evaluator 可用但判定失败，属于 closeout failure。
- 新增错误码必须保持 ASCII、稳定、可 grep，格式为 `ERR_<DOMAIN>_<NOUN_OR_STATE>`。

## 验收标准

1. #1133 六类失败面均有明确 error family、canonical code、FR-0034 category、retryable 和 exit code class。
2. 既有 FR-0001 退出码 `0` 到 `6` 没有被重编号，新增风险、closeout、schema/evidence class 使用 `7` 到 `9`。
3. `provider_unavailable`、`runtime_failure`、`closeout_failure`、`schema_evidence_failure` 的边界清楚，后续实现可写测试。
4. v2 `ErrorV2` 加法字段 `family` 与 `exit_code` 已冻结，且仍可转换回 v1 error shape。
5. 本 FR 没有实现 CLI/runtime 行为，没有修改 #1134/#1135/#1136，也没有引入 Syvert normalized result 或 integration-gated shared contract。

## 依赖与前置条件

- [FR-0034 Command Envelope v2 Design](../FR-0034-command-envelope-v2-design/spec.md) 已合入 main。
- [FR-0001 CLI 最小入口与可集成契约骨架](../FR-0001-runtime-cli-entry/spec.md) 提供 current v1 error shape 与既有退出码。
- [FR-0004 最小观察、错误分类与结构化诊断能力](../FR-0004-runtime-observability/spec.md) 提供诊断、failure_site、脱敏和截断规则。
- `docs/dev/architecture/system-design/error-handling.md` 提供历史错误处理背景；如与本 FR 具体 CLI taxonomy 冲突，以本 FR 和 FR-0034 为准。
