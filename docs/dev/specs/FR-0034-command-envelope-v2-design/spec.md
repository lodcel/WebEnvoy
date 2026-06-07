# FR-0034 Command Envelope v2 Design

Canonical Issue: #1131

## 背景

#1112 要冻结一条从当前 CLI 输出形态到未来稳定 command envelope 的兼容路径。当前主线已经由 FR-0001 冻结 CLI v1 外层壳：

- 成功态：`run_id`、`command`、`status=success`、`summary`、`timestamp`
- 失败态：`run_id`、`command`、`status=error`、`error.code`、`error.message`、`error.retryable`、`timestamp`

FR-0004 又在该外层壳内补充 `observability` 与 `error.diagnosis`。这些字段已经被 current CLI consumers 消费，不能在本事项中被直接替换。

同时，M1 已冻结 WebEnvoy / Syvert / Provider 边界：WebEnvoy core 可以提供稳定、机器可读的执行结果、错误、诊断和证据索引，但不能把输出提升为 Syvert normalized result，也不能因为未来可能被 Syvert 消费就升级为 integration-gated shared contract。

因此，本 FR 的职责是冻结未来 Command Envelope v2 的兼容设计，使后续实现可以在不破坏当前 CLI consumers 的前提下逐步迁移到 `ok`、`command`、`run_id`、`data`、`operational`、`evidence`、`warnings`、`errors`。

## 目标

1. 冻结 Command Envelope v2 的顶层字段、语义边界和兼容迁移原则。
2. 明确 v2 与 FR-0001 / FR-0004 current v1 shape 的映射关系。
3. 冻结成功、失败、部分可观测、降级建议、证据引用和 warning 的表达规则。
4. 说明如何保护当前 CLI consumers：默认 v1 输出不变，v2 只能通过后续实现事项显式启用或并行产出。
5. 为后续 #1133 / #1134 / #1135 / #1136 提供设计输入，但不在本 FR 实现任何 CLI 行为。

## 非目标

- 不直接修改当前 CLI 输出、退出码、命令语法、runtime 行为、account 行为或 live evidence 行为。
- 不实现 #1133 / #1134 / #1135 / #1136。
- 不把 WebEnvoy 输出提升为 Syvert normalized result。
- 不冻结 Syvert adapter、Provider adapter、CloakBrowser provider 或跨仓共享执行契约。
- 不改变 FR-0001 已冻结的 v1 `status` / `summary` / `error` 外层兼容义务。
- 不把 `data` 定义成所有命令都必须填充的业务 payload；无业务结果的命令可以返回空对象。

## Functional Requirements

### 1. Envelope v2 顶层字段

Command Envelope v2 顶层字段冻结为：

- `ok`
- `command`
- `run_id`
- `data`
- `operational`
- `evidence`
- `warnings`
- `errors`

约束：

- `ok` 是布尔成功谓词，不再复用 v1 `status=success|error`。
- `command` 是稳定逻辑命令标识，继承 FR-0001 的 `command` 语义。
- `run_id` 是单次命令调用标识，继承 FR-0001 / FR-0003 的命令级 `run_id` 语义，不是 profile id、browser id、session id 或 evidence id。
- `data` 承载命令业务结果。
- `operational` 承载运行态、诊断、兼容视图、限制和预算信息。
- `evidence` 承载证据引用和证据状态，不承载完整敏感原文。
- `warnings` 承载非阻断告警。
- `errors` 承载零个或多个结构化错误；`ok=false` 时至少一条。

### 2. v1 到 v2 的兼容映射

v2 必须能从 current v1 shape 派生兼容视图：

| v1 字段 | v2 归属 |
|---|---|
| `status=success` | `ok=true` |
| `status=error` | `ok=false` |
| `summary` | `data` 的主要来源；无法判定业务语义时保留在 `operational.compat.v1_summary` |
| `observability` | `operational.observability` |
| `error` | `errors[0]` 的主要来源 |
| `error.diagnosis` | `errors[0].diagnosis`，并可在 `operational.diagnosis` 放置主诊断索引 |
| `timestamp` | 必须映射到 `operational.timestamps.completed_at` |

约束：

- 后续实现不得为了输出 v2 删除 v1 字段。
- 后续实现若提供 `--output-version v2` 或等价显式开关，必须仍保留能生成 v1 兼容输出的路径。
- 后续实现若在 v1 输出中附加 v2 preview 字段，该字段必须是加法兼容，不得改变 v1 required fields。

### 3. 成功谓词

`ok=true` 表示命令完成且没有阻断性错误。

约束：

