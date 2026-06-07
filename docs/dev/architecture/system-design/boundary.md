# WebEnvoy / Syvert / Provider 边界

> 所属文档：[系统设计（战术层）](../system-design.md)
> 覆盖范围：WebEnvoy core、Syvert consuming layer、Provider 运行时/适配层的职责边界与 integration 触发条件

---

## 目的

本文冻结 WebEnvoy、Syvert、Provider 三者的依赖方向和职责边界，避免把网页执行内核、上层业务编排和 provider 适配治理混成同一个职责面。

当前结论：

- WebEnvoy 是 Web 执行工具和运行时底座，不是 Agent 大脑。
- Syvert 是 WebEnvoy 的可选上层消费者，不是 WebEnvoy core 的组成部分。
- Provider 是执行能力的承载或适配单元，不等于 WebEnvoy core runtime，也不等于 Syvert 业务映射层。
- WebEnvoy core 的默认治理口径是 local-only；只有明确改变跨仓共享契约、provider adapter 或联合验收时，才升级 integration gate。

---

## 三者职责

| 边界对象 | 职责 | 非职责 |
|---|---|---|
| WebEnvoy core | 提供 CLI-first 的网页执行入口、浏览器内执行链路、L3/L2/L1 执行策略、最小身份/会话承载、结构化错误与诊断、能力封装/验证基础 | 不做任务规划、业务意图推理、长链路 Agent 编排、Syvert normalized result 映射、账号矩阵运营、跨产品项目管理 |
| Syvert | 作为上层系统调用 WebEnvoy，通过 CLI / JSON-RPC 等稳定输出消费执行结果，并在 Syvert 自身边界内完成业务编排、normalized result mapping、产品语义聚合 | 不反向进入 WebEnvoy core runtime，不要求 WebEnvoy 持有 Syvert 业务模型，不把 Syvert 的 mapping / project state / product workflow 写成 WebEnvoy core 契约 |
| Provider | 承载特定浏览器执行能力、runtime 能力声明、健康诊断、证据产物或平台/浏览器适配；可被 WebEnvoy 调用或治理 | 不替代 WebEnvoy 的 CLI-first core contract，不把 provider 私有 stealth/patch 细节扩写成 WebEnvoy 默认主路径，不把 Syvert normalized mapping 混入 provider runtime contract |

---

## 依赖方向

正式依赖方向只能从上层到下层：

```text
Syvert / other consumers
        |
        | CLI / JSON-RPC / structured stdout / documented evidence
        v
WebEnvoy core runtime
        |
        | provider capability / driver / browser execution surface
        v
Provider / browser-specific execution substrate
```

约束：

1. WebEnvoy core 可以为上层消费者提供稳定、机器可读的执行结果、错误、诊断和证据索引。
2. WebEnvoy core 不依赖 Syvert 仓库、Syvert 业务 schema 或 Syvert project state 才能完成本仓库执行。
3. Syvert 可以在自身边界内消费 WebEnvoy 结果并做业务映射，但该映射不回写为 WebEnvoy core 的默认输出语义。
4. Provider 能力可以被 WebEnvoy 抽象、选择、验证或登记，但 provider 私有实现不自动成为 WebEnvoy core runtime 契约。
5. 若某项工作需要改变 shared input/output、错误语义、`raw` / `normalized` / `diagnostics` / `observability`、`task_id` / `request_id` / `run_id`、跨仓执行模式或联合验收口径，必须按 integration-gated 事项处理。

---

## 交互面

WebEnvoy 对外优先暴露 CLI-first 契约：

- 命令语义稳定。
- stdout / stderr 和结果 payload 机器可读。
- 错误结构化，能区分运行时、页面、账号、风控、证据与环境失败。
- 运行标识清晰，能追踪 `run_id`、目标 profile、执行面和证据产物。

Syvert 或其他上层系统应通过这些稳定输出消费 WebEnvoy，不应绕过契约读取 WebEnvoy 内部状态。

Provider 与 WebEnvoy 的交互面按 provider / runtime 事项单独冻结，默认只包含：

- capability declaration。
- runtime health / doctor。
- evidence identity / artifact passthrough。
- driver 或 browser execution surface 的最小调用边界。

这些交互面只有在对应 issue / FR 明确进入 provider/shared-contract 范围时，才构成跨仓或跨层共享契约。

---

## integration 触发条件

以下情况保持 WebEnvoy-local：

- 只整理 WebEnvoy 架构边界、职责说明或本仓库文档入口。
- 只修改 WebEnvoy core 内部实现，不改变跨仓共享字段、错误语义、证据语义或 provider contract。
- 只说明 Syvert 是可选消费者，且不冻结 Syvert mapping schema。
- 只说明 Provider 是能力承载边界，且不改变 provider adapter / runtime contract。

对应 PR 元数据应使用：

```yaml
integration_applicable: no
integration_touchpoint: none
integration_ref: none
shared_contract_changed: no
external_dependency: none
merge_gate: local_only
contract_surface: none
joint_acceptance_needed: no
```

以下情况必须升级 integration gate：

- 明确进入 Syvert provider / WebEnvoy provider adapter。
- 改变跨仓共享输入输出。
- 改变错误码或错误语义。
- 改变 `raw` / `normalized` / `diagnostics` / `observability` 的共享语义。
- 改变 `task_id` / `request_id` / `run_id` 的共享生成、传递或消费规则。
- 改变跨仓共享执行模式、provider/shared-contract integration gate 口径或联合验收规则。
- 依赖 Syvert 或其他仓库先做、同步做或共同验收。

---

## 禁止混用场景

- 不把 WebEnvoy 扩写成负责业务规划、任务拆解或多 Agent 协调的 Agent 大脑。
- 不把 Syvert 的 normalized result、业务 schema、项目状态或产品 workflow 写进 WebEnvoy core runtime。
- 不把 Provider 私有 stealth、browser patch、driver 内部状态或健康检查细节提升为 WebEnvoy 默认核心契约。
- 不用“未来 Syvert 可能消费”作为 WebEnvoy-local PR 升级 integration gate 的理由。
- 不在边界冻结 PR 中顺手实现 provider registry、CloakBrowser provider、Syvert adapter、normalized mapping 或 live write closeout。
- 不把 WebEnvoy 内部平台适配器（如 L3 `PlatformAdapter`）与跨仓 Provider runtime / adapter contract 混写；前者服务 WebEnvoy 执行策略，后者只有在明确 provider/shared-contract 事项中才冻结。

---

## 后续事项分流

- WebEnvoy core 改动：继续按本仓库 issue / PR / review / guardian 门禁推进，默认 `local_only`。
- Syvert 消费层改动：在 Syvert 对应仓库或 integration issue 中冻结，不反向污染 WebEnvoy core。
- Provider/shared-contract 改动：必须明确 issue、contract surface、integration_ref、联合验收需要和 merge gate。
- 证据可被 adapter-consumable 地设计，但只要未冻结共享契约，就不得把“未来可消费”写成“当前 integration-gated”。
