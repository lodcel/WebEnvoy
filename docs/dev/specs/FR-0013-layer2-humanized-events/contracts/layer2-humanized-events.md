# FR-0013 Layer 2 事件级拟人模拟契约

## 边界与适用范围

本契约定义 Layer 2 事件级拟人模拟增强的稳定机器边界，供后续读路径、写路径、平台适配器与测试模块共同消费。

本契约只定义：

1. 事件族对象
2. 事件策略对象
3. 事件链对象
4. 事件级 persona 参数对象
5. 节奏分布对象
6. 页面状态输入对象
7. 策略选择结果
8. 矩阵化执行 trace

本契约不定义：

- `FR-0011` 的门禁、审批、审计、风险状态机或写路径动作等级
- Layer 3 session 行为引擎
- Layer 4 平台长期画像
- 平台完整发布闭环

## 继承约束

以下对象继续由 `FR-0011` 作为唯一正式来源：

- `write_interaction_tier`
- `risk_state_machine`
- `issue_action_matrix`
- `approval_record`
- `audit_record`
- `consumer_gate_result`

调用顺序必须是：

1. 先消费 `FR-0011` 的门禁结果与动作等级约束
2. 再选择 FR-0013 的 Layer 2 事件策略
3. 再执行状态收敛等待与结构化 trace 回传

## event_family_catalog

```json
{
  "event_family_catalog": [
    {
      "event_family": "pointer_click",
      "action_kinds": ["click"],
      "required_capability": ["pointer_targeting", "click_dispatch"]
    },
    {
      "event_family": "pointer_hover",
      "action_kinds": ["hover"],
      "required_capability": ["pointer_targeting", "hover_confirm"]
    },
    {
      "event_family": "focus_navigation",
      "action_kinds": ["focus"],
      "required_capability": ["focus_acquire", "active_element_check"]
    },
    {
      "event_family": "keyboard_text",
      "action_kinds": ["keyboard_input"],
      "required_capability": ["key_sequence", "framework_value_check"]
    },
    {
      "event_family": "composition_text",
      "action_kinds": ["composition_input"],
      "required_capability": ["composition_sequence", "change_blur_finalize"]
    },
    {
      "event_family": "scroll_viewport",
      "action_kinds": ["scroll"],
      "required_capability": ["segmented_scroll", "viewport_settle"]
    },
    {
      "event_family": "change_blur_finalize",
      "action_kinds": ["focus", "keyboard_input", "composition_input"],
      "required_capability": ["change_dispatch", "blur_dispatch"]
    }
  ]
}
```

约束：

- `event_family` 只允许上述枚举值。
- `action_kinds` 只能引用 `click`、`focus`、`keyboard_input`、`composition_input`、`hover`、`scroll`。
- 后续实现不得在调用点临时新增平行 family；新增 family 必须经过 spec review。
- `change_blur_finalize` 是事件链收口族，不代表独立上层命令。

## event_strategy_profile

```json
{
  "event_strategy_profile": {
    "event_family": "composition_text",
    "action_kind": "composition_input",
    "preferred_path": "mixed_input",
    "fallback_path": "synthetic_chain",
    "requires_focus": true,
    "requires_hover_confirm": false,
    "requires_settled_wait": true,
    "blocked_when_tier": ["irreversible_write"]
  }
}
```

约束：

- `event_family` 只允许 `event_family_catalog` 中的正式值。
- `action_kind` 只允许 `click`、`focus`、`keyboard_input`、`composition_input`、`hover`、`scroll`。
- `event_family` 与 `action_kind` 必须符合 `event_family_catalog.action_kinds` 映射。
- `preferred_path` 只能是 `real_input` 或 `mixed_input`。
- `fallback_path` 只允许为 `synthetic_chain` 或为空。
- `mixed_input` 表示“真实 focus / click + 合成输入链”的混合路径。
- `blocked_when_tier` 只能引用 `FR-0011.write_interaction_tier` 的正式等级名。

## event_chain_policy

