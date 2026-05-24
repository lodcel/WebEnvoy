# FR-0013 Implementation Prep

## 目的与结论

本文档用于把 `FR-0013 / #236` 收口为后续实现 PR 的冻结输入。范围仅限：

- 找出真实实现入口、共享对象与测试入口
- 冻结与 `FR-0014` 的共享边界
- 冻结 `#737` 所需的完整事件族、事件级 persona/rhythm、页面状态输入和验收矩阵
- 给出最小可行实现切片
- 给出 ownership 建议，避免后续实现 PR 与 `FR-0014` 或 `FR-0011` 冲突

本文档不是功能实现说明，不改写 `spec.md` / `plan.md` / `contracts/` / `data-model.md` 的正式语义。

## 当前代码基线判断

当前仓库已经存在可直接承接 `FR-0013` 的三类真实入口，但还没有 Layer 2 事件策略运行时：

1. `extension/` 已经是插件层门禁与页面执行主落点
2. `shared/risk-state.js` 已经是 `FR-0011` 共享门禁对象与写路径 tier 的真相源
3. `tests/` 已经具备 extension relay / service worker / content script / CLI contract 入口，可作为 `FR-0013` 的首批测试承载面

额外风险：

- 当前 `FR-0011` gate 逻辑至少存在于 `extension/background.ts`、`extension/xhs-search.ts`、`src/runtime/native-messaging/loopback.ts` 三处
- `FR-0013` 若不先抽共享 Layer 2 selector / orchestrator，而是继续把判断写进各自实现，会放大复制漂移

因此，`FR-0013` 的后续实现应优先贴着 extension/content-script 执行链进入，而不是先去扩张 runtime/session/store 层。

## 后续实现目标拆分

### 1. 策略层

交付 `FR-0013` 契约中的默认 Layer 2 对象：

- `event_family_catalog`
- `event_strategy_profile`
- `event_chain_policy`
- `event_persona_profile`
- `rhythm_profile`
- `page_state_input`
- `strategy_selection`
- `execution_trace`

要求：

- 只新增 Layer 2 对象
- 只消费 `FR-0011.consumer_gate_result`、`write_interaction_tier`、`issue_action_matrix`
- 不新增并行 gate result 或 session 真相源
- persona/rhythm 只在事件链内生效，不形成长期画像或跨 session profile

### 2. 执行层

把 Layer 2 运行时接到 content-script 执行链，至少覆盖：

- `click`
- `focus`
- `keyboard_input`
- `composition_input`
- `hover`
- `scroll`

要求：

- 真实输入优先
- 混合路径仅限“真实 focus/click + 合成输入链”
- `synthetic_chain` 只作为已允许动作内的受限回退
- 每个 action 必须映射到正式 `event_family`，不得在消费侧发明局部 action/family 名称
- 执行前必须读取当前目标的 `page_state_input`，但不得写入 session/window 状态

### 3. 平台覆盖层

允许平台适配器覆盖默认值，但只允许覆盖值，不允许改语义：

- action 对应首选路径
- 是否要求 hover confirm
- 输入与滚动节奏范围
- 哪些 action 禁止回退

### 4. 观测与失败分类

把最小 `execution_trace` 接到现有返回 payload 与测试断言中，覆盖：

- `event_family`
- `selected_path`
- `event_chain`
- `persona_profile_source`
- `rhythm_profile_source`
- `page_state_input_summary`
- `required_events_applied`
- `settled_wait_applied`
- `settled_wait_result`
- `failure_category`

首刀不要求落 SQLite 持久化。

## 预计修改的代码路径

### 第一优先级

- `extension/content-script-handler.ts`
  - 现有 content-script 命令入口；后续最适合作为 Layer 2 selector / orchestrator 的注入点或调用点
- `extension/xhs-search.ts`
  - 现有平台执行链已经消费 gate 结果、approval、risk_state；后续最适合作为平台 override 消费侧样板
- `extension/background.ts`
  - 现有插件层 gate 主落点与 relay 结果整形位置；后续需要确保 Layer 2 只消费 gate 结果，不回写 gate 真相
- `extension/content-script.ts`
  - 若后续需要真正挂载页面监听、hover/scroll/input runtime，最终会在这里接入 bootstrap

### 第二优先级

- `shared/risk-state.js`
  - 当前是 `FR-0011` 共享对象真相源；后续只能被 `FR-0013` 消费，不能继续往这里塞 Layer 2/Layer 3 并行对象
- `src/runtime/risk-state.ts`
  - 只是 shared risk-state 的 runtime 导出面；FR-0013 首刀不建议把 Layer 2 配置塞到这里
