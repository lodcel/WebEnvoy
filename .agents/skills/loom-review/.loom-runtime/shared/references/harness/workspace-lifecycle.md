# Workspace Lifecycle

本文件定义 Loom 当前工作现场生命周期与 `purity-check` 的执行侧合同。

字段归属与读取顺序仍以 [fact-chain-contract.md](./fact-chain-contract.md) 为准。
工作现场最小模型与纯度目标分别见 [workspace-model.md](./workspace-model.md) 与 [workspace-and-purity.md](./workspace-and-purity.md)。

## 1. 能力定位

Loom 当前日常执行 CLI 至少提供以下入口：

- `workspace create`
- `workspace locate`
- `workspace attach`
- `workspace cleanup`
- `workspace retire`
- `purity-check`

这些入口只消费：

- `init-result` 的 locator truth
- `work item` 的 `workspace_entry`
- `work item` 的 `recovery_entry`
- 恢复主入口中的动态执行事实
- 状态面中的派生汇总

它们不得新增第二套执行状态真相。

## 1.1 生命周期合同矩阵

| 阶段 | 输入重点 | 输出重点 | 失败默认语义 | 回退去向 |
| --- | --- | --- | --- | --- |
| `create` | `workspace_entry`、当前事项、当前 checkpoint | 现场已建立或已确认可用 | `block` | 回到 `workspace_entry` / 事实链修复 |
| `locate` | 当前事项、`workspace_entry`、`recovery_entry` | 现场定位、恢复入口、checkpoint、purity 快照 | `block` | 回到 `create` 或事实链修复 |
| `attach` | 已存在的 `workspace_entry`、当前事项、恢复入口 | 现场定位与绑定结论 | `block` | 回到 `workspace_entry` / 宿主现场声明修复 |
| `resume`（由恢复模型承接） | `locate` 输出 + recovery 主入口 | 下一步执行上下文 | `block` | 回到 recovery 回写修复 |
| `handoff`（由恢复模型承接） | `locate` 输出 + recovery 主入口 + ledger | 最小交接字段与 locator set | `block` | 回到 recovery / ledger 修复 |
| `cleanup` | Loom-owned 残留路径、现场纯度 | 仅 Loom 残留被清理 | `block` | 回到人工分流与纯度修复 |
| `retire` | `cleanup` 结果 + recovery 主入口 | `current_checkpoint: retired` | `block` / `fallback` | 回到 `cleanup` 或 recovery 回写 |
| `execution-boundary` | worker backend 读面、run/stop 事件 | 边界观察结果 | `block` | 回到宿主 adapter / worker evidence 修复 |

说明：

- `resume` 的入口语义由 [recovery-model.md](./recovery-model.md) 承接，本文件只定义它与 `locate` 的边界关系。
- `handoff` 只消费 recovery / ledger 合同并输出回写清单，不重新 author 第二份停点真相。
- `run` / `stop` 只表达 execution-boundary 的读面或事件语义；Loom v0.7 不引入 worker daemon。
- `remove` 不是 Loom core 生命周期命令；目录或 git worktree 删除继续属于宿主生命周期，Loom 只通过 cleanup / retire 表达可退休边界。

## 2. 统一输入与输出

### 2.1 输入

所有生命周期入口至少接受：

- `--target`
  - 目标仓库根目录
- `--item`
  - 可选；若提供，则必须与事实链中的当前事项一致

机械读取顺序固定为：

1. 读取 `init-result`
2. 读取 `work item`
3. 读取恢复主入口
4. 需要汇总时读取状态面

### 2.2 输出

所有生命周期入口都应返回 JSON，至少表达：

- 当前事项
- 工作现场入口与定位结果
- 恢复入口
- 当前 checkpoint
- 当前 purity 结论
- `result`
- `summary`
- `missing_inputs`
- `fallback_to`

## 3. Workspace Create

### 3.1 语义

`workspace create` 只负责建立或验证 `workspace_entry` 对应的现场语义。

它可以：

- 验证 `workspace_entry` 能稳定定位
- 在 `workspace_entry` 指向仓库内相对路径且目录缺失时创建该目录

它不得：

- 自动创建宿主平台特定 worktree
- 额外记账另一份现场绑定真相
- 绕过事实链直接写入“当前事项”

### 3.2 失败语义

以下情况至少应返回 `block`：

- `workspace_entry` 越出目标仓库边界
- 事实链断裂
- 当前现场存在无关改动或脏状态
- 当前工作现场已被多个活跃事项复用

