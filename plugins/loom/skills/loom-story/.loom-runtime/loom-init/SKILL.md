---
name: loom-init
description: Loom 的 root entry。负责初始化新项目或既有仓库，并在非初始化任务下根据任务信号把执行者路由到正确场景 skill。Use when Codex needs to start a repository on top of Loom, retrofit Loom into an existing repo, or route a Loom operator to the right scenario skill.
---

# Loom Init

把本 skill 作为 Loom 的默认入口。

在以下情况先进入 `loom-init`：

- 你要初始化 Loom，或把 Loom retrofit 进既有仓库
- 你还不知道当前任务应该进入哪个场景 skill
- 你希望 Loom 先根据任务信号判断下一步入口

不要把 root skill 继续扩成第二套事实真相源。它负责先判断，再导向正确场景。

对执行者的首层说明仍应以 `loom-init` 作为 root entry。repo-local 自动化、验证、调试和宿主编排可以统一落到 repo-local `loom CLI`，但这不改变 `loom-init` 的 route 语义，也不把 CLI 升格成用户第一入口。

## Quick Path

1. 先判断当前任务属于初始化 / retrofit，还是已经进入日常执行场景。
2. 如果用户已经显式指定场景 skill，显式调用优先，直接进入该 skill。
3. 如果没有显式指定 skill，由 `loom-init` 根据任务信号做路由。
4. 如果信号不足、冲突，或缺少稳定执行所需的最小输入，保留在 `loom-init`，并要求最小补充信号。

## Route Summary

显式指定 skill 时，显式调用优先。

未显式指定 skill 时，`loom-init` 按任务信号做隐式路由。

默认场景对应关系如下：

- 初始化 / retrofit / 新项目接入
  - 路由到 `loom-adopt`
- 接手事项 / 恢复上下文 / 继续推进
  - 路由到 `loom-resume`
- review 前检查 / 进入 review 前预检
  - 路由到 `loom-pre-review`
- issue tree / delivery planning / Phase、FR、Work Item、PR 切分与依赖规划
  - 留在 `loom-init`，输出 planning 结果；不要误路由到 build、review 或 merge-ready
- formal spec review / spec 是否通过 / `spec gate`
  - 路由到 `loom-spec-review`
- 正式 review / 语义审查 / review 结论
  - 路由到 `loom-review`
- 交接 / 回写停点 / 移交当前事项
  - 路由到 `loom-handoff`
- 清理现场 / retire 当前事项
  - 路由到 `loom-retire`
- merge-ready / 最终放行前预检 / GitHub controlled merge 前置检查
  - 路由到 `loom-merge-ready`

如果信号不足或同时命中多个场景，不要猜测。回退到 `loom-init`，并要求最小补充信号。

完整场景路由规则见 [../route-matrix.md](../route-matrix.md)。

## Planning Boundary

当用户要求规划 issue tree、拆 Phase / FR / Work Item、安排 PR 切分、梳理 blocked-by/blocks，或把 story / roadmap / governance goal 转成执行树时，`loom-init` 应输出 planning 结果。

planning 结果消费以下合同：

- `plugins/loom/skills/shared/references/templates/delivery-planning.md`
- `plugins/loom/skills/shared/references/templates/issue-tree-plan.md`
- `plugins/loom/skills/shared/references/templates/pr-slicing.md`
- `skills/shared/references/adoption/github-profile.md`

planning 只回答“应该怎么拆”和“应该落到哪些 host carrier”。它不能宣布实现完成，不能替代 `Work Item`、`spec.md`、`plan.md`、review、merge-ready 或 closeout，也不能在用户只要求规划时直接创建 GitHub issue / PR。

如果目标已经收敛为单一明确 Work Item 且用户要求实现，进入 `loom-build`。如果用户要求 formal spec review，进入 `loom-spec-review`。如果用户要求 implementation review，进入 `loom-review`。

## Installed Entry Surface

当前安装态中的最小可执行入口为：

- `loom init bootstrap --target <repo> [--intent observe-only|skill-install-only|attach-only|light-governance|execution-control|strong-governance]`
- `loom init verify --target <repo>`
- `loom init fact-chain --target <repo>`
- `loom route --target <repo> [--skill <id>] [--task "<request>"]`

安装态或 repo-local 开发态可以把这些 `loom ...` 动作映射到底层 `scripts/...` 或 `tools/...` carrier；首层用户入口仍然是 `loom-init` 这个 skill。

`--intent` 用来表达采用意图，而不是仓库静态分类。未显式给出 intent 时，dry-run 仍会输出推荐路径、风险摘要和计划写入载体；如果实际写入会创建重执行控制面，必须先显式选择 `execution-control` 或 `strong-governance`。