- `ok=true` 时 `errors` 必须为空数组。
- `ok=true` 不表示 live closeout、真实页面交互、账号安全或发布成功；这些只能由对应 FR 的 evidence / gate contract 判定。
- 有 warning、partial observation 或 fallback evidence 时，只要命令主目标完成且没有 blocking error，仍可为 `ok=true`。

`ok=false` 表示命令没有完成其主目标，或遇到阻断性 runtime / page / account / risk / evidence / environment 错误。

约束：

- `ok=false` 时 `errors` 必须至少包含一条主错误。
- 主错误必须能映射回 v1 `error.code` 与 `error.retryable`。

### 4. `data` 语义

`data` 是命令业务结果的唯一主载体。

约束：

- `data` 必须是对象；无业务 payload 时返回 `{}`。
- `data` 不承载运行时诊断、证据索引、warning 或错误列表。
- 平台原始响应、DOM 片段、Cookie、Token、完整请求体、完整响应体不得直接进入 `data`。
- 若某命令需要同时返回 raw-like 与 cleaned result，必须通过后续命令级 contract 明确字段边界；本 FR 不冻结 `raw` / `normalized` 共享语义。

### 5. `operational` 语义

`operational` 承载命令运行上下文和诊断状态。

至少允许以下子对象：

- `compat`
- `observability`
- `diagnosis`
- `timestamps`
- `limits`
- `runtime`

约束：

- `operational` 不承载业务结果。
- `operational.compat` 可承载 v1 兼容信息，例如 `v1_status`、`v1_summary`、`v1_error` 的受控镜像。
- `operational.observability` 承接 FR-0004 最小观察面。
- `operational.diagnosis` 可承载主诊断索引，但错误专属诊断仍应跟随对应 `errors[*].diagnosis`。
- `operational.timestamps.completed_at` 对所有可转换回 v1 的 v2 输出都是必填字段，用于生成 v1 必填 `timestamp`；缺失时不得宣称该 v2 envelope 满足 v1 compatibility。
- `operational.limits` 必须显式披露脱敏、截断、预算裁剪或 observation partial。

### 6. `evidence` 语义

`evidence` 承载证据引用、证据状态和最小 replay / audit locator。

约束：

- `evidence` 必须是数组；无证据时返回 `[]`。
- 每条 evidence 必须至少有 `kind`、`ref`、`status`。
- `status` 至少允许 `available`、`partial`、`unavailable`、`not_applicable`。
- `evidence` 只能引用 artifact、run、log、route evidence、diagnostic evidence 或 contract-specific evidence object，不内联敏感原文。
- `evidence` 本身不是 live evidence 专项门禁的替代品；若 PR 或命令声明真实 live closeout，仍必须满足对应 FR 和 PR metadata 的 latest-head fresh evidence 要求。

### 7. `warnings` 语义

`warnings` 承载非阻断告警。

约束：

- `warnings` 必须是数组；无 warning 时返回 `[]`。
- warning 必须有 `code`、`message`、`severity`。
- `severity` 至少允许 `info`、`warning`。
- warning 不得被用来隐藏阻断性错误；阻断项必须进入 `errors` 并让 `ok=false`。

### 8. `errors` 语义

`errors` 承载结构化错误列表。

约束：

- `errors` 必须是数组。
- `ok=false` 时第一条为主错误，必须可映射到 v1 `error.code`、`error.message`、`error.retryable`。
- 每条 error 至少包含 `code`、`message`、`retryable`、`category`。
- `category` 至少允许 `cli`、`runtime`、`page`、`request`、`action`、`account`、`risk`、`evidence`、`environment`、`unknown`。
- `diagnosis` 可选，但一旦存在必须遵守 FR-0004 的脱敏和截断规则。
- 多错误场景中只能有一个主错误；其他错误作为 related errors 保留，不得制造多个等价主因。

### 9. CLI consumer 兼容策略

后续实现必须满足：

- 默认输出版本仍为 current v1，直到单独 implementation FR 明确切换。
- v2 preview、v2 sidecar 或 v2 explicit mode 均不得污染 v1 `stdout` 单 JSON 规则。
- v1 required fields、退出码、stderr 边界保持不变。
- 所有 v2 output 的错误都必须能 loss-minimized 地转换回 v1 error shape。
- 所有 v2 success output 都必须能转换回 v1 success shape；无法确定业务 `summary` 时必须提供兼容摘要对象，而不是省略 `summary`。

### 10. 后续事项分流

- #1133 只能实现或冻结与 `data` / `summary` 兼容迁移直接相关的范围。
- #1134 只能实现或冻结 `operational` / `observability` / `diagnosis` 兼容迁移范围。
- #1135 只能实现或冻结 `evidence` / warning / error list 的输出治理范围。
- #1136 只能处理最终兼容 gate、tests、consumer migration 或 closeout，不得回头扩大本 FR 顶层字段。