## 4. Workspace Locate

### 4.1 语义

`workspace locate` 至少返回：

- 当前事项 `item`
- 当前工作现场 `workspace`
- 恢复入口 `recovery`
- 当前 checkpoint `checkpoint`
- 当前 purity `purity`

定位规则固定为：

- 先用 `init-result` 找到当前事项与 carrier locator
- 再由 `work item.workspace_entry` 定位现场
- 再用 `work item.recovery_entry` 读取动态状态
- 最后以 status-surface 给出派生汇总，不反向覆盖 recovery authored 值

### 4.2 失败语义

以下情况至少应返回 `block`：

- `workspace_entry` 无法定位
- 当前事实链无法读通
- 现场语义虽能定位，但当前 purity 已不适合继续执行

## 4.3 Workspace Attach

`workspace attach` 是 `locate` 的绑定语义变体，用于 repo 已有现场已经存在、Loom 只需要确认 `workspace_entry` 与当前事项可恢复绑定的路径。

它可以：

- 读取并确认 `workspace_entry`
- 返回与 `locate` 相同的 workspace / recovery / checkpoint / purity 信息
- 暴露 lifecycle expectations 中的 attach-only 语义

它不得：

- 创建目录或 git worktree
- 删除目录或临时路径
- 接管 branch、PR、git worktree 或 worker backend 的宿主生命周期

## 5. Workspace Cleanup

### 5.1 语义

`workspace cleanup` 只允许清理 Loom 自己产生的临时残留。

第一版最小能力只覆盖带有显式 Loom ownership marker 的 temporary residue。候选必须位于 Loom temporary roots，例如：

- `.loom/tmp`
- `.loom/.tmp`
- `.loom/runtime/tmp`
- `.loom/runtime/cache`
- `.loom/flow/tmp`

每个可删除目录必须带有 `.loom-owned` marker；未标记内容必须保留，并使 cleanup 返回 `block`。

`review run` 落下的 `.loom/runtime/review/` evidence 不属于 cleanup 的默认删除面。
它是可消费的运行时审查证据；若要进入长期真相，仍必须回写到正式 `review record`。

### 5.2 失败语义

以下情况至少应返回 `block`，且不得自动删除内容：

- 工作区存在无关改动
- 工作区存在用户未分流的正式变更
- 将要删除的路径含有已跟踪文件
- Loom temporary root 内存在未标记内容
- 事实链、现场绑定或事项边界已经失真

## 6. Workspace Retire

### 6.1 语义

`workspace retire` 的顺序固定为：

1. 先执行 cleanup 语义
2. 再将恢复主入口中的 `Current Checkpoint` 回写为 `retired`
3. 同步回写状态面中的派生 `Current Checkpoint`

它不默认删除现场目录。

### 6.2 成功语义

`retire` 成功后，至少应满足：

- 当前事项仍可被事实链读到
- 恢复主入口的 `Current Checkpoint` 为 `retired`
- 状态面与恢复主入口一致
- 后续 `locate` 不会再把该现场误判为活跃执行现场

## 7. Purity Check

### 7.1 最小硬失败项

`purity-check` 第一版至少对以下情况给出硬失败：

- 事实链断裂
- 当前现场与 `workspace_entry` 不匹配
- 工作区存在未分流残留
- 当前现场被多个活跃事项共享，明显不再是单一目标

### 7.2 报告但暂不硬失败的项

以下项第一版只做报告，不作为硬失败：

- branch purity
- PR purity

这些项继续由宿主平台拥有生命周期；Loom 只通过 [host-lifecycle-boundary.md](./host-lifecycle-boundary.md) 与 `merge-ready` / closeout 入口消费其边界结果，不改变生命周期命令的硬失败口径。

## 8. 执行入口与 gate 对齐

生命周期入口固定为：

- `python3 tools/loom_flow.py workspace create --target <repo> --item <id>`
- `python3 tools/loom_flow.py workspace locate --target <repo> --item <id>`
- `python3 tools/loom_flow.py workspace attach --target <repo> --item <id>`
- `python3 tools/loom_flow.py workspace cleanup --target <repo> --item <id>`
- `python3 tools/loom_flow.py workspace retire --target <repo> --item <id>`
- `python3 tools/loom_flow.py purity-check --target <repo> [--item <id>]`

`loom_init verify` 与 `loom_check` 会复用同一组入口验证结果语义。
