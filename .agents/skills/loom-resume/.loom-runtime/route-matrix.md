# Skills Route Matrix

本文定义 `loom-init` 作为 root entry 时的显式 / 隐式路由矩阵。

## 1. 优先级

1. 显式 skill 名称调用优先
2. 若无显式 skill，则按任务信号做隐式路由
3. 若无法稳定判断，回退到 `loom-init`，输出最小补充信号

## 2. 场景矩阵

| 场景 | 任务信号 | 目标 skill | 依赖 CLI |
| --- | --- | --- | --- |
| 初始化 / retrofit | 初始化、新项目接入、既有仓库 retrofit、引入 Loom | `loom-adopt` | `loom-init/scripts/loom-init.py bootstrap\|verify\|fact-chain` |
| 恢复执行 | 接手当前事项、恢复上下文、问下一步、继续推进 | `loom-resume` | `loom-resume/scripts/loom-resume.py flow resume` |
| 执行 / build | 实现当前事项、执行 build、implementation round、集成 subagent 输出、检查 repeated blocker | `loom-build` | `loom-build/scripts/loom-build.py flow build` |
| story intake | vision、roadmap、notes、host issue、产品讨论转 User Story；story readiness；actor specificity；scenario coverage | `loom-story` | `loom-story/scripts/loom-story.py flow story` |
| review 前统一检查 | review 前检查、进入 review、确认是否可 review、确认 gate chain 是否已到 review gate | `loom-pre-review` | `loom-pre-review/scripts/loom-pre-review.py flow pre-review` |
| formal spec review | formal spec review、spec review、确认 spec 是否通过、审查 formal spec 路径、确认 spec gate | `loom-spec-review` | `loom-spec-review/scripts/loom-spec-review.py flow spec-review` + `shared/scripts/loom_flow.py review run --review-file .loom/reviews/<item>.spec.json` + `shared/scripts/loom_flow.py review record --review-file .loom/reviews/<item>.spec.json --kind spec_review` |
| 正式 review | 正式 review、语义审查、输出 review 结论、code review、implementation review、确认 review gate | `loom-review` | `loom-review/scripts/loom-review.py flow review` + `shared/scripts/loom_flow.py review run` + `loom-review/scripts/loom-review.py review record` |
| 交接 | 交接、回写停点、移交当前事项 | `loom-handoff` | `loom-handoff/scripts/loom-handoff.py flow handoff` |
| 清理 / retire | 清理现场、退休现场、结束当前事项现场 | `loom-retire` | `loom-retire/scripts/loom-retire.py workspace cleanup\|retire` |
| merge 前放行 | merge-ready、最终放行前预检、确认是否可合并、确认 GitHub controlled merge 前置是否齐全 | `loom-merge-ready` | `loom-merge-ready/scripts/loom-merge-ready.py flow merge-ready` |

## 3. 强治理控制面

`skills/` 层固定消费以下共享控制面，而不是在各 skill 中重复发明：

- `Work Item`
  - 唯一正式执行入口
- `User Story`
  - 上游 product-value 输入；只能被 `spec.md` / `plan.md` 消费，不替代执行入口或恢复状态
- `spec gate`
  - formal spec 路径的唯一放行结果
- `gate chain`
  - 固定为 `spec gate -> build gate -> review gate -> merge gate`
- `status control plane`
  - 统一读取 `Work Item`、recovery、review records、merge gate 与宿主控制面
- `maturity upgrade`
  - profile maturity 固定按 `light -> standard -> strong`，事项成熟度由 governance state machine 承接
- `GitHub controlled merge`
  - merge 由宿主控制面执行；Loom 只消费 required checks、review、head 绑定与 merge gate 结果

## 4. `governance_surface` 公共合同

以下三类入口对外暴露的公共治理读面固定命名为 `governance_surface`：

- `loom-init`
  - 输出初始化后的治理承接面，说明 Issue、PR、规则、规格、执行工件分别由谁承接
- `loom-adopt`
  - 不另造新合同，直接复用 `loom-init` 的 `governance_surface`
- `loom-resume`
  - 输出当前事项的治理承接面摘要，但不回写或复制 authored 真相

稳定约束：

- 只读，不新增第二套治理状态源
- 字段名保持：
  - `repository_mode`
  - `loom_state`
  - `carrier_summary`
  - `execution_entry`
  - `validation_entry`
  - `review_merge_surface`
  - `github_control_plane`
  - `summary`
  - `missing_inputs`
- `carrier_summary` 子项固定为 `work_item`、`recovery`、`review`、`status_surface`、`spec_path`、`plan_path`
- 只回答 locator 与职责边界，不复制实时停点、下一步、阻断项、验证摘要
- 若需要回答 gate 进度，统一通过 `review_merge_surface` 或 `status control plane` 读取，不在 `governance_surface` 并行维护 authored gate 状态

## 5. fallback 语义

出现以下任一情况时，root skill 不做猜测，直接回退到 `loom-init`：

- 没有明确 skill 名称，也没有稳定任务信号
- 同时命中多个场景，且无法根据任务语义收敛为单一路由
- 目标仓库或事项标识缺失，无法稳定执行下游入口

回退输出必须至少包含：

- `selected_skill: "loom-init"`
- `result: "fallback"`
- `missing_inputs`
- `fallback_to: "loom-init"`
