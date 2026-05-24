# FR-0013 数据模型（Layer 2 事件级拟人模拟增强）

## 范围说明

本模型描述 FR-0013 规约阶段需要稳定交付的共享对象，不新增持久化 schema。它只定义实现阶段必须遵循的 Layer 2 共享实体语义，并显式继承 `FR-0011` 已冻结的门禁与状态机对象。

## 继承边界

以下对象由 `FR-0011` 继续作为唯一正式来源，FR-0013 只允许引用，不允许重定义：

- `write_interaction_tier`
- `session_rhythm_policy`
- `risk_state_machine`
- `issue_action_matrix`
- `approval_record`
- `audit_record`
- `consumer_gate_result`

FR-0013 的新增对象必须把这些对象视为前置输入或外部约束，而不是并列替代对象。

## 实体 1：Layer2EventFamily

- `event_family` ENUM NOT NULL
- `action_kinds` ARRAY NOT NULL
- `required_capability` ARRAY NOT NULL

约束：

- `event_family` 只允许 `pointer_click`、`pointer_hover`、`focus_navigation`、`keyboard_text`、`composition_text`、`scroll_viewport`、`change_blur_finalize`。
- `action_kinds` 只能引用 `click`、`focus`、`keyboard_input`、`composition_input`、`hover`、`scroll`。
- `change_blur_finalize` 只能作为事件链收口族，不得暴露为独立 CLI action。

## 实体 2：Layer2EventStrategyProfile

- `event_family` ENUM NOT NULL
- `action_kind` ENUM NOT NULL
- `preferred_path` ENUM NOT NULL（`real_input` | `mixed_input`）
- `fallback_path` ENUM NULL（`synthetic_chain`）
- `requires_focus` BOOLEAN NOT NULL
- `requires_hover_confirm` BOOLEAN NOT NULL
- `requires_settled_wait` BOOLEAN NOT NULL
- `blocked_when_tier` ARRAY NOT NULL

约束：

- `event_family` 必须引用 `Layer2EventFamily.event_family`。
- `action_kind` 至少覆盖 `click`、`focus`、`keyboard_input`、`composition_input`、`hover`、`scroll`。
- `event_family` 与 `action_kind` 必须符合 `Layer2EventFamily.action_kinds` 映射。
- `preferred_path` 不允许直接取 `synthetic_chain`。
- `fallback_path` 为空表示该动作不允许合成回退。
- `blocked_when_tier` 必须引用 `FR-0011.write_interaction_tier` 的正式等级名。

## 实体 3：Layer2EventChainPolicy

- `chain_name` TEXT NOT NULL
- `event_family` ENUM NOT NULL
- `action_kind` ENUM NOT NULL
- `required_events` ARRAY NOT NULL
- `optional_events` ARRAY NOT NULL
- `completion_signal` ARRAY NOT NULL
- `requires_settled_wait` BOOLEAN NOT NULL

约束：

- `event_family` 必须引用 `Layer2EventFamily.event_family`。
- `chain_name` 至少覆盖 `focus_acquire`、`keyboard_input`、`composition_input`、`hover_click`、`change_blur_finalize`。
- `required_events` 不得为空。
- `keyboard_input` 与 `composition_input` 的 `required_events` 不得完全相同。
- 若 `completion_signal` 为空，视为无效对象。

## 实体 4：Layer2EventPersonaProfile

- `persona_name` TEXT NOT NULL
- `pointer_precision` ENUM NOT NULL（`tight` | `balanced` | `loose`）
- `hover_confidence` ENUM NOT NULL（`low` | `medium` | `high`）
- `typing_cadence` ENUM NOT NULL（`steady` | `natural` | `variable`）
- `scroll_style` ENUM NOT NULL（`linear` | `segmented` | `scan_and_lookback`）
- `correction_tendency` ENUM NOT NULL（`none` | `low` | `medium`）
- `scope` ENUM NOT NULL（`event_chain`）

约束：

- 本实体只描述单次事件链内的参数偏好。
- 不得新增跨 session、跨页面、profile 绑定或平台历史行为字段。
- 不得作为长期 persona、账号画像或 Layer 4 行为基线持久化。

## 实体 5：Layer2RhythmProfile

- `profile_name` TEXT NOT NULL
- `persona_profile` TEXT NOT NULL
- `hover_confirm_min_ms` INTEGER NOT NULL
- `hover_confirm_max_ms` INTEGER NOT NULL
- `click_jitter_min_px` INTEGER NOT NULL
- `click_jitter_max_px` INTEGER NOT NULL
- `typing_delay_min_ms` INTEGER NOT NULL
- `typing_delay_max_ms` INTEGER NOT NULL
- `punctuation_pause_multiplier` REAL NOT NULL
- `long_pause_probability` REAL NOT NULL
- `scroll_segment_min_px` INTEGER NOT NULL
- `scroll_segment_max_px` INTEGER NOT NULL
- `lookback_probability` REAL NOT NULL
- `distribution_type` ENUM NOT NULL（`fixed` | `bounded_jitter` | `weighted_choice`）
- `deterministic_seed` TEXT NULL

约束：