每个 intent 会收敛到一个 `scaffold_profile`。`observe-only` 与 `skill-install-only` 不写 adoption carriers；`attach-only` 只写 companion/read surfaces，并显式禁止 `.loom/work-items/**`、`.loom/progress/**`、`.loom/status/current.md`、`.loom/reviews/**`、`.loom/specs/**` 等 Loom-authored truth carriers；`light-governance` 写 companion、review guidance 与 PR 最小闭环但不写 Loom-owned work/progress/status/spec carriers；`execution-control` 与 `strong-governance` 才写 Loom-owned execution carriers。

当静态仓库信号支持多个合理接入路径，或显式 intent 与信号默认值不同，bootstrap 输出必须包含 `decision_prompt` 与 `adoption_decisions`。prompt 必须说明仓库形态、候选 intent、信号推荐默认、风险差异、计划写入目标和验证入口；write 模式如果缺少必要 intent 且会创建重执行控制面，必须 fail closed，不得先落盘再要求补决策。

## 1. 读取顺序

按以下顺序读取材料：

- 目标仓库中的 `AGENTS.md`、`README`、流程文档、PR 模板、issue 模板
- Loom 根文档：
  - `AGENTS.md`
  - `README.md`
- Loom 核心规则：
  - `skills/shared/references/governance/principles.md`
  - `skills/shared/references/governance/github-delivery-funnel.md`
  - `skills/shared/references/governance/review-model.md`
  - `skills/shared/references/governance/spec-implementation-separation.md`
  - `skills/shared/references/governance/maturity-and-closing.md`
  - `skills/shared/references/adoption/github-profile.md`
  - `skills/shared/references/adoption/routing-and-checkpoints.md`
  - `skills/shared/references/adoption/lightweight-retrofit-default.md`
  - `skills/shared/references/adoption/deep-existing-repo-default.md`
  - `skills/shared/references/adoption/loom-surfaces-version-control.md`
- `skills/shared/references/harness/recovery-model.md`
- `skills/shared/references/harness/fact-chain-contract.md`
- `skills/shared/references/harness/item-context-contract.md`
- `skills/shared/references/harness/status-surface-contract.md`
- `skills/shared/references/harness/status-surface.md`
- `skills/shared/references/harness/work-item-contract.md`
- `skills/shared/references/harness/workspace-model.md`
- `skills/route-matrix.md`
- `skills/loom-init/references/input-signals.md`
- `skills/shared/references/harness/automation-frontload.md`
- `skills/shared/references/harness/workspace-and-purity.md`
- `skills/shared/references/harness/execution-context.md`
- `skills/shared/references/templates/spec-suite.md`
- `skills/shared/references/templates/execution-breakdown.md`
- `skills/shared/references/harness/task-carrier-contract.md`
- `skills/shared/references/templates/evidence-map.md`
- `skills/shared/references/templates/consistency-analysis.md`
- `skills/shared/references/templates/spec-template.md`
- `skills/shared/references/templates/implementation-contract-template.md`
- `skills/shared/references/templates/pull-request.md`
- `skills/loom-init/references/output-contract.md`

只有在事项带有明显不确定性、需要进一步分层时，才补读：

- 由宿主额外提供的候选 adoption 材料；不要假设安装态自带候选层全文

## 2. 建立初始化问诊

优先从仓库现状推断答案，只在关键信息缺失时再问用户。

使用 [references/input-signals.md](./references/input-signals.md) 组织问诊。必须先完成最小必判字段的收集，再做路径判断。

问诊结果必须收成以下结论，而不是停留在零散观察：

- 初始化场景
  - `新项目`
  - `小型既有仓库`
  - `执行前既有仓库`
  - `复杂既有仓库`
- 装配强度
  - `轻量`
  - `标准`
  - `强化`
- 默认接入方式
  - 根级重写
  - `companion docs`
- 恢复形态
  - `checkpoint-lite`
  - 标准恢复形态
- 首批执行入口与验证入口
- 初始 clean state 目标

## 3. 做出装配判断

不要输出抽象“建议采用 Loom”。必须把判断落成“判定信号 -> 默认动作”的装配决策。
初始化结果还必须明确新控制面如何落位：`Work Item` 唯一入口、`spec gate`、`gate chain`、`status control plane`、`maturity upgrade`、`GitHub controlled merge`。

### 3.1 新项目

当仓库尚未形成稳定工程基线、目标是建立最小起步结构时，判为 `新项目`。

默认动作：

- 采用最小装配
- 不预装重 harness
- 只建立后续可升级入口
- 只引入当前能支撑持续演进的最小治理、模板与验证入口
- 恢复形态默认从轻量开始；若当前没有跨多轮承接需求，可以只声明升级条件，不提前铺满恢复工件

### 3.2 小型既有仓库

当仓库满足 [../shared/references/adoption/lightweight-retrofit-default.md](../shared/references/adoption/lightweight-retrofit-default.md) 的默认条件时，判为 `小型既有仓库`。

默认动作：

