# Story Intake

本文件定义 Loom 的 Story-to-Delivery Intake 合同。

它承接 `#649`、`#1015`、`#1029`，把 vision、roadmap、host issue、notes 或多轮产品讨论收束为可被正式交付链消费的 User Story、Story Readiness 与 Story Business Confirmation 结果。

## 1. 边界

User Story 是上游 product-value artifact，不是执行状态载体。

它只回答：

- 谁需要能力
- 需要什么能力
- 成功后什么结果变成可观察事实
- 为什么这个结果有业务或项目价值
- 哪些业务可读 acceptance scenarios 描述目标行为
- 哪些范围明确不做
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
- `out_of_scope`
  - 当前 story 明确不承接的业务范围、能力边界或验收边界
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

- `confirmed`
  - story 已有足够业务语义，可进入 formal spec / plan shaping
- `pending`
  - story 缺少业务确认、关键输入或可判断场景；不得进入 formal spec / plan shaping
- `revision-requested`
  - 用户或 reviewer 要求修改 story；必须回到 story shaping，不得直接进入 `spec.md` / `plan.md`
- `not_applicable`
  - 当前事项不需要 story 层，必须给出 bypass rationale

Readiness 至少检查：

- story locator
- actor specificity
- outcome clarity
- value signal
- acceptance scenario quality
- unresolved blockers
- story size

## 5. Story Business Confirmation

Story Business Confirmation 是独立确认点，不写回 User Story 主体，也不替代 `spec review`、implementation review、测试策略或代码质量判断。

稳定 schema 名为 `loom-story-business-confirmation/v1`。它只确认 story 表达的业务语义是否符合用户意图。确认范围固定为：

- actor
- capability
- outcome
- business value
- acceptance scenarios
- out of scope / non-goals

允许结果：

- `pending`
  - story 已准备给用户确认，但用户尚未确认或修订
- `confirmed`
  - 用户已确认业务语义；用户直接回复「确认」即可表达该结果
- `revision-requested`
  - 用户给出修订意见；流程必须回到 Story 修订，不得直接进入 `spec.md` / `plan.md`
- `not_applicable`
  - 当前事项不涉及业务语义确认，例如纯治理、维护、格式、链接修复或载体整理；必须给出 bypass rationale

执行者向用户请求确认时，只能要求确认上述业务语义，不要求用户判断技术方案、实现细节、测试策略、review 质量或代码质量。

若确认结果为 `pending` 或 `revision-requested`，后续 formal spec / plan shaping 必须等待 story 修订或确认完成。若结果为 `not_applicable`，后续工件只消费 bypass rationale，不制造无意义的人为确认负担。

## 6. 到 Delivery Funnel 的消费关系

Story 不能直接进入 implementation。进入正式交付仍以 `Work Item` 为唯一执行入口。

默认消费链：

1. Product context 形成 User Story。
2. Story Readiness 判断是否可进入 formal spec / plan。
3. 对涉及业务语义的事项，Story Business Confirmation 等待用户确认；用户给出修订意见时回到 Story 修订。
4. `spec.md` 消费已确认或明确 `not_applicable` 的 story scenarios，形成可观察 behavior contract。
5. `plan.md` 把 accepted scenarios 映射到 tests、checks、manual validation 或 `not_applicable` evidence。
6. review、merge-ready 与 closeout 消费 spec / plan / evidence 的结果，不反向改写 User Story。

若 story 被后续 delivery artifacts 吸收，后续工件只记录 locator 或 scenario id 映射，不复制 story 为第二事实源。

## 7. 非目标

- 不替代 Jira、Linear、Notion 或其他产品管理系统
- 不建立 Loom-owned product database
- 不裁决产品目标是否正确
- 不要求所有小事项都先完成敏捷 story 仪式
- 不把 story readiness 提升为无关实现变更的 merge gate
- 不把业务语义确认扩大成技术方案、测试策略或代码质量评审