## GWT 验收场景

### 场景 1：current v1 success 可映射为 v2 success

Given 一个 current v1 成功输出包含 `run_id`、`command`、`status=success`、`summary`、`timestamp`
When 后续实现生成 v2 兼容 envelope
Then `ok=true`
And `command` 与 `run_id` 保持不变
And `data` 能承载 `summary` 的业务结果
And `operational.timestamps.completed_at` 能生成 v1 必填 `timestamp`
And `errors=[]`
And v1 默认输出仍可生成

### 场景 2：current v1 error 可映射为 v2 error

Given 一个 current v1 错误输出包含 `error.code`、`error.message`、`error.retryable` 和 `error.diagnosis`
When 后续实现生成 v2 兼容 envelope
Then `ok=false`
And `errors[0]` 保留原错误码、消息、retryable 和 diagnosis
And `operational.diagnosis` 可索引同一主诊断
And `operational.timestamps.completed_at` 能生成 v1 必填 `timestamp`
And v1 错误输出仍可生成

### 场景 3：有 warning 但主目标完成

Given 命令主目标完成
And observation 发生部分裁剪或 fallback evidence only
When v2 envelope 被生成
Then `ok=true`
And `warnings` 包含非阻断说明
And `operational.limits` 或 `evidence.status` 明确披露限制
And `errors=[]`

### 场景 4：阻断性 evidence 缺失

Given 命令声明必须产出某类证据才能完成主目标
And 对应证据不可用
When v2 envelope 被生成
Then `ok=false`
And 主错误 `category=evidence`
And `evidence[*].status=unavailable` 或 `partial` 记录事实
And 不能只用 warning 代替错误

### 场景 5：v2 不改变默认 v1 consumer

Given 现有 consumer 只解析 v1 `status`、`summary`、`error`、`observability`
When 后续实现引入 v2 preview 或 explicit mode
Then 默认命令输出仍满足 v1 required fields
And 退出码映射不变
And `stdout` 仍只有一个 JSON 对象
And consumer 不需要为了本 FR 修改解析器

### 场景 6：v2 不等于 Syvert normalized result

Given 上层 Syvert 或其他 consumer 未来可能读取 WebEnvoy v2 envelope
When 本仓库冻结 v2 contract
Then `data` 仍是 WebEnvoy command result
And 不出现 Syvert normalized schema、project state 或 business mapping 字段
And PR integration metadata 仍可保持 local-only

## 异常与边界场景

- v1 `summary` 同时包含业务结果和诊断线索时，后续实现必须优先把业务结果放入 `data`，诊断线索放入 `operational.compat` 或 `operational.diagnosis`，不能直接整块提升为业务 `data`。
- v1 error 缺少 diagnosis 时，v2 不得伪造 diagnosis；只能省略或标记 unavailable。
- v2 中出现多个 related errors 时，第一条主错误必须稳定，不能因数组排序改变 consumer 对主失败原因的判断。
- `ok=true` 下如存在 `evidence.status=partial`，必须在 warning 或 limits 中披露该 partial 语义。
- 不支持 v2 的 consumer 必须继续能依赖 v1 默认输出。
- 敏感字段必须先脱敏再进入 `data`、`operational`、`evidence`、`warnings` 或 `errors`；不得先截断后脱敏。

## 验收标准

1. Command Envelope v2 顶层字段和语义已冻结，覆盖 `ok`、`command`、`run_id`、`data`、`operational`、`evidence`、`warnings`、`errors`。
2. v1 `status` / `summary` / `observability` / `error.diagnosis` 到 v2 的映射关系已清楚定义。
3. 当前 CLI consumers 的兼容保护明确：本 FR 不改变默认输出，后续实现必须保留 v1 路径。
4. 成功、失败、warning、partial evidence、diagnosis 和 evidence unavailable 的边界场景均有 GWT。
5. 套件没有实现 #1133 / #1134 / #1135 / #1136，也没有改变 live/runtime/account 行为。
6. 套件没有把 WebEnvoy 输出提升为 Syvert normalized result，integration metadata 可保持 local-only。
7. `contracts/command-envelope-v2.md`、`data-model.md`、`research.md`、`risks.md` 与本 spec 一致。

## 依赖与前置条件

- Governing issue：#1131
- Parent phase：#1112
- 前置文档：
  - `vision.md`
  - `docs/dev/roadmap.md`
  - `docs/dev/architecture/system-design.md`
  - `docs/dev/architecture/system-design/boundary.md`
  - `docs/dev/architecture/system-design/error-handling.md`
  - `docs/dev/specs/FR-0001-runtime-cli-entry/spec.md`
  - `docs/dev/specs/FR-0004-runtime-observability/spec.md`
