# Reconciliation Audit

本文件定义 Loom 当前 `reconciliation audit` 的最小执行合同。

本文件当前承接：

- `#177`

## 1. 能力定位

`reconciliation audit` 用来回答三件事：

- merged PR 是否已经吸收了仍然 open 的 issue
- parent issue 是否仍与 child 的真实状态一致
- issue / PR / project 的控制面状态是否已经漂移

它只读 GitHub 控制面真相并输出审计结论，不做任何写回。

## 2. 稳定入口

- `python3 skills/shared/scripts/loom_flow.py reconciliation audit --target <repo> [--issue <n>] [--pr <n>] [--project <n>]`

## 3. 稳定 findings

第一版固定三类 finding：

- `absorbed_but_open`
  - merged PR 已进入主干，但 issue 仍 open
- `parent_drift`
  - parent issue 的开关状态与 child 的真实剩余缺口不一致
- `project_drift`
  - issue / PR 的 Project 状态与当前控制面结论不一致

每条 finding 至少表达：

- `kind`
- `severity`
- `subject`
- `evidence`
- `recommended_action`

## 4. 结果语义

`reconciliation audit` 只允许以下结果：

- `pass`
  - 没有 drift finding
- `warn`
  - 只有低严重度观察结论
- `fix-needed`
  - 已发现必须同步但尚未阻断的 drift
- `block`
  - 已发现不能继续视为 closeout-ready 的 drift，或必需输入缺失

## 5. 边界约束

- 本入口只生成审计结论，不执行 GitHub 修改
- issue tree 关系通过 GitHub GraphQL 读取，不回写到仓内 docs
- `absorbed` 的宿主证明继续由 [host-issue-binding.md](./host-issue-binding.md) 承接
- 修复 drift 的正式入口由后续 reconciliation sync 承接，本文件不提前定义写路径

## 6. 一句话结论

Loom 先用 `reconciliation audit` 明确报出 absorbed-but-open、parent drift 和 project drift，再决定是否允许后续 closeout 或进入专门 sync。
