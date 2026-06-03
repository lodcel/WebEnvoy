---
name: loom-story
description: Turn product context, vision, roadmap, host issues, notes, or discussion summaries into a Loom-consumable User Story, Story Readiness, and business semantic confirmation point before formal spec / plan work.
---

# Loom Story

`loom-story` 承接 story-to-delivery intake 场景。

它把产品上下文收束为 User Story、Story Readiness 与 Story Business Confirmation，但不替代 `Work Item`、`spec.md`、`plan.md`、review、merge-ready 或 closeout。

## 1. 使用时机

当任务满足以下任一条件时，进入 `loom-story`：

- 将 vision、roadmap、notes、host issue 或讨论内容整理成 User Story
- 判断 story 是否足够进入 formal spec / plan
- 需要用户轻量确认 story 的业务语义，或根据用户修订意见回到 story shaping
- 需要把 story acceptance scenarios 映射到后续 `spec.md` / `plan.md`
- 需要检查 actor specificity 或 scenario coverage

如果用户要求把 story、roadmap 或治理目标拆成 Phase / FR / Work Item / PR，或要求规划 issue tree、依赖关系、blocked-by/blocks，应回到 `loom-init` 的 delivery planning 路由。`loom-story` 只负责 story shaping，不输出 issue-tree plan。

如果任务已经是实现当前 Work Item，应进入 `loom-build`。如果任务已经要求 formal spec review，应进入 `loom-spec-review`。

## 2. 固定入口

统一入口固定为：

- `python3 scripts/loom-story.py flow story --target <repo> [--item <id>]`

该入口只读取 Loom runtime 可用性，输出 story intake contract summary。实际 story shaping 由执行者根据输入上下文写入用户指定载体或后续 spec / plan，不由 runtime 自动裁决产品目标。

## 3. 输出职责

执行者必须在实际 shaping 输出中保持四类分离结果：

- User Story
  - actor
  - capability
  - outcome
  - business value
  - acceptance scenarios
  - out of scope
  - provenance / context locators
- Story Readiness
  - decision: `confirmed | pending | revision-requested | not_applicable`
  - rationale
  - missing inputs
  - spec / plan entry expectation
- Story Business Confirmation
  - decision: `pending | confirmed | revision-requested | not_applicable`
  - confirmation scope: actor、capability、outcome、business value、acceptance scenarios、out of scope
  - revision request 或 bypass rationale
  - confirmation source

User Story 主体不得包含 delivery handoff、spec locator、plan locator、recovery state、review findings、PR summary、merge-ready 或 closeout state。

## 4. Shaping Checklist

至少检查：

- actor 是否具体，避免在已有具体角色时写成模糊 `User`
- outcome 是否可观察
- business value 是否说明进入交付链的理由
- out of scope 是否足够清楚，避免后续 spec / plan 默认扩大范围
- happy path 是否存在
- negative path、edge case、alternative path、security/permission、environment/interruption 是否按风险覆盖或标记 `not_applicable`
- story 是否过大，需要拆成多个 Work Item 或 FR
  - 若需要拆分，交给 `loom-init` 的 delivery planning 路由输出 issue-tree plan；不要在 story 主体里直接写执行树
- 若 story readiness 为 `pending`，说明缺少哪些输入或业务确认，并停在 story shaping
- 若用户给出修订意见，记录 `revision-requested`，必须回到 story shaping，不得直接进入 spec / plan
- 若 story 涉及业务语义，是否已经请求用户确认；用户直接说「确认」即可记录 `confirmed`
- 若 story 不适用，记录 `not_applicable` 和 bypass rationale，不得只省略 story 结果

## 5. Delivery Boundary

`loom-story` 只把 story 准备成后续 delivery 输入：

- `spec.md` 消费 story scenarios 形成 behavior contract
- `plan.md` 将 scenarios 映射到 tests、checks、manual validation 或 `not_applicable` evidence
- Story Readiness 与 Story Business Confirmation 都必须是 `confirmed` 或明确 `not_applicable`，formal spec / plan 才能消费 story 语义
- `pending` 或 `revision-requested` 必须 fail closed：停止 formal spec shaping，回到 story shaping 或等待用户业务语义确认
- `not_applicable` 必须说明纯治理、维护、格式或链接类 bypass rationale，后续 spec / plan 只能消费该 rationale，不得制造空确认
- `Work Item` 仍是唯一执行入口
- issue tree、Phase / FR / Work Item / PR 切分、blocked-by/blocks 与 host carrier mapping 由 `loom-init` 的 delivery planning 路由承接

## 6. Full / Minimal Suite Path 边界

`loom-story` 不选择或重定义 full/minimal suite path；它只产出可被
`spec-suite` 消费的 story readiness 与 business confirmation 输入。

- full path：若 formal spec path 消费 story，必须输出 Story Readiness 与 Story
  Business Confirmation locator，且 decision 为 `confirmed` 或明确
  `not_applicable`。`pending` / `revision-requested` 必须 fail closed，回到 story
  shaping 或等待业务语义确认。
- minimal path：纯治理、维护、格式、链接修复或载体整理可以输出
  `not_applicable`，但必须包含 bypass rationale、consumer boundary 和 recheck
  condition，供 `spec.md`、`plan.md`、evidence-map 与后续 gate 消费。
- `loom-story` 不把 `not_applicable` 升级成产品确认，不生成 evidence-map、
  consistency-analysis、review、merge-ready 或 GitHub closeout truth。

输入信号与输出合同见：

- [references/input-signals.md](./references/input-signals.md)
- [references/output-contract.md](./references/output-contract.md)
