# Story Intake

本文件定义 Loom 的 Story-to-Delivery Intake 合同。

它承接 `#649`，把 vision、roadmap、host issue、notes 或多轮产品讨论收束为可被正式交付链消费的 User Story 与 Story Readiness 结果。

## 1. 边界

User Story 是上游 product-value artifact，不是执行状态载体。

它只回答：

- 谁需要能力
- 需要什么能力
- 成功后什么结果变成可观察事实
- 为什么这个结果有业务或项目价值
- 哪些业务可读 acceptance scenarios 描述目标行为
- 这些判断来自哪些 context locators

它不得 authored 或复制：

- delivery handoff
- spec locator
- plan locator
- recovery state
- review findings
- PR summary
- merge-ready 或 closeout 结论

这些字段属于后续 Loom delivery carriers。Story 可以被它们消费，但不得替代它们。

## 2. User Story 最小合同

User Story 至少包含：

- `actor`
  - 具体 persona、stakeholder、system actor 或 component actor
- `capability`
  - actor 需要获得的能力
- `outcome`
  - 成功后的可观察结果
- `business_value`
  - 该结果为什么值得进入交付链
- `acceptance_scenarios`
  - business-readable GWT 场景，不是测试脚本或实现步骤
- `provenance`
  - vision、roadmap、issue、notes 或 discussion summary 的 locators

稳定 schema 名为 `loom-user-story/v1`。

`actor` 不应默认写成模糊的 `User`。当真实 actor 可识别时，必须写出具体角色；非人类 actor 只在代表真实系统、组件或宿主行为时使用。

## 3. Acceptance Scenarios

Story 层的 `Given / When / Then` 仍是需求语言：

- `Given` 描述业务起点或系统可观察起点
- `When` 描述 actor 的目标动作或外部触发
- `Then` 描述 actor 或系统可观察到的结果

它不得写成：

- 内部实现步骤
- 自动化测试代码
- review checklist
- merge 或 closeout 操作步骤

场景覆盖维度作为 shaping checklist 使用。每个 story 至少应有一个 happy path；其他维度按风险覆盖或显式 `not_applicable`：

- `happy_path`
- `negative_path`
- `edge_case`
- `alternative_path`
- `security_permission`
- `environment_interruption`

## 4. Story Readiness

Story Readiness 是独立结果，不写回 User Story 主体。

稳定 schema 名为 `loom-story-readiness/v1`。它只判断 story 是否清楚到足以进入 `spec.md` / `plan.md`，不判断产品目标、市场判断或商业战略是否正确。

允许结果：

- `ready`
  - 可进入 formal spec / plan shaping
- `needs-shaping`
  - 需要补 actor、outcome、value、scenario 或 scope 信息
- `blocked`
  - 缺少关键 context 或存在无法自行裁决的产品/权限/数据风险
- `not-applicable`
  - 当前事项不需要 story 层，必须给出 bypass rationale

Readiness 至少检查：

- story locator
- actor specificity
- outcome clarity
- value signal
- acceptance scenario quality
- unresolved blockers
- story size

## 5. 到 Delivery Funnel 的消费关系

Story 不能直接进入 implementation。进入正式交付仍以 `Work Item` 为唯一执行入口。

默认消费链：

1. Product context 形成 User Story。
2. Story Readiness 判断是否可进入 formal spec / plan。
3. `spec.md` 消费 story scenarios，形成可观察 behavior contract。
4. `plan.md` 把 accepted scenarios 映射到 tests、checks、manual validation 或 `not_applicable` evidence。
5. review、merge-ready 与 closeout 消费 spec / plan / evidence 的结果，不反向改写 User Story。

若 story 被后续 delivery artifacts 吸收，后续工件只记录 locator 或 scenario id 映射，不复制 story 为第二事实源。

## 6. 非目标

- 不替代 Jira、Linear、Notion 或其他产品管理系统
- 不建立 Loom-owned product database
- 不裁决产品目标是否正确
- 不要求所有小事项都先完成敏捷 story 仪式
- 不把 story readiness 提升为无关实现变更的 merge gate
