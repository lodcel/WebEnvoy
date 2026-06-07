# FR-0035 data model

## 定位

本 FR 不引入新的持久化表、迁移、registry、doctor report 或 runtime evidence kernel。这里的 data model 只冻结 Provider Capability Verification Model 的共享对象语义，供后续 registry / doctor / selection / evidence kernel / adapter implementation 引用。

## 核心对象

### `provider_capability_verification_record`

职责：

- 表达某个 provider capability 在某次目标要求下的验证结论。
- 聚合 `FR-0033` declaration、verification sources、support state、decision、blocking reasons 与 evidence refs。

非职责：

- 不表达 provider registry row。
- 不表达 provider doctor report schema。
- 不表达 runtime instance status。
- 不表达 live evidence record。
- 不表达 Syvert normalized result。
- 不表达 provider 私有 patch manifest。

生命周期：

1. `declared`：从 `FR-0033` capability declaration 生成初始 record。
2. `statically_verified`：字段、枚举、required arrays、canonical labels、limitation conflict 和本地引用通过静态或 build-time 检查。
3. `health_checked`：后续 doctor / health check source 可提升到该状态。
4. `runtime_attested`：对应 runtime contract 的 readiness / attach / bootstrap / binding 事实通过。
5. `runtime_observed`：当前 runtime 执行面观察到 capability 关键行为或 artifact。
6. `live_evidence_attested`：适用 live evidence gate 接受 latest-head evidence。
7. `blocked`：任一 fail-closed 条件命中；一旦 `blocking_reasons` 非空，最终 record 必须进入该状态。

本 FR 只冻结对象与状态语义，不实现生命周期推进器。

### `capability_verification_source`

职责：

- 表达 support state 的证据来源。
- 区分 declaration、static/build、health、runtime、observation、live gate 与 manual review。

约束：

- source 必须有 kind、status、scope。
- source 如参与状态提升，必须有可追溯 evidence ref 或明确说明 `not_applicable`。
- failed、missing、stale 的 source 命中当前最低要求时必须导致 `blocked/deny`；未进入目标 admission 时可以 `defer`，但不得写入 `blocking_reasons`。

### `capability_verification_evidence_ref`

职责：

- 指向 contract、build artifact、doctor report、runtime attestation、runtime observation、live evidence 或 review record。

约束：

- 只记录 locator，不内联敏感原文。
- live evidence ref 必须能关联 latest-head fresh rerun。
- runtime source 必须能关联 run/session 或等价 runtime evidence。
- provider 私有 patch 细节不得进入 evidence ref payload。

### `capability_minimum_requirement`

职责：

- 表达某个 consumer / command / admission 对 capability 的最低验证要求。

约束：

- 只冻结表达方式，不冻结具体 selection policy。
- 默认业务 `read/write/download` 不接受 `declared`。
- real-browser / latest-head 要求必须继续交给对应 gate 判定。

## 字段 ownership

| 字段组 | Ownership | 不得替代 |
|---|---|---|
| provider / capability identity | FR-0033；本 FR 只引用 | provider registry、display name、profile name |
| support state / decision | FR-0035 | provider self-report、selection policy |
| verification source kind | FR-0035 | doctor report schema、runtime status schema |
| evidence refs locator | FR-0035 shape；证据事实由对应 runtime/evidence FR 持有 | live evidence record、anti-detection validation record |
| minimum requirement expression | FR-0035 | command-specific policy、selection implementation |
| blocking reason | FR-0035 | free-text reviewer note、provider private limitation details |

## 兼容策略

- 当前 model version 随 `FR-0033 contract_version=v1` 消费。
- 同一主版本内只能新增向后兼容的可选字段或新的非阻断 source metadata。
- 修改 support state、verification source、blocking reason、decision 语义或 fail-closed 规则，必须重新进入 formal spec review。
- 后续 registry / doctor / selection 实现不得通过私有字段绕过本 FR 的 fail-closed 规则。
