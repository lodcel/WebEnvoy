# Spec Suite

本文件定义 Loom formal spec path 的 full / minimal spec suite 分层合同。

本文件当前承接：

- `EXT-0015`
- `EXT-0016`
- `EXT-0017`
- `EXT-0061`
- `EXT-0062`
- `#649`
- `#1013`
- `#1032`

## 0. SDD 内化边界

Spec-driven development 在 Loom 中是一条 formal spec 路径可采用的强执行纪律，不是 Loom 的全部定位。

Loom 可以吸收 SDD 的以下机制：

- 阶段化产物：从 story / intent 到 `spec.md`、`plan.md`、execution breakdown、evidence 与 consistency analysis 的递进关系
- 模板约束：`spec.md` 冻结行为契约，`plan.md` 承接实现与验证策略，后续工件承接拆解、证据或一致性分析
- 前后项消费：后续工件必须消费上游 locator 与明确映射，不能重新 authored 第二套目标
- 跨产物分析：在 review、merge-ready 与 closeout 前暴露 spec / plan / breakdown / evidence / host state 的冲突、缺口和 stale 信号

Loom 不吸收 SDD-only 边界：

- 不把所有事项强制套成完整 SDD 仪式
- 不要求纯文档、治理、adoption、resume、handoff、closeout 或宿主绑定事项必须伪装成实现需求
- 不复制 `github/spec-kit` 的 `.specify/` 目录、`/speckit.*` 命令名、固定文件布局或 extension trust model
- 不让 `tasks.md` 或任何单一任务文件替代 Work Item、recovery、review、merge-ready 或 closeout 真相

因此，本文件冻结 full / minimal spec suite 的合同、工件列表、模板职责、locator / provenance 规则和 source / generated 接入要求。gate-chain 与 CLI surface 只作为后续消费者或占位引用出现，不在本文件定义具体运行合同。`evidence-map` 与 `consistency-analysis` 的 #1018 合同见 [evidence-map.md](./evidence-map.md) 与 [consistency-analysis.md](./consistency-analysis.md)。Execution breakdown 与 task carrier 的当前合同分别见 [execution-breakdown.md](./execution-breakdown.md) 与 [../harness/task-carrier-contract.md](../harness/task-carrier-contract.md)。

## 0.1 Story Readiness 入口规则

Formal spec shaping 只能消费已确认或明确不适用的 story 语义。

入口规则如下：

- 若存在 story intake，`Story Readiness` 必须是 `confirmed`，或以 `not_applicable` 记录 bypass rationale、consumer boundary 与 recheck condition。
- 若事项涉及业务语义，`Story Business Confirmation` 必须是 `confirmed`，或以 `not_applicable` 记录 bypass rationale、consumer boundary 与 recheck condition。
- `pending` 与 `revision-requested` 是阻断状态。它们只能作为 blocking locator 记录，不能被 `spec.md` 或 `plan.md` 当成已确认语义消费。
- `not_applicable` 不是省略字段。它必须说明为什么当前目标不需要 story 或业务确认、哪些消费者不应要求它、什么条件触发重新判断。
- `spec.md` 与 `plan.md` 只记录 story locator、scenario id、confirmation locator 或 `not_applicable` rationale；不得复制 User Story 主体，避免形成第二事实源。

因此，formal spec path 的入口不是“有一个 story 文本就能继续”，而是“story readiness 与业务确认的消费状态已经可被后续工件解释”。未满足时，流程停在 story shaping 或等待业务语义确认。

## 1. Suite Path

Loom formal spec path 分为两个合法路径：

- `minimal suite`
  - 目标：为 light / 小变更 / 文档治理事项保留最小正式规约。
  - 必选工件：`spec.md`、`plan.md`。
  - 合法条件：scope 单一、风险低、验证入口明确、不需要跨工件一致性分析或后续拆解。
  - `not_applicable` 语义：不需要 full path 附加工件是合法路径选择，不是 missing。
- `full suite`
  - 目标：为 formal spec / 高风险 / 跨模块 / 强 review 路径提供完整消费链。
  - 必选工件：`suite-index.md`、`spec.md`、`plan.md`。
  - 条件工件：`research.md`、`contracts.md`、`readiness-checklist.md`。
  - 后续 FR 拥有的扩展槽：execution breakdown / task carrier（#1017）、evidence-map 与 consistency-analysis（#1018）、review / merge-ready gate-chain consumption（#1019）。

