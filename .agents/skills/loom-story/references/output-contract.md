# Loom Story Output Contract

`flow story` 输出固定为 story intake contract summary，至少需要给出：

- `contract_summary`
  - 当前 runtime 只暴露合同，不自动生成 product truth
- `story_contract`
  - `schema_version: loom-user-story/v1`
  - actor、capability、outcome、business_value、acceptance_scenarios、provenance
- `readiness_contract`
  - `schema_version: loom-story-readiness/v1`
  - decision、rationale、story_locator、checks、missing_inputs、fallback_to
- `delivery_consumption_contract`
  - story scenario 到 `spec.md` behavior contract 的映射
  - story scenario 到 `plan.md` validation strategy 的映射
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

Story Readiness 只判断 story 是否足够进入 spec / plan，不判断产品目标或商业战略是否正确。