```json
{
  "event_chain_policy": {
    "chain_name": "composition_input",
    "event_family": "composition_text",
    "action_kind": "composition_input",
    "required_events": [
      "focus",
      "compositionstart",
      "compositionupdate",
      "compositionend",
      "input",
      "change",
      "blur"
    ],
    "optional_events": ["mousedown", "mouseup", "click"],
    "completion_signal": ["dom_settled", "framework_value_updated"],
    "requires_settled_wait": true
  }
}
```

约束：

- `event_family` 必须与 `action_kind` 匹配。
- `action_kind` 只允许 `click`、`focus`、`keyboard_input`、`composition_input`、`hover`、`scroll`。
- `required_events` 不得为空。
- `completion_signal` 至少包含一个可判定结果。
- 若 `action_kind=keyboard_input`，`required_events` 不得自动继承 `composition*` 事件。
- 若 `requires_settled_wait=true`，执行方必须进入统一状态收敛等待。

## event_persona_profile

```json
{
  "event_persona_profile": {
    "persona_name": "default_event_local",
    "pointer_precision": "balanced",
    "hover_confidence": "medium",
    "typing_cadence": "natural",
    "scroll_style": "segmented",
    "correction_tendency": "low",
    "scope": "event_chain"
  }
}
```

约束：

- 本对象只表达事件级参数偏好，`scope` 只能是 `event_chain`。
- `pointer_precision` 只允许 `tight`、`balanced`、`loose`。
- `hover_confidence` 只允许 `low`、`medium`、`high`。
- `typing_cadence` 只允许 `steady`、`natural`、`variable`。
- `scroll_style` 只允许 `linear`、`segmented`、`scan_and_lookback`。
- `correction_tendency` 只允许 `none`、`low`、`medium`。
- 本对象不得被持久化为跨 session persona、平台历史行为基线或长期画像。

## rhythm_profile

```json
{
  "rhythm_profile": {
    "profile_name": "default_layer2",
    "persona_profile": "default_event_local",
    "hover_confirm_min_ms": 80,
    "hover_confirm_max_ms": 200,
    "click_jitter_min_px": 2,
    "click_jitter_max_px": 8,
    "typing_delay_min_ms": 60,
    "typing_delay_max_ms": 220,
    "punctuation_pause_multiplier": 1.8,
    "long_pause_probability": 0.08,
    "scroll_segment_min_px": 120,
    "scroll_segment_max_px": 480,
    "lookback_probability": 0.12,
    "distribution": {
      "type": "bounded_jitter",
      "deterministic_seed": "optional-replay-seed"
    }
  }
}
```

约束：

- 本对象只表达事件级节奏，不承载跨页面或跨 session 状态。
- `persona_profile` 必须引用 `event_persona_profile.persona_name`。
- `click_jitter_max_px` 必须 >= `click_jitter_min_px`。
- `lookback_probability` 只用于滚动段内的回头翻看，不等于 Layer 3 的完整浏览行为。
- `distribution.type` 只允许 `fixed`、`bounded_jitter`、`weighted_choice`。
- `deterministic_seed` 仅允许用于测试或最小重放，不得作为长期用户行为指纹。

## page_state_input

```json
{
  "page_state_input": {
    "target_visible": true,
    "target_interactable": true,
    "target_focused": false,
    "target_disabled": false,
    "target_readonly": false,
    "viewport_state": "stable",
    "occlusion_state": "clear",
    "layout_motion": "idle",
    "last_chain_result": "not_run"
  }
}
```

约束：

- 本对象是单次 Layer 2 策略选择的只读输入。
- `viewport_state` 只允许 `stable`、`scrolling`、`resizing`。
- `occlusion_state` 只允许 `clear`、`partial`、`blocked`。
- `layout_motion` 只允许 `idle`、`animating`、`loading`、`unknown`。
- `last_chain_result` 只允许 `not_run`、`settled`、`timeout`、`target_drifted`。
- 本对象不得承载 `session_rhythm_window_state`、cooldown、recovery、stability window 或 `runtime.audit.session_rhythm_status`。

## strategy_selection

```json
{
  "strategy_selection": {
    "event_family": "composition_text",
    "action_kind": "composition_input",
    "selected_path": "mixed_input",
    "strategy_profile": "composition_input_default",
    "event_chain": "composition_input",
    "persona_profile": "default_event_local",
    "rhythm_profile": "default_layer2",
    "page_state_input_used": true,
    "fallback_reason": null,
    "blocked_by": null
  }
}
```

