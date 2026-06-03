# External Orchestrator Interop

本文件定义外部 orchestrator 如何消费 Loom，而不把 Loom 变成 scheduler 产品。

它承接 `#535` 的外部 interop 边界。完整事实链仍以
[fact-chain-contract.md](./fact-chain-contract.md) 为准。

## 1. 目标

外部 orchestrator 可以做四件事：

- 读取当前 `Work Item`
- attach 已存在的 workspace 语义
- 通过 recovery writeback 写回执行进展
- 只读消费 status 与 gates

它不得做三件事：

- 创建第二状态面
- author gate / review / status truth
- 接管 branch、PR、git worktree 或 worker lifecycle

## 2. Work Item 读取顺序

外部 orchestrator 必须按同一条事实链读取：

1. `init-result`
   - 只用于 locator discovery，不承载执行真相
2. `Work Item`
   - 读取 `item_id`、目标、范围、执行路径、workspace / recovery / review / validation locator
3. recovery entry
   - 读取当前 checkpoint、停点、下一步、阻断项和最近验证摘要
4. status control plane
   - 只作为派生汇总和 provenance 读面
5. host mirror / retained result
   - 只作为绑定、镜像或 evidence 消费

外部 orchestrator 不得跳过 `Work Item`，也不得从 PR、tracker、release index 或
merge commit 反推执行入口。

## 3. 非法入口

以下入口必须 fail closed：

- PR-only
- tracker-only
- release-only
- merge-commit-only
- 缺少 `Work Item` 最小字段
- `Work Item` 与 host binding 无法回链到同一事项

结果必须使用现有 taxonomy：

- `gate_failure.missing_prerequisite_gate`
- `gate_failure.binding_failure`

回退方向只允许指向：

- `work_item`
- `admission`
- `binding_repair`

不得指向 orchestrator 私有队列、retry state、tracker state 或 scheduler action。

## 4. Locator Declaration

成熟既有仓库可以通过 `.loom/companion/interop.json` 的
`external_orchestrators` 声明外部 orchestrator 读面。

这些声明只定位可读 evidence / adapter surface：

- `id`
- `summary`
- `surfaces`
- `operations`
- `locator`
- `owner`
- `requirement`
- `fallback_to`

`operations` 至少允许：

- `work_item_read`
- `workspace_attach`
- `recovery_writeback`
- `status_read`
- `gate_read`

`status_read` 与 `gate_read` 必须消费同一 fact-chain，不得新增第二状态面。

## 5. Workspace Attach

外部 orchestrator 可以消费或调用 Loom `workspace attach` 语义来确认既有现场可用。

它可以读取：

- 当前 `Work Item`
- `workspace_entry`
- `recovery_entry`
- attach / locate 输出中的 purity 与 checkpoint 摘要

它不得：

- 创建目录
- 删除目录
- 创建或删除 git worktree
- 创建、更新或关闭 branch / PR
- 接管 worker backend lifecycle

attach 失败只能回退到 `workspace_entry`、`admission` 或宿主现场声明修复，不得回退到
orchestrator 私有 action。

## 6. Recovery Writeback

外部 orchestrator 写回执行进展时，只能通过既有 `recovery writeback` 入口写恢复主入口。

允许写回的 authored 字段固定为：

- `current_checkpoint`
- `current_stop`
- `next_step`
- `blockers`
- `latest_validation_summary`
- `recovery_boundary`
- `current_lane`

写回后，status control plane 只能重新派生或刷新；外部 orchestrator 不得直接写 status、
gate、review、validation、host action 或 closeout authored fields。

## 7. Status / Gate Consumption

外部 orchestrator 可以只读消费 `status control plane v2` 与现有 gate chain。

它读取的状态必须与 Loom 本地入口同源：

- `schema_version` 继续使用 `loom-governance-status/v2`
- `result`、`current_gate`、`classifications`、`missing_inputs`、`head_binding`
  与 `gate_chain` 来自同一个 status control plane
- `provenance` 继续指向 Work Item、recovery entry、review / checkpoint / host mirror
  等既有来源

外部 orchestrator 视图只能是 consumer view。它可以裁剪字段以便消费，但不得定义
新的 status schema、不得 authored `pass | block`、不得替换 gate chain。

当 status/gate 读取无法消费时，回退只能指向 Loom checkpoint 或 gate 前置修复，例如：

- `current_checkpoint`
- `spec_gate`
- `build_gate`
- `review_gate`
- `merge_gate`
- `admission`
- `binding_repair`

不得回退到 scheduler 私有 action、retry queue、tracker state 或 orchestrator-owned
decision。

## 8. Truth Boundary

`external_orchestrators` 不得承载：

- scheduler state
- attempt ownership
- authored progress
- `next_step`
- `blockers`
- `latest_validation_summary`
- status truth
- gate verdict
- review verdict
- validation summary
- host action result
- closeout basis

这些字段若出现在 external orchestrator locator payload 中，必须被视为 truth
pollution，并阻断 required 声明。

## 9. 非目标

- 不提供默认 daemon
- 不定义 tracker polling 产品
- 不定义自动 retry / backoff 状态机
- 不复制任何外部 orchestrator 的私有状态模型
