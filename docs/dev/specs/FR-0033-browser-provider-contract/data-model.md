# FR-0033 data model

## 定位

本 FR 不引入新的持久化表、迁移或 runtime registry。这里的 data model 只冻结 Browser Provider contract 的共享对象语义，供后续 registry / doctor / selection / adapter 实现引用。

## 核心对象

### `browser_provider_contract`

职责：

- 表达一个 provider 在被 WebEnvoy 消费前必须声明和验证的浏览器执行面事实。
- 聚合 identity、mode、browser engine、automation transport、capabilities、verification 与 limitations。

非职责：

- 不表达 provider registry row。
- 不表达 runtime instance status。
- 不表达 live evidence record。
- 不表达 Syvert normalized result。
- 不表达 provider 私有 patch manifest。

生命周期：

1. `declared`：provider 提供 contract。
2. `static_checked`：shape、枚举、必填字段与 limitation 已通过静态校验。
3. `doctor_checked`：后续 provider doctor 或等价健康检查可把相应 verification 提升到该级别。
4. `runtime_attested` / `live_evidence_attested`：只能由对应 runtime / evidence gate 事实提升。

本 FR 只冻结对象与状态语义，不实现生命周期推进器。

### `browser_provider_capability`

职责：

- 表达 provider 对某类浏览器执行能力的声明。
- 绑定 supported execution layers、supported actions、runtime requirements、evidence outputs、risk constraints、verification level 与 limitations。

约束：

- capability 必须有稳定 `capability_id`。
- capability 的 verification level 不得高于 provider-level evidence 能证明的级别，除非后续实现明确支持 capability-specific evidence。
- capability limitation 与 top-level limitation 都参与 fail-closed。

### `browser_provider_verification`

职责：

- 表达 provider-level 与 capability-level 的验证级别。
- 记录后续实现可引用的 evidence refs。

约束：

- `declared_only` 是默认最低状态。
- `doctor_checked`、`runtime_attested`、`live_evidence_attested` 都需要外部事实载体；本 FR 不自证。
- `verified_at` 如存在，必须是对应 verification evidence 的采集时间，而不是 contract 文件写入时间。

### `browser_provider_limitation`

职责：

- 表达会影响 provider 或 capability 被选择和执行的限制。

约束：

- limitation 是机器判定输入，不是自由文本备注。
- `unknown` 默认阻断受影响 capability。
- provider 私有 patch 只能以 limitation / requirement 表达，不能展开私有 schema。

## 字段 ownership

| 字段组 | Ownership | 不得替代 |
|---|---|---|
| provider identity / mode | FR-0033 | provider registry、runtime status |
| browser engine / transport | FR-0033 | FR-0015 readiness、FR-0003 profile lock |
| capability declarations | FR-0033 | ability descriptor、Syvert mapping |
| verification level | FR-0033 shape；证据事实由对应 runtime/evidence FR 持有 | live evidence record、anti-detection validation record |
| limitations | FR-0033 | provider 私有 patch details |

## 兼容策略

- 当前 contract version 为 `v1`。
- 同一主版本内只能新增向后兼容的可选字段。
- 修改既有必填字段、枚举语义、fail-closed 规则或 ownership，必须重新进入 formal spec review。
- 后续 registry / doctor / selection 实现不得通过私有字段绕过本 FR 的 fail-closed 规则。
