# FR-0037 data model

## 定位

本 FR 不引入新的持久化表、迁移、runtime registry 或 launch implementation。这里的 data model 只冻结 Launch Envelope 的共享对象语义，供后续 provider registry、launch admission、provider doctor、provider evidence kernel 与 command output contract 引用。

## 核心对象

### `launch_envelope`

职责：

- 表达一次 browser launch admission 所需的输入、约束和证据要求。
- 聚合 provider reference、profile binding、browser mode、network / regional settings、runtime bindings、fingerprint policy、evidence requirements 与 launch limitations。

非职责：

- 不表达 provider registry row。
- 不表达 provider doctor report。
- 不表达 runtime status。
- 不表达 live evidence record。
- 不表达 anti-detection validation record。
- 不表达 Syvert normalized result。
- 不表达 provider 私有 patch manifest。

生命周期：

1. `created`：命令或 runtime 组装 Launch Envelope。
2. `static_checked`：shape、枚举、必填字段与 secret redaction 已通过静态校验。
3. `admission_checked`：后续 launch admission 校验 provider contract、profile lock、runtime binding 与 fingerprint/evidence requirements。
4. `launch_consumed`：后续 runtime 启动消费该 envelope，并由对应 evidence kernel 或 runtime status 记录结果。

本 FR 只冻结对象与状态语义，不实现生命周期推进器。

### `launch_provider_reference`

职责：

- 引用 `FR-0033.browser_provider_contract`。
- 约束本次 launch 需要的 provider capability 与 minimum verification level。

约束：

- 不复制 provider capability declarations。
- 不提升 provider 自报 verification。
- 不绕过 `FR-0033` limitations 与 fail-closed 规则。

### `launch_profile_binding`

职责：

- 表达本次 launch 对 profile locator、锁、extension identity、native host binding 与登录态的要求。

约束：

- 只保存 locator 与 requirement，不保存账号 secret。
- 正式业务 launch 默认要求独占 profile lock。
- `unknown` login state 不能满足需要登录态的 capability。

### `launch_runtime_bindings`

职责：

- 表达 extension binding、extension asset locator、Native Messaging host binding 与 runtime bootstrap requirement。

约束：

- official Chrome 主路径使用 persistent profile extension。
- extension paths 不能承载 run/session secret。
- Native Host manifest 只通过 locator / artifact ref 引用。

### `launch_fingerprint_policy`

职责：

- 表达 fingerprint seed 的来源、黏性、轮换策略与 patch manifest locator。

约束：

- seed ref 必须脱敏。
- profile sticky seed 是当前主路径的稳定性原则。
- provider-managed policy 不允许把 provider 私有字段写进 WebEnvoy core contract。

### `launch_evidence_requirements`

职责：

- 表达本次 launch 需要哪些证据种类、最低 attestation level、artifact policy、redaction policy 与 freshness policy。

约束：

- 只声明要求，不产出 evidence。
- `current_launch` 与 `current_pr_head` freshness 必须由后续 evidence kernel / PR gate 证明。
- evidence redaction 由后续 `#1129` 或对应 policy 承接；本 FR 只保留 reference。

### `launch_admission_health_requirement`

职责：

- 表达后续 launch admission 必须检查哪些状态型输入。
- 将 profile lock、login state、extension identity、Native Messaging、runtime bootstrap、proxy / regional settings、fingerprint policy 与 evidence requirements 映射到统一 health state。

约束：

- health requirement 不是已通过事实；它只声明后续 admission 必须产生 health conclusion。
- `healthy` 是唯一可满足 launch admission 的 required state。
- `disconnected`、`recoverable`、`blocked`、`unknown` 都必须进入诊断或阻断路径，不能静默当作 ready。
- `new_envelope_required` 代表当前 envelope 权威性结束，后续必须重新生成输入。

## 字段 ownership

| 字段组 | Ownership | 不得替代 |
|---|---|---|
| provider reference | FR-0037 consumes FR-0033 | provider contract declarations、provider registry |
| profile binding | FR-0037 launch requirement | FR-0003 profile lifecycle implementation、account secret store |
| browser mode | FR-0037 launch requirement | FR-0015 runtime readiness、FR-0016 live evidence gate |
| network / regional settings | FR-0037 launch requirement | proxy credential store、anti-detection validation record |
| runtime bindings | FR-0037 launch requirement | extension install implementation、Native Host manifest generator |
| fingerprint policy | FR-0037 launch requirement | FR-0020 anti-detection validation、provider private patch schema |
| evidence requirements | FR-0037 requirement shape | #1128 evidence kernel、FR-0016 live evidence record |
| admission health requirements | FR-0037 validation boundary | runtime status implementation、doctor report |

## 兼容策略

- 当前 Launch Envelope version 为 `v1`。
- 同一主版本内只能新增向后兼容的可选字段。
- 修改既有必填字段、枚举语义、secret redaction 规则、freshness 规则或 fail-closed 规则，必须重新进入 formal spec review。
- 后续 implementation 不得通过私有字段绕过 provider verification、profile lock、runtime binding、fingerprint policy 或 evidence requirement。
