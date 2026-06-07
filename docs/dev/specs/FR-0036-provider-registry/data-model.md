# FR-0036 data model

## 定位

本 work item 不引入 SQLite 表、迁移或 runtime registry implementation。这里的 data model 只冻结 provider registry 的共享对象语义，供后续 provider doctor、selection、adapter implementation 与 runtime 行为引用。

## 核心对象

### `browser_provider_registry`

职责：

- 作为 provider contract 的正式登记入口。
- 聚合 registry identity、contract ref、owner 与 entries。
- 为后续 consumer 提供按 `provider_id` 精确解析 provider entry 的唯一入口。

非职责：

- 不表达 runtime instance status。
- 不表达 browser process、profile lock 或 active session。
- 不表达 doctor result、selection decision 或 live evidence record。
- 不表达 Syvert normalized result。
- 不表达 provider 私有 patch manifest。

Registry static state：

1. `declared`：registry suite 或后续配置载体提供 entry。
2. `static_checked`：entry shape、provider_id 一致性、`FR-0033` contract snapshot 与 constraints 已静态通过。
3. `disabled`：entry 被显式关闭，不得进入默认业务候选。
4. `deprecated`：entry 仍可被历史引用解析，但不得进入默认业务候选。
5. `blocked`：entry 存在阻断性契约、locator 或约束问题，不得进入默认业务候选。

约束：

- registry static state 只能使用 `FR-0036.RegistryStatus` 枚举。
- `doctor_checked`、`runtime_attested` 与 `live_evidence_attested` 不属于 registry status；它们只能作为 `FR-0033` verification level、后续 doctor result、runtime readiness 或 live evidence record 的事实出现。
- 后续 parser / selection 不得把 doctor、runtime 或 live evidence 事实回写成 registry status。

### `browser_provider_registry_entry`

职责：

- 表达一个 provider 的 registry row。
- 绑定 `provider_id`、`provider_class`、`contract_snapshot`、status、eligibility、locator 与 constraints。
- 作为后续 provider selection 的候选输入。

约束：

- `provider_id` 是 entry 的唯一逻辑 key。
- `provider_id` 必须等于 `contract_snapshot.provider_identity.provider_id`。
- 同一 registry 内重复 `provider_id` 必须阻断，除非后续实现先冻结版本选择规则。
- `contract_snapshot` 是 `FR-0033.browser_provider_contract` 的 snapshot，不允许被 registry 私有字段覆盖。

### `provider_locator`

职责：

- 表达 provider implementation、adapter 或 broker 的解析线索。
- 支持 builtin、local adapter、external adapter、remote broker 与 diagnostic-only locator。

约束：

- locator 不表达 provider 已安装、已连接、已认证或已通过 doctor。
- locator 不得包含 secret、token、cookie、profile-local absolute path 或 private patch payload。
- remote broker locator 不冻结远端协议或认证方式。

### `provider_registry_constraints`

职责：

- 表达 registry entry 进入后续 selection / doctor / runtime consumer 前必须满足的静态约束。
- 提供 `requires_opt_in` 与 `out_of_scope_actions`，保护当前 work item 不被误读为 runtime 行为完成。

约束：

- constraints 不替代 `FR-0033` limitations 与 verification level。
- constraints 与 `FR-0033` contract limitation 都必须参与 fail-closed。
- `requires_opt_in=true` 阻断默认业务选择。

## 字段 ownership

| 字段组 | Ownership | 不得替代 |
|---|---|---|
| registry identity / owner | FR-0036 | FR-0033 provider identity、runtime status |
| entry key / provider class | FR-0036 | provider selection policy、driver branch |
| contract ref / snapshot | FR-0036 resolver shape；contract body 由 FR-0033 持有 | private provider schema |
| status / eligibility | FR-0036 static registry state | doctor result、runtime readiness、live evidence |
| locator | FR-0036 static resolver input | install state、auth state、remote protocol |
| constraints | FR-0036 registry gate input | capability verification、runtime gate、Syvert mapping |

## 兼容策略

- 当前 registry version 为 `v1`。
- 同一主版本内只能新增向后兼容的可选字段。
- 修改既有必填字段、closed enum、resolver 规则、fail-closed 规则或 ownership，必须重新进入 formal review。
- 后续 implementation 不得通过 driver 私有分支绕过 registry entry 与 `FR-0033` contract snapshot。
