# FR-0014 TODO

## 评审阻断项

- [x] 明确写清 `#226/FR-0011` 是最小可执行前置，`#237/FR-0014` 只能追加不能重定义
- [x] 明确 `runtime.audit` 是读模型，不是新的真相源或写入口
- [x] 明确 `approval_record` / `audit_record` 继续是唯一正式审批/审计载体
- [x] 明确 `warmup` / `afterglow_hook` 仅是阶段挂点，不是完整 persona/内容编排承诺
- [x] 明确 `risks.md` 已覆盖并发、状态漂移、误放行、错误恢复、审计失真、回滚
- [x] 明确 `#742` 是完整契约与状态机冻结输入，`#743`-`#746` 是后续实现与验证消费方

## 进入实现前必须完成的动作

- [x] FR-0014 spec review 通过并形成明确结论（`#742` / PR `#789`）
- [x] 后续实现 PR 明确引用 `Refs #237` 与对应下游 issue（`#743`-`#746`），且不混入 `#208` 实现或 Layer 1/2/4 范围
- [x] 实现 PR 的测试计划覆盖窗口推进、恢复探测、稳定窗口、审计聚合一致性（PR `#790`-`#793`）
- [x] 若需要扩展持久化 schema，先对照 `data-model.md` 冻结命名、生命周期与回滚方式（PR `#790`）

## 后续实施清单

- [x] 建立 `session_rhythm_window_state` 的正式持久化落点（PR `#790`）
- [x] 建立 `session_rhythm_event` 与 `session_rhythm_decision` 的写入与查询链路（PR `#790`、`#791`）
- [x] 让 `runtime.audit` 输出 `session_rhythm_status_view`（PR `#791`）
- [x] 把 `approval_record` / `audit_record` 与窗口推进逻辑接线（PR `#791`、`#792`）
- [x] 增加并发 profile 争抢、stale window、重复恢复探测、审计晚到的失败注入测试（PR `#790`-`#793`）
- [x] 为 `warmup` / `afterglow_hook` 提供 Phase 2 最小挂点实现，不把它们伪装成完整 persona 系统（阶段枚举、schema 校验与持久化挂点已落地；Phase 2 不声明完整 persona 系统或主动 `afterglow_hook` 执行器）

## Closeout 证据

- `#742` / PR `#789` 冻结 FR-0014 完整 Layer 3 session rhythm 契约与状态机输入，merge commit `8fb4bb6fd58612cc91cfd90d8525034adc497e32`。
- `#743` / PR `#790` 建立 profile 级 session history、cooldown budget 与持久化 schema，merge commit `8294f0ec5ea977f4cbc774f282add71b710f34fa`。
- `#744` / PR `#791` 接入 read/write/recovery admission 统一节律决策与 `runtime.audit.session_rhythm_status_view`，merge commit `cc6973eb27fedde4b52ec213dec471d9a2a98a7d`。
- `#745` / PR `#792` 收口异常与 risk 状态恢复策略，merge commit `9c89eba153da14c69ff11e842a28db0d1d712053`。
- `#746` / PR `#793` 建立 Layer 3 多运行验证基线与回归门禁，merge commit `0a78ddf83bf5015b898e824af0a3bf246443829a`。
- 当前 closeout 口径：`warmup` / `afterglow_hook` 在 Phase 2 仅作为节律阶段壳、schema/枚举约束与持久化挂点；主动 persona 编排或主动 `afterglow_hook` runtime transition 不属于 FR-0014 Phase 2 关闭条件。