约束：

- `selected_path` 允许取值：`real_input`、`mixed_input`、`synthetic_chain`、`blocked`。
- `event_family` 必须与 `action_kind` 匹配。
- 当 `selected_path=synthetic_chain` 时，`fallback_reason` 必填。
- 当 `selected_path=blocked` 时，`blocked_by` 必填，且必须能追溯到 `FR-0011` 或本 FR 的正式约束。

## execution_trace

```json
{
  "execution_trace": {
    "event_family": "composition_text",
    "action_kind": "composition_input",
    "selected_path": "mixed_input",
    "event_chain": "composition_input",
    "persona_profile_source": "default",
    "rhythm_profile_source": "default",
    "page_state_input_summary": "target_visible_interactable_not_focused",
    "required_events_applied": ["focus", "compositionstart", "compositionupdate", "compositionend", "input", "change", "blur"],
    "settled_wait_applied": true,
    "settled_wait_result": "settled",
    "failure_category": null
  }
}
```

约束：

- `event_family` 必须与 `action_kind` 匹配。
- `persona_profile_source` 只允许 `default` 或 `platform_override`。
- `rhythm_profile_source` 只允许 `default` 或 `platform_override`。
- `page_state_input_summary` 必须是摘要，不得回传敏感页面内容。
- `required_events_applied` 必须能与 `event_chain_policy.required_events` 对齐。
- `failure_category` 为空表示该次链路未进入失败分类。
- `failure_category` 非空时，只允许：
  - `focus_not_acquired`
  - `framework_state_not_updated`
  - `target_drifted`
  - `blocked_by_fr0011`

## acceptance_matrix

| event_family | required path | required events / signals | page_state_input | trace fields | test type | downstream issue |
| --- | --- | --- | --- | --- | --- | --- |
| `pointer_click` | `real_input` first, `synthetic_chain` only when allowed | `mousedown` / `mouseup` / `click` / settled signal | visible, interactable, clear occlusion | family, selected path, event chain, settled result | selector + orchestrator unit, relay contract | `#738`, `#740`, `#741` |
| `pointer_hover` | `real_input` | pointer move, hover confirm window | visible, viewport stable | family, rhythm source, page state summary | rhythm unit, content-script contract | `#738`, `#741` |
| `focus_navigation` | `real_input` first | focus, active element check | visible, interactable, not disabled | family, selected path, failure category | selector + page-state unit | `#738`, `#739` |
| `keyboard_text` | `real_input` first | keydown / input / keyup / change when needed | focused or focusable, not readonly | required events, persona source, settled result | orchestrator unit, framework-state contract | `#738`, `#739`, `#740` |
| `composition_text` | `mixed_input` allowed | compositionstart / update / end / input / change / blur | focused or focusable, not readonly | event chain, fallback reason, failure category | chain policy unit, controlled component contract | `#738`, `#739`, `#740` |
| `scroll_viewport` | `real_input` | segmented wheel/scroll, viewport settle | viewport stable or scrolling, layout motion | rhythm source, page state summary, settled result | rhythm unit, settle contract | `#738`, `#739`, `#741` |
| `change_blur_finalize` | selected chain dependent | change / blur / validation signal | focused or recently edited target | required events, settled result | chain policy unit, write boundary contract | `#739`, `#740`, `#741` |

约束：

- 矩阵是 `#737` 后续实现验收的最小覆盖面。
- `#738` 消费事件族、策略、链与节奏对象；`#739` 消费 `page_state_input` 与 settled wait 边界；`#740` 消费写路径阻断与 trace；`#741` 消费 trace 与回归证据基线。
- 矩阵不得新增 `FR-0014` 的 session/window 状态，也不得新增 `FR-0022` 的长期平台行为字段。

## 兼容策略

- 本契约在 FR-0013 阶段冻结字段语义，后续实现只能追加字段，不能改写既有字段含义。
- 平台覆盖只允许改值，不允许发明另一套平行对象名称。
