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
| delivery planning / issue-tree plan | 规划 issue tree、拆 Phase / FR / Work Item、PR 切分建议、依赖 / blocked-by 关系、把 story / roadmap / governance goal 转成执行树；用户明确要求“先规划不要创建” | `loom-init` 输出 planning 结果 | 无专用 CLI；消费 `plugins/loom/skills/shared/references/templates/delivery-planning.md`、`plugins/loom/skills/shared/references/templates/issue-tree-plan.md`、`plugins/loom/skills/shared/references/templates/pr-slicing.md` 与 GitHub profile mapping |
| 执行 / build | 实现当前事项、执行 build、implementation round、集成 subagent 输出、检查 repeated blocker | `loom-build` | `loom-build/scripts/loom-build.py flow build` |
| story intake | vision、roadmap、notes、host issue、产品讨论转 User Story；story readiness；story business confirmation；业务语义确认或修订；actor specificity；scenario coverage | `loom-story` | `loom-story/scripts/loom-story.py flow story` |
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
  - 上游 product-value 输入；只能被 `spec.md` / `plan.md` 消费，不替代执行入口或恢复状态；业务语义确认只覆盖 actor、capability、outcome、business value、acceptance scenarios 与 out of scope
- `delivery planning`
  - 将 story、roadmap、product context 或 governance goal 拆成 `Phase / FR / Work Item / PR` 规划；输出 issue-tree plan 或规划判断，不替代 `Work Item`、recovery、review、merge-ready 或 closeout
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

## 4. Formal Spec Suite Path 消费边界

`loom-story`、`loom-spec-review`、`loom-build`、`loom-pre-review` 与 `loom-merge-ready`
必须消费 `plugins/loom/skills/shared/references/templates/spec-suite.md` 已定义的
`full suite` / `minimal suite` path decision，不得在 skill 中重新定义 suite
工件、evidence-map、consistency-analysis 或 gate-chain 语义。

Scenario skills 消费 suite readiness 时必须读取 `loom suite ... --json`
输出；缺少 repo-local CLI JSON 时 fail closed，不在 skill runtime 中重新实现
suite path、evidence-map 或 task-carrier 判定。

固定消费规则：

- `full path` 表示当前事项选择完整 formal spec suite。后续 skill 必须能读取
  suite path locator、必需工件 locator、条件工件的适用性判断、provenance，以及
  #1018/#1019 合同声明适用时的 evidence-map、consistency-analysis 与 gate-chain
  消费结论。
- `full path` 缺少必需工件、locator、provenance 或当前 gate 所需 evidence 时，
  `loom-spec-review`、`loom-build`、`loom-pre-review` 与 `loom-merge-ready`
  必须 fail-closed，返回 `block` 或带明确 `fallback_to` 的 `fallback`。
- `minimal path` 是合法路径，但只能通过带 rationale、consumer boundary 和
  recheck condition 的 `not_applicable` 消费 full path 附加工件；无理由缺口仍是
  `missing`，不得被当成 `not_applicable`。
- `deferred` 不等于 `not_applicable`。deferred source/generated sync、CLI surface
  或后续 FR 工作只能作为后续事项输入，不得被当前 skill 当成 completed truth。
- GitHub issue、sub-issue、Project item、PR、checklist 或 repo-local carrier 只按
  GitHub task carrier profile 读取 locator、state、provenance 和冲突状态；不得替代
  Work Item、spec suite、review record 或 merge-ready truth。
- 安装态 skill 读取同一组共享引用：
  `shared/references/templates/spec-suite.md`、
  `shared/references/templates/execution-breakdown.md`、
  `shared/references/harness/task-carrier-contract.md`、
  `shared/references/templates/evidence-map.md` 与
  `shared/references/templates/consistency-analysis.md`。这些引用是 docs 权威文件的
  source skills 副本，`tools/skills_surface.py check` 必须同时发现 docs -> source
  reference drift 和 source -> generated skills drift。

场景到消费边界：

| Skill | full path 消费 | minimal path 消费 |
| --- | --- | --- |
| `loom-story` | 输出 Story Readiness / Business Confirmation locator，供 `spec.md` / `plan.md` 和 suite path decision 消费 | 对纯治理、维护、格式、链接类事项输出 `not_applicable` rationale、consumer boundary、recheck condition |
| `loom-spec-review` | 消费 suite path、formal spec、plan、必需工件、evidence-map / consistency-analysis 适用性；缺必需输入时 fail-closed | 只接受有效 `not_applicable` rationale；否则回退到 spec shaping / suite path 修正 |
| `loom-build` | 在 build readiness 前消费 `suite validate` 与 `suite carrier validate` JSON，包括 full suite readiness、scenario-to-validation mapping、task carrier profile locator | 合法跳过附加工件，但必须保留 rationale 和替代验证入口 |
| `loom-pre-review` | 在 review 前消费 full suite locator、evidence-map freshness、consistency-analysis blocking/advisory 分类 | 缺口必须是有效 `not_applicable`，否则阻断 review admission |
| `loom-merge-ready` | 在 merge gate 消费 reviewed full suite evidence、gate-chain、PR head / reviewed head / validation freshness | 只把有效 minimal path rationale 当作合法跳过，不把 missing 或 deferred 当作 ready |

## 5. `governance_surface` 公共合同

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

## 6. Planning 边界

`delivery planning` 是 `loom-init` 的路由结果，不是 build、review 或 merge-ready 的前置硬门禁。

进入 planning 的信号：

- 用户要求拆 issue tree、Phase、FR、Work Item、PR 计划或依赖关系
- 当前目标还没有稳定的执行单元，需要判断应该拆成几个 FR / Work Item / PR
- story、roadmap、产品上下文或治理目标需要转成可执行 issue tree
- 用户明确要求“先规划”“不要创建”“规划后续 issue / PR”

不要进入 planning 的信号：

- 当前已经有单一明确 Work Item 且用户要求实现，进入 `loom-build`
- 用户要求 formal spec review，进入 `loom-spec-review`
- 用户要求 implementation/code review，进入 `loom-review`
- 用户要求 merge-ready 或合并前检查，进入 `loom-merge-ready`
- 用户只是在整理 actor、capability、outcome、business value 或 acceptance scenarios，进入 `loom-story`

planning 输出只能包含：

- 是否需要 Phase，以及复用还是新建
- FR / Work Item / PR 切分建议
- `blocked-by/blocks` 依赖规划
- deferred / not_applicable 判断
- host carrier mapping，包括 GitHub parent/sub-issue、Project item、blocked-by/blocks 与 PR locator

planning 输出不能声明某个 Work Item 已完成，不能替代 `spec.md` / `plan.md`，不能替代 review、merge-ready、closeout，也不能直接改写 GitHub，除非用户明确要求执行创建或更新动作。

## 7. fallback 语义

出现以下任一情况时，root skill 不做猜测，直接回退到 `loom-init`：

- 没有明确 skill 名称，也没有稳定任务信号
- 同时命中多个场景，且无法根据任务语义收敛为单一路由
- 目标仓库或事项标识缺失，无法稳定执行下游入口

回退输出必须至少包含：

- `selected_skill: "loom-init"`
- `result: "fallback"`
- `missing_inputs`
- `fallback_to: "loom-init"`