路径选择必须记录 locator 和 provenance。若从 full path 降到 minimal path，必须说明为什么附加工件 `not_applicable`；若从 minimal path 升到 full path，必须说明触发信号和要补齐的工件。

## 2. Full Suite 工件列表

Full suite 的当前可投放工件如下：

| 工件 | 职责 | Consume | Produce | Locator / provenance |
| --- | --- | --- | --- | --- |
| `suite-index.md` | 记录 suite path、工件清单、适用性判断和后续消费者 | Work Item / FR locator、Story Readiness locator、Story Business Confirmation locator、delivery planning locator 或 `not_applicable` rationale | path decision、artifact inventory、deferred / not_applicable table、#1020 接入需求 | 每个工件使用 repo-relative locator；provenance 指向触发 path decision 的 issue、PR、story 或会话记录 |
| `spec.md` | 冻结目标、范围、可观察场景与验收标准 | Story Readiness locator、story scenario locator、Story Business Confirmation locator 或 `not_applicable` rationale、suite-index path decision | scenario ids / locators、acceptance ids、behavior evidence expectation | scenario id / acceptance id 必须可被 `plan.md` 逐项引用 |
| `plan.md` | 把 `spec.md` 场景和验收转成实现、验证与测试策略 | `spec.md` scenario / acceptance locator、Story Readiness / Business Confirmation consumed state、suite-index path decision、constraints | validation strategy、test strategy、fresh evidence expectation | 每条 validation row 必须保留被消费的 scenario / acceptance locator |
| `research.md` | 记录正式实现前必须冻结的未知、约束、取舍与外部输入 | upstream issue / doc / host locator、open question locator | decision record、resolved / deferred / not_applicable unknowns | provenance 必须说明结论来自 repo truth、host truth、外部资料或会话判断 |
| `contracts.md` | 记录本次变更承诺的接口、数据、host binding 或文档合同 | `spec.md` acceptance、`plan.md` constraints、existing contract locator | contract delta、compatibility expectation、consumer list | locator 指向被改动或被消费的合同；不得替代后续 implementation contract |
| `readiness-checklist.md` | 在 build / review 前核对 suite 完整性 | suite-index、spec、plan、research、contracts | readiness verdict: `ready` / `blocked` / `not_applicable` | 只能表达 readiness 证据 locator，不 authored recovery 状态 |
| execution breakdown / task carrier | 后续拆解执行项和 carrier 边界 | full suite 已稳定工件列表 | 由 #1017 定义 | 本文件只保留 extension slot，不定义具体模板 |
| evidence-map / consistency-analysis | 后续证据映射与跨工件一致性分析 | full suite 已稳定工件列表 | 由 #1018 定义 | 本文件只保留 extension slot，不定义具体模板 |
| gate-chain consumption | review / merge-ready / closeout 如何消费 suite | full suite artifact locators | 由 #1019 定义 | 本文件只保留 extension slot，不定义 gate 逻辑 |

`research.md`、`contracts.md`、`readiness-checklist.md` 是 full path 的条件工件：当对应风险不存在时可以声明 `not_applicable`，但必须在 `suite-index.md` 中写明理由和重新判断条件。

## 3. Minimal Suite 最小边界

Loom 把正式规约套件的最小内核定义为：

- `spec.md`
- `plan.md`

这两个工件分别承担不同职责，不得混写。

Minimal suite 可以被 review、merge-ready 与 closeout 消费，但它必须显式声明哪些 full suite 工件 `not_applicable`。没有记录的缺口是 missing；有 rationale、recheck condition 和 consumer boundary 的 `not_applicable` 才是合法 minimal path。

## 4. `spec.md` 最小要求

`spec.md` 至少应表达：

- 目标
- 范围
- 关键场景，优先使用 `GWT`，且每个场景有 scenario id 或 locator
- 异常与边界
- 验收标准

`spec.md` 承接 BDD 外环。它描述可观察行为，不描述内部实现步骤：