- `persona_profile` 必须引用 `Layer2EventPersonaProfile.persona_name`。
- 所有时间和距离字段必须 > 0。
- `hover_confirm_max_ms` 必须 >= `hover_confirm_min_ms`。
- `click_jitter_max_px` 必须 >= `click_jitter_min_px`。
- `typing_delay_max_ms` 必须 >= `typing_delay_min_ms`。
- 概率字段必须在 `0` 到 `1` 之间。
- 本对象只表达事件级节奏，不得承载 session 级状态或跨页面记忆。
- `deterministic_seed` 只允许用于测试或最小重放，不得作为长期用户行为指纹。

## 实体 6：Layer2PageStateInput

- `target_visible` BOOLEAN NOT NULL
- `target_interactable` BOOLEAN NOT NULL
- `target_focused` BOOLEAN NOT NULL
- `target_disabled` BOOLEAN NOT NULL
- `target_readonly` BOOLEAN NOT NULL
- `viewport_state` ENUM NOT NULL（`stable` | `scrolling` | `resizing`）
- `occlusion_state` ENUM NOT NULL（`clear` | `partial` | `blocked`）
- `layout_motion` ENUM NOT NULL（`idle` | `animating` | `loading` | `unknown`）
- `last_chain_result` ENUM NOT NULL（`not_run` | `settled` | `timeout` | `target_drifted`）

约束：

- 本实体是 Layer 2 单次策略选择输入，不新增持久化 schema。
- 本实体不得承载 `session_rhythm_window_state`、cooldown、recovery、stability window 或 `runtime.audit.session_rhythm_status`。
- 页面内容只能以状态枚举和摘要表达，不得把敏感 DOM 文本写入 trace。

## 实体 7：Layer2StrategySelection

- `event_family` ENUM NOT NULL
- `action_kind` ENUM NOT NULL
- `selected_path` ENUM NOT NULL（`real_input` | `mixed_input` | `synthetic_chain` | `blocked`）
- `strategy_profile` TEXT NOT NULL
- `event_chain` TEXT NOT NULL
- `persona_profile` TEXT NOT NULL
- `rhythm_profile` TEXT NOT NULL
- `page_state_input_used` BOOLEAN NOT NULL
- `fallback_reason` TEXT NULL
- `blocked_by` TEXT NULL

约束：

- `event_family` 必须引用 `Layer2EventFamily.event_family`。
- `selected_path=synthetic_chain` 时，`fallback_reason` 必填。
- `selected_path=blocked` 时，`blocked_by` 必填。
- `blocked_by` 只能引用 `FR-0011` 的风险状态、动作分级或本 FR 明确的事件约束。

## 实体 8：Layer2ExecutionTrace

- `event_family` ENUM NOT NULL
- `action_kind` ENUM NOT NULL
- `selected_path` ENUM NOT NULL
- `event_chain` TEXT NOT NULL
- `persona_profile_source` ENUM NOT NULL（`default` | `platform_override`）
- `rhythm_profile_source` ENUM NOT NULL（`default` | `platform_override`）
- `page_state_input_summary` TEXT NOT NULL
- `required_events_applied` ARRAY NOT NULL
- `settled_wait_applied` BOOLEAN NOT NULL
- `settled_wait_result` ENUM NOT NULL（`settled` | `timeout` | `skipped`）
- `failure_category` ENUM NULL（`focus_not_acquired` | `framework_state_not_updated` | `target_drifted` | `blocked_by_fr0011`）

约束：

- `event_family` 必须引用 `Layer2EventFamily.event_family`。
- `page_state_input_summary` 只能表达状态摘要，不得记录敏感页面内容。
- `required_events_applied` 必须与对应 `Layer2EventChainPolicy.required_events` 可比对。
- `failure_category` 为空表示该次链路未进入失败分类。
- 若 `settled_wait_applied=true`，则 `settled_wait_result` 不得为 `skipped`。
- `rhythm_profile_source=platform_override` 时，不得改变本 FR 的字段语义，只允许覆盖值。

## 实体 9：Layer2AcceptanceMatrixRow

- `event_family` ENUM NOT NULL
- `required_path` TEXT NOT NULL
- `required_events_or_signals` ARRAY NOT NULL
- `page_state_inputs` ARRAY NOT NULL
- `trace_fields` ARRAY NOT NULL
- `test_type` ARRAY NOT NULL
- `downstream_issue` ARRAY NOT NULL

约束：

- 矩阵行必须至少覆盖 `pointer_click`、`pointer_hover`、`focus_navigation`、`keyboard_text`、`composition_text`、`scroll_viewport`、`change_blur_finalize`。
- `downstream_issue` 只能引用 `#738`、`#739`、`#740`、`#741` 或后续明确挂到 `#236` 的 Layer 2 子 issue。
- 矩阵只描述 Layer 2 验收，不得把 `FR-0014` 或 `FR-0022` 对象写成 FR-0013 的验收字段。

## 生命周期

1. FR-0013 规约阶段：冻结 Layer 2 共享实体语义。
2. 实现阶段：将这些实体映射到策略配置、运行时选择结果与测试夹具。
3. 后续阶段：平台适配器只允许覆盖值，不允许改语义；若需改语义，必须独立 spec review。