- `src/runtime/native-messaging/loopback.ts`
  - 当前 CLI 合同测试依赖它模拟 gate / approval / audit 输出；后续若首刀需要打通端到端合同断言，这里应作为独立 ownership 跟进最小 Layer 2 替身
- `src/commands/runtime.ts`
  - 当前 `runtime.audit` 只聚合 `FR-0011` 风险输出；FR-0013 首刀不建议在这里扩张 session 或 Layer 2 查询模型

### 可能后置进入

- `src/runtime/store/runtime-store-recorder.ts`
- `src/runtime/store/sqlite-runtime-store.ts`

这两处只应在后续确实决定持久化 `execution_trace` 时再进入；不属于最小实现起步切片。

## 必须复用的共享对象 / 真相源

### 继续作为唯一真相源

- `FR-0011.consumer_gate_result`
- `FR-0011.write_interaction_tier`
- `FR-0011.issue_action_matrix`
- `FR-0011.session_rhythm_policy`
- `FR-0011.risk_state_machine`
- `FR-0010/0011.approval_record`
- `FR-0010/0011.audit_record`

### FR-0013 只能新增、不能替代的对象

- `event_family_catalog`
- `event_strategy_profile`
- `event_chain_policy`
- `event_persona_profile`
- `rhythm_profile`
- `page_state_input`
- `strategy_selection`
- `execution_trace`
- `acceptance_matrix`

### 推荐落点

后续实现应新增独立 Layer 2 配置/编排模块，例如：

- `extension/layer2/*.ts`
- 或 `shared/layer2/*.js|ts`

原则：

- `FR-0011` 的真相源继续留在 `shared/risk-state.js`
- `FR-0013` 的对象不要回灌到 `risk-state` 单文件里，避免 Layer 2/Layer 3 继续堆叠在同一共享模块

## 明确不能碰的边界

### 不得由 FR-0013 先定义

- `ProfileRhythmBinding`
- `session_rhythm_engine_input`
- `session_rhythm_window_state`
- `session_rhythm_event`
- `session_rhythm_decision`
- `session_rhythm_status_view`
- `runtime.audit.session_rhythm_status`
- 任何新的 session/window/cooldown 持久化 schema

以上对象已经属于 `FR-0014` 的正式范围。

### 不得扩 scope 的方向

- 不回改 `FR-0010/0011` 的 gate / approval / audit / risk_state 正式语义
- 不把 Layer 2 事件节奏写成 warmup / cooldown / recovery_probe / afterglow 的 session 阶段机
- 不把事件级 persona 参数写成长期画像、平台行为基线或跨 session profile 绑定
- 不把 `page_state_input` 写成 session/window 真相源或 `runtime.audit.session_rhythm_status`
- 不恢复 `#208`
- 不扩到完整写执行恢复
- 不引入新的 CLI 契约或 `runtime.audit` 查询面

## 与 FR-0014 的并行关系

### 可以并行

- `FR-0013` 默认事件策略对象与事件链编排
- `FR-0013` 平台 override 的消费侧
- `FR-0013` 事件级 trace 与失败分类
- `FR-0014` session 窗口、阶段、冷却、恢复探测、稳定窗口、状态视图

### 必须等待 FR-0014 先定或由 FR-0014 持有真相

- profile 级 `distribution_profile` / `ProfileRhythmBinding`
- 跨 action / 跨页面的节律窗口
- profile/session 级 distribution profile
- cooldown / recovery_probe / stability window 的持久化状态
- `runtime.audit` 的 session rhythm 查询输出
- 基于 session window 的允许 / deferred / blocked 判定对象

### 最容易冲突的文件/目录

- `shared/risk-state.js`
- `src/runtime/risk-state.ts`
- `src/commands/runtime.ts`
- `src/runtime/store/`

结论：

`FR-0013` 首刀应尽量不写上述目录，避免先把 Layer 3 的真相源做成 Layer 2 的临时实现。

## 最小可行实现切片

推荐后续正式实现 PR 的第一刀只做以下四件事：

1. 新增 Layer 2 默认对象模块
   - 提供 `event_family_catalog` / `event_strategy_profile` / `event_chain_policy` / `event_persona_profile` / `rhythm_profile`
2. 新增策略选择器
   - 输入只吃 `event_family + action_kind + FR-0011 gate result + page_state_input + optional platform override`
   - 输出 `strategy_selection`
3. 新增事件链编排器
   - 先覆盖 `composition_input`、`keyboard_input`、`hover_click`、`scroll`
   - 内建统一 settled-wait 调用点