- 直接消费 `lightweight retrofit default`
- 默认采用 `companion docs` 接入
- 默认装配：
  - `WORKFLOW`
  - `code_review`
  - `spec_review`
  - 最小 PR 模板
  - repo companion 与 bootstrap metadata
  - review guidance / spec-review guidance
- 默认不装配：
  - 完整 recovery 模型
  - work item 合同
  - 状态面
  - profile 分层
  - 重 harness
  - formal spec suite
- 若需要轻量跨轮承接，默认使用 `checkpoint-lite`
- 即使本轮不装配标准恢复或状态面，也必须写清：
  - issue / PR 中谁是恢复主入口
  - 哪个载体承接当前停点、下一步、阻断项与最近验证摘要
- 只要缺少统一验证入口，或仓库主产物本身是共享 contract、shared skill 或 governance module，就不得继续套用这条轻量路径

### 3.2.1 执行前既有仓库

当仓库已有 `AGENTS.md`、`README.md`、`VISION.md`、`docs/**` 等文档事实源，但尚无代码、CI、测试或统一验证入口时，分类为 `pre-execution-existing`。

该分类必须在输出中拆开说明：

- 文档事实源成熟度
- 执行面成熟度
- 治理载体成熟度

`pre-execution-existing` 不直接决定生成强度。默认仍保持 lightweight retrofit / light-governance；只有显式 `adoption_intent = execution-control | strong-governance` 时，才允许进入重执行控制面。

产品或领域文档中的 `CONTRACT_MODEL.md`、`DOMAIN_MODEL.md` 不等同于工程共享 contract、runtime schema 或 shared governance module。

### 3.3 复杂既有仓库

既有仓库只要不满足轻量条件，或已经出现明显恢复痛点、共享边界风险、现场混杂、review 过载、统一验证入口缺失中的任一高强度信号，就判为 `复杂既有仓库`。

默认动作：

- 若根规则清晰、验证入口稳定且命中 `merge_review_semantic_overload`，优先进入 `deep-existing-repo` / `recognize-and-attach`
- 否则进入更完整装配
- 显式纳入：
  - 恢复主入口
  - 执行上下文
  - `Work Item` 或等价唯一执行入口
  - `status control plane`
  - 隔离现场与纯度规则
- 对涉及共享契约、运行模型、高风险核心抽象的事项，默认纳入正式规约套件与前移 checkpoint
- 对恢复成本明显升高的事项，默认从 `checkpoint-lite` 升级到标准恢复形态

当命中 `deep-existing-repo` 时，额外保持以下纪律：

- 保留 root rules
- 保留 retained host actions
- 保留 repo-native carriers
- 第一轮不生成 Loom-owned `work-item` / `progress` / `status-surface` / `spec` placeholder

## 4. 输出初始化结果

始终使用 [references/output-contract.md](./references/output-contract.md) 的结构输出结果。

输出中必须显式写出：

- 初始化场景
- 装配强度
- 恢复形态
- 首批执行入口
- 验证入口
- 事实链 carrier 定位
- 初始 clean state
- 本轮暂不装配能力的承接方式

如果用户要求实际初始化仓库，按以下顺序执行：

1. 建立根级规则入口或 `companion docs` 入口
2. 建立治理与 adoption 最小工件
3. 建立 harness 与模板最小工件
4. 建立首批 issue / checkpoint / 验证路径
5. 核对输出是否已经形成可继续执行的初始化产物模型

## 5. 处理三类场景的差异

### 5.1 新项目

- 直接给出最小装配方案
- 优先保证后续能持续演进
- 避免把未来可能需要的能力提前全部引入
- 不默认铺满重 harness，只写清升级入口与触发条件

### 5.2 小型既有仓库

- 默认走 `lightweight retrofit default`
- 仅当仓库真正满足轻量路径前提时，才沿用该默认策略
- 先指出当前结构性问题
- 再给出渐进 adoption 顺序
- 明确哪些问题先通过规则解决，哪些问题后续再脚本化
- 不要把 recovery、work-item、status-surface 当成第一轮默认必装项
- 若走 `checkpoint-lite`，必须写清 issue / PR 对停点、下一步、阻断项、验证摘要的承接方式

### 5.3 复杂既有仓库

- 先指出导致不能走轻量路径的升级信号
- 再给出更完整装配顺序
- 必须写清正式执行入口、恢复主入口、状态读取入口与现场绑定方式
- 若涉及共享边界或高风险实现承诺，必须写清正式规约工件与 checkpoint 承接关系

## 6. 验证标准

只有当以下条件同时满足时，才把初始化视为完成：

- 输出结果能解释为什么是这组能力，而不是另外两条路径
- 输出结果能映射回 Loom 当前文档中的明确规则
- 首批工件、首批事项、恢复形态、验证入口与初始 clean state 可以直接承接后续执行
- 明确保留了“现在不做什么”，且写清升级触发条件
- 对未装配能力给出了明确承接方式，而不是留给临场经验补齐