- `Given` 固定当前用户、系统或治理对象的起点
- `When` 固定触发动作或宿主事件
- `Then` 固定可验证结果、状态变化或 gate 消费结果
- 每个关键场景都应能映射到后续行为证据；若纯文档事项不适用，应显式说明 `not_applicable`
- 每条验收标准应有 acceptance id，或引用可稳定消费的 locator
- 若存在 User Story，`spec.md` 只消费 story scenario id / locator 与业务可读 GWT，不复制 story 为第二事实源
- 若存在 User Story，`spec.md` 必须记录 `Story Readiness` confirmed locator，或带 rationale 的 `not_applicable`；`pending` 或 `revision-requested` 必须阻断 formal spec shaping
- 若 User Story 涉及业务语义，`spec.md` 必须记录 `Story Business Confirmation` confirmed locator 或 `not_applicable` rationale；`pending` 或 `revision-requested` 不得进入 formal spec shaping

## 5. `plan.md` 最小要求

`plan.md` 至少应表达：

- 实施目标
- 阶段拆分
- 约束
- 验证方式
- `TDD` 或测试策略
- 依赖关系
- 进入实现前条件

`plan.md` 承接 TDD 内环。它把 `spec.md` 的行为场景转成实现推进与测试证据计划：

- 每个关键行为场景应声明将由哪些 `automated`、`manual`、`structural` 或 `not_applicable` 验证覆盖
- 每条 validation strategy 必须引用对应 scenario id / locator；每条 test strategy 必须引用对应 acceptance id / locator 或说明 `not_applicable`
- 若场景来自 User Story，`plan.md` 应保留 story scenario id 到验证策略的映射
- 若场景来自 User Story，`plan.md` 必须保留 Story Readiness consumed state，并只能基于 `confirmed` 或明确 `not_applicable` 的 story 语义规划验证
- 若场景涉及业务语义，`plan.md` 必须保留 Story Business Confirmation consumed state；`pending` 或 `revision-requested` 只能作为阻断 locator，不能生成验证策略
- 能自动化的行为先写或先调整失败用例，再实现，再以通过结果作为 test evidence
- 不能自动化的行为必须声明人工验证路径、证据 locator 与 fresh 条件
- 纯文档或治理规则变更可以不强制 TDD，但必须说明行为证据如何由结构检查、审查记录或示例消费
- 若 `plan.md` 的 phase 需要被拆成可追踪执行单元，应由 execution breakdown 消费 `plan.md`，并回链 spec scenario、plan phase 与 validation strategy；execution breakdown 不反向替代 `plan.md`

Full path 中，缺少 scenario -> validation 或 acceptance -> test mapping 时，不得进入 build / review；minimal path 中，缺映射必须以 `not_applicable` rationale、替代验证入口和 recheck condition 解释。

## 6. `spec.md` 到 `plan.md` 的机械映射

`spec.md` 与 `plan.md` 的消费关系必须按字段映射，而不是靠自然语言总结。

| `spec.md` 字段 | `plan.md` 消费字段 | 要求 |
| --- | --- | --- |
| `suite path` | `suite path consumed` | plan 必须声明消费的是 minimal 还是 full path |
| `Story Readiness locator` | `story readiness consumed` | 只能是 confirmed locator 或 `not_applicable` rationale；pending / revision-requested 只能作为阻断 locator 记录，不能被 plan 当成可继续信号 |
| `story scenario locator` | `story scenario to evidence mapping` | 只引用 locator，不复制 story 文本 |
| `Story Business Confirmation locator` | `story business confirmation consumed` | 只能是 confirmed locator 或 `not_applicable` rationale；pending / revision-requested 只能作为阻断 locator 记录，不能被 plan 当成已确认语义消费 |
| `scenario_id` / scenario locator | `validation strategy` | 每个 scenario 映射到 `automated`、`manual`、`structural` 或 `not_applicable` |
| `acceptance_id` / acceptance locator | `test strategy` | 每个 acceptance 映射到 test evidence、structural check、manual evidence 或 `not_applicable` |
| `behavior evidence expectation` | `fresh verification evidence` | plan 必须声明 evidence locator 类型和 freshness rule |
| `exceptions / boundaries` | `constraints` 与 `rollback boundary` | plan 不能扩大 spec scope |

映射缺口的状态只允许：

- `mapped`: plan 有明确消费字段。
- `not_applicable`: 当前目标不需要该字段，并有 rationale、consumer boundary 和 recheck condition。
- `deferred`: 仍属于目标但当前批次不做，必须记录激活条件和不阻塞的消费者。
- `missing`: 没有解释的缺口；full path 下 blocking。