4. 在一个现有平台消费侧挂接
   - 推荐先在 `extension/xhs-search.ts` 或其后续抽出的 content-script action runtime 上消费 override

### 最推荐的首刀落点

- 第一注入点：`extension/content-script-handler.ts`
  - 具体函数：`ContentScriptHandler.#handleXhsSearch()`
  - 角色：位于 `FR-0011` gate 之后、真实页面执行之前，最适合挂 `selector -> orchestrator -> executeXhsSearch`
- 第二消费点：`extension/xhs-search.ts`
  - 具体函数：`executeXhsSearch()`
  - 角色：平台 override 消费侧与 `execution_trace` 收口点
- 边界守卫：`extension/background.ts`
  - 具体函数：`#dispatchForward()` 及其 gate 分界逻辑
  - 角色：确保 background 继续只做 gate/relay，不成为 Layer 2 真相源

### 为什么这是一刀最小

- 不碰持久化
- 不碰 `runtime.audit` 查询模型
- 不碰 `FR-0014` 的 session/window 真相源
- 能直接把 `FR-0013` 契约对象落成可测试代码

## `#737` 后续 issue 验收切片

### `#738`：事件链拟人调度

必须消费：

- `event_family_catalog`
- `event_strategy_profile`
- `event_chain_policy`
- `event_persona_profile`
- `rhythm_profile`

验收重点：

- 键鼠、滚动、焦点、普通输入、composition 输入均映射到正式事件族。
- selector/orchestrator 不绕过 `FR-0011` gate。
- 单元测试覆盖事件族、路径选择、required events 与节奏采样。

### `#739`：页面状态感知 settle/recovery

必须消费：

- `page_state_input`
- `event_chain_policy.completion_signal`
- `execution_trace.settled_wait_result`

验收重点：

- 页面状态只作为当前目标/当前链路输入。
- settle/recovery 不抢 `FR-0014` 的 session/window/cooldown 真相源。
- 测试覆盖 target drift、layout motion、timeout 与 settled。

### `#740`：写路径安全边界与审计

必须消费：

- `strategy_selection.blocked_by`
- `execution_trace.failure_category`
- `required_events_applied`

验收重点：

- 写路径仍以 `FR-0011.write_interaction_tier` 为前置。
- 合成回退不得绕过已阻断动作等级。
- trace 可说明阻断来源、回退原因与事件链结果。

### `#741`：行为证据基线与回归门禁

必须消费：

- `acceptance_matrix`
- `execution_trace`
- selector/orchestrator 合同测试结果

验收重点：

- 每个事件族至少有一条可回归断言。
- 回归证据能对应矩阵中的 required path、required events、page state 与 trace 字段。
- 不要求 real-browser live 证据，除非 readiness/admission 已独立满足。

## 建议先补的测试

### 单元测试

优先新增：

- `strategy selector` 测试
  - gate blocked 时只能返回 `blocked`
  - `composition_input` 优先 `mixed_input`
  - `irreversible_write` tier 命中时阻断
- `event chain policy` 测试
  - `keyboard_input` 与 `composition_input` 事件链不同
  - `change/blur` 必须按策略出现
- `rhythm profile` 测试
  - hover confirm / typing delay / scroll segment 落在冻结范围内

### 集成测试

优先扩已有入口：

- `tests/content-script-handler.contract.test.ts`
  - 验证 content-script 消费 Layer 2 payload 不泄露 raw payload 边界
- `tests/extension.relay.contract.test.ts`
  - 验证 gate 通过后能返回 `strategy_selection` / `execution_trace`
  - 验证 gate blocked 时 Layer 2 不自作主张回退执行
- `tests/extension.service-worker.contract.test.ts`
  - 验证 background 仍只做 gate / relay，不成为 Layer 2 事件真相源

### 暂不建议首刀进入的测试

- `runtime.audit` 查询扩展测试
- SQLite schema/迁移测试
- session cooldown / recovery 窗口测试

这些都更接近 `FR-0014`。

## Ownership 建议

推荐把后续正式实现 PR 按“小切片 + 独立文件面”拆成 6 个 ownership，支持多子 agent 并行：

### Ownership 1：Layer 2 契约对象落地

负责范围：

- 新增 `extension/layer2/profiles.*`
- 新增 `extension/layer2/chains.*`
- 新增 `extension/layer2/types.*`

交付目标：

- 默认 `event_strategy_profile`
- 默认 `event_chain_policy`
- 默认 `rhythm_profile`

不负责：

- selector 逻辑
- 平台 override
- 测试接线外的执行调用

