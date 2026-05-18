---
name: loom-story
description: Turn product context, vision, roadmap, host issues, notes, or discussion summaries into a Loom-consumable User Story and separate Story Readiness result before formal spec / plan work.
---

# Loom Story

`loom-story` 承接 story-to-delivery intake 场景。

它把产品上下文收束为 User Story 与 Story Readiness，但不替代 `Work Item`、`spec.md`、`plan.md`、review、merge-ready 或 closeout。

## 1. 使用时机

当任务满足以下任一条件时，进入 `loom-story`：

- 将 vision、roadmap、notes、host issue 或讨论内容整理成 User Story
- 判断 story 是否足够进入 formal spec / plan
- 需要把 story acceptance scenarios 映射到后续 `spec.md` / `plan.md`
- 需要检查 actor specificity 或 scenario coverage

如果任务已经是实现当前 Work Item，应进入 `loom-build`。如果任务已经要求 formal spec review，应进入 `loom-spec-review`。

## 2. 固定入口

统一入口固定为：

- `python3 scripts/loom-story.py flow story --target <repo> [--item <id>]`

该入口只读取 Loom runtime 可用性，输出 story intake contract summary。实际 story shaping 由执行者根据输入上下文写入用户指定载体或后续 spec / plan，不由 runtime 自动裁决产品目标。

## 3. 输出职责

执行者必须在实际 shaping 输出中保持三类分离结果：

- User Story
  - actor
  - capability
  - outcome
  - business value
  - acceptance scenarios
  - provenance / context locators
- Story Readiness
  - decision: `ready | needs-shaping | blocked | not-applicable`
  - rationale
  - missing inputs
  - spec / plan entry expectation

User Story 主体不得包含 delivery handoff、spec locator、plan locator、recovery state、review findings、PR summary、merge-ready 或 closeout state。

## 4. Shaping Checklist

至少检查：

- actor 是否具体，避免在已有具体角色时写成模糊 `User`
- outcome 是否可观察
- business value 是否说明进入交付链的理由
- happy path 是否存在
- negative path、edge case、alternative path、security/permission、environment/interruption 是否按风险覆盖或标记 `not_applicable`
- story 是否过大，需要拆成多个 Work Item 或 FR

## 5. Delivery Boundary

`loom-story` 只把 story 准备成后续 delivery 输入：

- `spec.md` 消费 story scenarios 形成 behavior contract
- `plan.md` 将 scenarios 映射到 tests、checks、manual validation 或 `not_applicable` evidence
- `Work Item` 仍是唯一执行入口

输入信号与输出合同见：

- [references/input-signals.md](./references/input-signals.md)
- [references/output-contract.md](./references/output-contract.md)
