# Loom Story Output Contract

`flow story` 输出固定为 story intake contract summary，至少需要给出：

- `contract_summary`
  - 当前 runtime 只暴露合同，不自动生成 product truth
- `story_contract`
  - `schema_version: loom-user-story/v1`
  - actor、capability、outcome、business_value、acceptance_scenarios、out_of_scope、provenance
- `readiness_contract`
  - `schema_version: loom-story-readiness/v1`
  - decision、rationale、story_locator、checks、missing_inputs、fallback_to
  - decision 只允许 `confirmed`、`pending`、`revision-requested`、`not_applicable`
  - `confirmed` 表示 story 足够清楚，可被 formal spec / plan 消费
  - `pending` 表示缺少产品上下文、业务确认或关键场景；必须停在 story shaping
  - `revision-requested` 表示用户或 reviewer 要求修改 story；必须回到 story shaping
  - `not_applicable` 表示当前事项不需要 story 层，必须记录 bypass rationale
- `business_confirmation_contract`
  - `schema_version: loom-story-business-confirmation/v1`
  - decision、confirmation_scope、confirmation_source、revision_request、bypass_rationale
  - decision 只允许 `pending`、`confirmed`、`revision-requested`、`not_applicable`
  - 用户直接回复「确认」即可记录为 `confirmed`
  - `revision-requested` 必须回到 story shaping，不得直接进入 spec / plan
  - `pending` 不得被当作默认同意或隐式确认
  - `not_applicable` 必须说明纯治理、维护、格式、链接修复或载体整理等 bypass rationale
- `delivery_consumption_contract`
  - story scenario 到 `spec.md` behavior contract 的映射
  - story scenario 到 `plan.md` validation strategy 的映射
  - spec / plan 只消费已 `confirmed` 或明确 `not_applicable` 的 story 语义
  - 任何 `pending` 或 `revision-requested` 的 readiness / confirmation 都必须 fail closed，阻止 formal spec shaping
  - full path 需要可消费的 readiness / confirmation locator；minimal path 需要
    `not_applicable` rationale、consumer boundary 和 recheck condition
  - `Work Item` 仍是唯一执行入口
- `missing_inputs`
  - 当前阻断 story shaping 的缺口；无阻断时为空数组
- `fallback_to`
  - `story-shaping`、`product-context`、`work-item-authoring` 或 `null`
- `runtime_state`
  - 当前 Loom 入口自己的 scene / carrier 判定，以及 fail-closed 原因
- `contract`
  - User Story 与 Story Readiness 的稳定合同定位

User Story 主体不得包含：

- delivery handoff
- spec locator
- plan locator
- recovery state
- review findings
- PR summary
- merge-ready result
- closeout result

Story Readiness 只判断 story 是否足够进入 spec / plan，不判断产品目标或商业战略是否正确。它不是 technical design approval、test strategy approval、review gate 或 code quality gate。

Story Business Confirmation 只让用户确认业务语义，不要求用户判断技术方案、实现细节、测试策略、review 质量或代码质量。纯治理、维护、格式、链接修复等不涉及业务语义的事项应使用 `not_applicable` 并记录 bypass rationale。