### Ownership 2：策略选择器

负责范围：

- 新增 `extension/layer2/selector.*`

交付目标：

- 输入 `action_kind + consumer_gate_result + write_interaction_tier + override`
- 输出 `strategy_selection`

不负责：

- 事件派发细节
- settled wait 实现
- runtime/store

### Ownership 3：事件链编排器

负责范围：

- 新增 `extension/layer2/orchestrator.*`
- 新增 `extension/layer2/settled-wait.*`

交付目标：

- `keyboard_input`
- `composition_input`
- `hover_click`
- `scroll`

不负责：

- gate 决策
- session/window 状态

### Ownership 4：平台 override 消费侧

负责范围：

- `extension/xhs-search.ts`
- `extension/content-script-handler.ts`

交付目标：

- 在现有 xhs 执行链里消费默认 Layer 2 对象
- 仅覆盖值，不改通用语义

不负责：

- 共享真相源
- SQLite/schema

### Ownership 5：Extension relay / background 边界守卫

负责范围：

- `extension/background.ts`
- `tests/extension.service-worker.contract.test.ts`

交付目标：

- 保证 background 继续只做 gate/relay
- 防止 Layer 2 事件状态反向沉到 background 或 gate payload 真相源

不负责：

- 事件链实现
- platform override 参数

### Ownership 6：测试切片

负责范围：

- 新增 `extension/layer2/__tests__/*`
- `tests/extension.relay.contract.test.ts`
- `tests/content-script-handler.contract.test.ts`

交付目标：

- selector 单测
- orchestrator 单测
- gate blocked / allowed 合同断言
- content-script 返回 `execution_trace` 的合同断言

不负责：

- `runtime.audit`
- `FR-0014` 查询模型

### 并行建议

建议并行方式：

1. 子 agent A：Ownership 1
2. 子 agent B：Ownership 2
3. 子 agent C：Ownership 3
4. 子 agent D：Ownership 6

串行收口点：

- Ownership 4 等 Ownership 1-3 冻结默认对象后再接
- Ownership 5 在 Ownership 4 准备合并前做边界守卫与回归

这样可以保持“小步快跑”：

- 每个切片都能单独 review
- 每个切片都只覆盖一组文件
- 不会把 `FR-0013` 和 `FR-0014` 的共享边界揉成一大坨实现

## 主要风险与回滚点

### 风险 1：Layer 2 误入 gate 真相源

表现：

- 把 `strategy_selection`、`execution_trace` 塞进 `consumer_gate_result`
- 修改 `shared/risk-state.js` 来承载 Layer 2/Layer 3 新对象
- 在 `background.ts`、`xhs-search.ts`、`loopback.ts` 三处各自复制一套 Layer 2 选择逻辑

回滚：

- 回退到独立 Layer 2 模块
- 保持 `consumer_gate_result` 只承载 `FR-0010/0011` 正式字段
- 把共享选择逻辑抽成单一 selector/orchestrator，再让三处只消费结果

### 风险 2：Layer 2 误入 Layer 3 session 节律

表现：

- 新增 cooldown / recovery / stability window 状态
- 在 `runtime.audit` 增加 session rhythm view

回滚：

- 删除新增窗口/状态对象
- 只保留事件级 rhythm profile 和单次 action trace

### 风险 3：平台 override 反向定义通用语义

表现：

- 在 xhs 专用实现里定义新的 chain name / path enum / trace 字段

回滚：

- 平台层只改值
- 通用对象字段回到 `contracts/layer2-humanized-events.md`

## 推荐的实现起步顺序

1. 先建 Layer 2 独立模块与默认对象
2. 再接 selector 与 orchestrator 单测
3. 再把一个平台消费侧接上 override
4. 最后才考虑是否需要把最小 `execution_trace` 暴露到更高层查询面

## 实施准备结论

当前文档已经把 `FR-0013` 的实现准备输入收口为可直接消费的边界参考，但不构成 implementation-ready 的正式裁决。后续正式实现仍需以前置 spec review 结论和相关依赖收口状态为准，并保持以下纪律：

- 第一刀只做事件级策略与编排，不做 session 真相源
- 第一刀只在 extension/content-script 侧落地，不去扩张 runtime/store
- 第一刀只消费 `FR-0011` gate 结果，不回改 `FR-0010/0011`
- `FR-0014` 继续独占 session/window/status 真相源

按上述切片推进，后续实现 PR 可以在不抢跑 `FR-0014` 的前提下低风险起步；是否正式进入实现，仍以 `FR-0013` 与相关依赖的进入实现前条件是否满足为准。
