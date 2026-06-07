# FR-0040 data model

## 定位

本 FR 不引入新的持久化表、迁移、runtime status row、evidence collector 或 CLI implementation。这里的 data model 只冻结 Provider Evidence Kernel 的共享对象语义，供后续 provider registry、launch admission、capability verification、doctor、selection、command output 与 closeout gate 引用。

## 核心对象

### `provider_evidence_record`

职责：

- 表达一次 provider selection / launch / runtime admission / closeout 可消费的证据索引、归一化状态与阻断结论。
- 聚合 record identity、selected provider、version evidence、launch arguments、profile reference、extension status、Native Messaging status、evidence refs 与 closeout plan。

非职责：

- 不表达 provider registry row。
- 不表达 provider doctor report。
- 不表达 launch envelope。
- 不表达 runtime status row。
- 不表达 live evidence record。
- 不表达 Syvert normalized result。
- 不表达 anti-detection baseline record。
- 不表达 provider 私有 patch manifest。

生命周期：

1. `created`：后续实现基于 provider / launch / runtime 输入生成 record。
2. `validated`：shape、枚举、required evidence refs、freshness 与 redaction 状态通过静态校验。
3. `consumed`：provider admission、capability verification 或 closeout gate 消费 record。
4. `superseded`：新的 launch、runtime evidence 或 latest-head rerun 替代旧 record。

本 FR 只冻结对象语义，不实现生命周期推进器。

### `provider_selected_provider_evidence`

职责：

- 记录本次 evidence record 对 selected provider 的引用与选择来源。
- 绑定 `FR-0033.browser_provider_contract` 与可选 `FR-0036.browser_provider_registry_entry`。

约束：

- provider id、contract version 与 provider mode 必须能回溯到 `FR-0033`。
- 选择来源不能替代 provider contract verification。
- manual override 必须可追溯，并继续服从 fail-closed 规则。

### `provider_version_evidence`

职责：

- 记录 provider、browser、extension、Native Host 与 contract version 的 evidence conclusion。

约束：

- 版本值为 `unknown` 时不能满足命中目标 capability 的 required version evidence。
- 版本 evidence refs 是 locator，不是完整 command output 或私有路径。

### `provider_launch_arguments_evidence`

职责：

- 引用 `FR-0037.launch_envelope` 与 launch input / snapshot evidence。
- 记录 browser mode、runtime bindings、network/regional 与 fingerprint policy 的 evidence locator。

约束：

- 不复制完整 CLI argv 或 secret-bearing environment。
- 不承载 runtime bootstrap secret。
- 不把 Launch Envelope 本身当作已采集 evidence；Launch Envelope 是要求来源，evidence refs 是证明来源。

### `provider_profile_reference_evidence`

职责：

- 记录 profile locator、binding mode、lock status、login state 与 persistence status 的 evidence conclusion。

约束：

- profile ref 必须是 redacted locator。
- profile lock unknown / blocked 命中 required profile binding 时必须阻断。
- login evidence 不保存账号 secret。

### `provider_extension_status_evidence`

职责：

- 记录 extension requirement、binding mode、extension id/version、installation status、runtime status 与 evidence refs。

约束：

- official Chrome 主路径 evidence 必须保持 persistent profile extension 边界。
- disconnected / recoverable 不是 ready。
- extension evidence 不包含 runtime bootstrap secret。

### `provider_native_messaging_status_evidence`

职责：

- 记录 Native Messaging requirement、host name、manifest ref、allowed origin ref、host version、runtime status 与 evidence refs。

约束：

- Native Host secret、token 或 private payload 不得内联。
- bootstrap ack / ping 不等于真实页面交互或 live evidence closeout。
- host / origin / manifest mismatch 命中 required Native Messaging 时必须阻断。

### `provider_evidence_ref`

职责：

- 引用 provider evidence record 消费或产出的证据 locator。
- 表达 evidence kind、source、status、freshness、sensitivity、redaction state 与 artifact identity。

约束：

- evidence ref 是 locator，不是完整敏感内容。
- `sensitivity=secret` 不得进入公开摘要、PR body 或 unredacted artifact。
- `historical_background` 不得满足 `current_launch` 或 `current_pr_head` requirement。
- `live_evidence_ref` 只能引用适用 gate 已接受的 live evidence，不能替代 live evidence record 本体。

### `provider_evidence_closeout_plan`

职责：

- 汇总 required evidence coverage、freshness、attestation level、missing evidence、redaction gap、blocking reasons 与 closeout decision。

约束：

- `allow` 只表示 evidence record 满足当前 closeout plan。
- `deny` 是 fail-closed 的正式阻断结论。
- `defer` 只用于 spec / diagnostic / pre-admission；业务执行不得当作 allow。

## 字段 ownership

| 字段组 | Ownership | 不得替代 |
|---|---|---|
| selected provider | FR-0040 consumes FR-0033 / FR-0036 | provider contract、registry row、selection policy |
| version evidence | FR-0040 evidence shape | provider doctor report、runtime status |
| launch arguments evidence | FR-0040 consumes FR-0037 | Launch Envelope、browser launch implementation |
| profile reference evidence | FR-0040 evidence shape | FR-0003 profile lifecycle、account secret store |
| extension status evidence | FR-0040 evidence shape | FR-0015 extension identity/runtime readiness implementation |
| native messaging status evidence | FR-0040 evidence shape | Native Host manifest generator、runtime bootstrap |
| evidence refs / freshness | FR-0040 evidence shape | FR-0016 live evidence record、artifact store implementation |
| sensitivity / redaction state | FR-0040 minimum evidence boundary | full evidence redaction policy (#1129 or successor) |
| closeout plan | FR-0040 coverage and decision shape | guardian, GitHub checks, merge gate, live evidence gate |

## 兼容策略

- 当前 provider evidence contract version 为 `v1`。
- 同一主版本内只能新增向后兼容的可选字段、新的 non-blocking evidence kind 或更细的 optional source label。
- 修改 required section、closed enum、freshness 语义、redaction fail-closed 规则、secret handling 或 closeout decision 语义，必须重新进入 formal spec review。
- 后续 evidence collector、provider doctor、registry、selection 或 runtime implementation 不得通过私有字段绕过 required evidence、freshness、redaction 与 blocking outcome。