`deferred` 不等于 `not_applicable`。`deferred` 表示后续仍可能要做；`not_applicable` 表示当前目标不需要，除非 recheck condition 触发。

## 7. 套件边界规则

Loom 必须区分：

- 正式契约工件
- 执行或进度工件

默认要求：

- `spec.md` 与 `plan.md` 属于正式最小套件
- full suite 附加工件只在触发条件成立时要求
- 进度跟踪类工件是否存在，可以按项目需要扩展，但不得混入 formal spec truth

Loom 当前不固化：

- 所有项目都必须有同一组附加工件
- `TODO.md` 或同类文件是永恒必选项

## 8. 行为证据与测试证据

正式规约套件必须让后续 gate 能区分两类证据：

- `behavior evidence`
  - 证明 `spec.md` 中可观察场景已经成立
- `test evidence`
  - 证明 `plan.md` 中约定的自动化、回归或人工验证路径已经执行

两类证据可以来自同一运行记录，但消费语义不同：

- review 消费它们来判断实现是否覆盖行为契约
- merge-ready 消费它们来判断当前 `HEAD` 是否仍有 fresh verification evidence
- closeout 消费它们来判断进入主干后的结果是否足以支持 `absorbed` / `closed_out`

## 9. Locator 与 Provenance 规则

所有 suite 工件必须使用 repo-relative locator 或 host locator，不得使用本机绝对路径作为长期 truth。

最低要求：

- `locator`
  - repo 内工件使用 repo-relative path，例如 `.loom/specs/WI-123/spec.md`。
  - host 工件使用 issue / PR / check / comment locator。
  - 会话判断只能作为临时 provenance，进入执行前必须落到 issue、PR、doc 或 repo-local carrier。
- `provenance`
  - 记录该字段来自 story、issue、PR、doc、review、check、external research 还是 conversation。
  - 记录 freshness rule：何时需要重新读取或重新确认。
  - 记录 trust boundary：该来源能证明什么，不能证明什么。
- `generated_access_requirement`
  - source docs / templates 是本合同的权威面。
  - skills / generated runtime surface 的消费与同步由 #1020 统一接入。
  - 在 #1020 完成前，本文件新增的 generated 接入需求只能记录为 follow-up，不能在本 FR 中修改 generated skills runtime surface。

## 10. 与 Execution Ledger 的映射

正式规约套件只提供 locator / evidence 输入，不维护恢复状态。

默认映射如下：

| 模板输出 | ledger 字段 | 归属边界 |
| --- | --- | --- |
| `spec.md` 的验收标准与行为证据 | `acceptance_locator` | 只说明验收和行为证据入口 |
| `plan.md` 的阶段、验证方式与测试策略 | `plan_locator` | 只说明执行计划入口 |
| execution breakdown unit 与 task carrier mapping | `breakdown_locator` / carrier locator | 只说明 `plan.md` 拆分后的执行单元与承接载体 |
| checkpoint / review / gate 输出 | `validation_evidence_locator` | 只说明验证证据入口 |
| `handoff` 输出或交接说明 | `handoff_notes_locator` | 只说明交接入口 |

若存在 story intake，User Story locator、Story Readiness locator 与 Story Business Confirmation locator 只能作为 `spec.md` / `plan.md` 的上游来源记录，不能进入 execution ledger 替代 `acceptance_locator`、`plan_locator` 或恢复状态。

纯文档事项可在对应字段声明 `not_applicable`，但必须与 spec / plan / recovery 中的事实不冲突。

模板不得 authored `next_step`、`blockers`、`latest_validation_summary`。这些字段只能由 recovery 主入口维护，再由 fact-chain、resume、handoff 与 merge-ready 消费。

## 11. Template Surface

Docs source surface 当前提供以下可投放 scaffold：

- [scaffold/full-suite-index.md](./scaffold/full-suite-index.md)
- [scaffold/spec.md](./scaffold/spec.md)
- [scaffold/plan.md](./scaffold/plan.md)
- [scaffold/research.md](./scaffold/research.md)
- [scaffold/contracts.md](./scaffold/contracts.md)
- [scaffold/readiness-checklist.md](./scaffold/readiness-checklist.md)

每个 scaffold 必须声明 consume、produce、locator 与 provenance。若后续 skills 或 generated surface 需要读取这些模板，#1020 必须同步 source shared references、generated skills surface 和 drift check，而不是在本 FR 中抢跑。
