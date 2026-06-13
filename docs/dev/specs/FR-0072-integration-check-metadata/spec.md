# FR-0072 Integration Check Metadata

Canonical Issue: #1205

## 背景

`#1205 Integration Check Metadata` 属于 `#1120 Optional Syvert Integration`。上游 `docs/dev/architecture/system-design/boundary.md` 已冻结 WebEnvoy / Syvert / Provider 的依赖方向和 integration 触发条件：

- WebEnvoy core 默认按本仓库 local-only 事项推进。
- Syvert 是可选上层消费者，不是 WebEnvoy core 的组成部分。
- Provider 是执行能力或浏览器适配承载边界，不等于 WebEnvoy core，也不等于 Syvert mapping layer。
- 只有明确改变跨仓共享契约、provider adapter、跨仓执行模式或联合验收时，才升级 integration gate。

已合入的 `FR-0071 Syvert Mapping Hint Manifest` 进一步冻结：WebEnvoy 可以提供 mapping hints and handoff metadata，但不得把 Syvert normalized result、resource taxonomy、error taxonomy、workflow、provider adapter 或 active integration gate 写进 WebEnvoy core。

当前缺口是：PR 描述中的 `integration_check` metadata 已存在于仓库模板和 merge gate 检查中，但 #1205 需要正式冻结何时必须声明 `integration_applicable`、`integration_touchpoint`、`shared_contract_changed` 和 `joint_acceptance_needed`，以及这些字段与 `integration_ref`、`external_dependency`、`merge_gate`、`contract_surface`、提 PR 前/合并前状态检查的关系。否则后续 Syvert / Provider 相关 PR 容易把 local-only 文档误升级为 integration-gated，或把真正的 shared-contract / joint-acceptance PR 错报为本地事项。

本 FR 只冻结 `integration_check` PR metadata 的 formal contract 和最小校验口径。它不实现 Syvert normalized result、provider adapter、joint acceptance runtime、CLI / JSON-RPC output、live evidence、browser/profile/account 行为，也不运行 guardian、formal review、controlled merge 或 issue closeout。

本 suite 是 #1205 的 formal spec review carrier。当前 PR 必须使用 `Refs #1205`，等待 scheduler-owned spec review / gate。

## 目标

1. 冻结 `integration_check` PR metadata 的字段集合、枚举、默认 local-only 口径和 integration-gated 升级条件。
2. 明确何时 PR 必须声明 `integration_applicable=yes`、`integration_touchpoint != none`、`shared_contract_changed=yes` 或 `joint_acceptance_needed=yes`。
3. 明确 `integration_ref`、`external_dependency`、`merge_gate`、`contract_surface` 与提 PR 前/合并前状态检查之间的 fail-closed 关系。
4. 明确 WebEnvoy-local formal docs / governance / implementation PR 不因未来可能被 Syvert 使用而自动升级为 integration-gated。
5. 为现有 PR template、guardian merge-gate parser 和后续 metadata tests 提供正式契约，不改变 runtime output。

## 非目标

- 不定义 Syvert normalized result、Syvert resource taxonomy、Syvert error taxonomy、Syvert workflow、Syvert project state 或 Syvert-owned mapping contract。
- 不实现 WebEnvoy provider adapter、Syvert provider adapter、joint acceptance implementation、integration project automation、runtime output writer、CLI / JSON-RPC wrapper、parser rewrite、workflow rewrite、guardian、formal review、controlled merge 或 issue closeout。
- 不改变 WebEnvoy shared output、error code、`raw` / `normalized` / `diagnostics` / `observability` payload、`task_id` / `request_id` / `run_id` 生成或消费规则。
- 不修改 browser/profile/extension/Native Messaging/account/live/read/write behavior。
- 不把 FR-0071 mapping hints、WebEnvoy evidence refs 或 future Syvert consumption 自动解释为 active integration gate。
- 不扩大到 M14+ scheduling、release gate、integration closeout 或跨仓联合验收执行。

## 功能需求

### 1. Metadata ownership

系统必须冻结一个稳定的 `integration_check` PR metadata contract。

约束：

- ownership 属于 #1205 / FR-0072。
- 该 contract 只约束 PR metadata、review/gate consumption 和 fail-closed 分类。
- 该 contract 不得被解释为：
  - runtime schema
  - Syvert normalized result
  - provider adapter contract
  - joint acceptance implementation
  - integration project state
  - live evidence record
  - issue closeout proof
- 后续 PR 若新增字段或放宽 fail-closed 关系，必须通过独立 formal spec / governance PR 更新本 contract 或明确 supersede。

### 2. Required field set

任何进入 PR review / merge gate 的 PR 描述必须提供 `integration_check` block，至少包含：

- `integration_applicable`
- `integration_touchpoint`
- `integration_ref`
- `shared_contract_changed`
- `external_dependency`
- `merge_gate`
- `contract_surface`
- `joint_acceptance_needed`
- `integration_status_checked_before_pr`
- `integration_status_checked_before_merge`

约束：

- 字段必须使用 parser-consumable plain YAML-like block 或等价可解析结构；不得只写自然语言说明。
- 缺失任一字段时，merge-ready gate 必须 fail closed。
- unknown enum、空值、拼写漂移或无法解析的 block 必须 fail closed。
- PR template 可以保留人工说明，但机器消费以字段值为准。

### 3. Field enums

字段枚举固定如下：

```yaml
integration_applicable: yes | no
integration_touchpoint: none | check_required | active | blocked | resolved
integration_ref: none | <concrete integration issue or project item ref>
shared_contract_changed: yes | no
external_dependency: none | syvert | webenvoy | both
merge_gate: local_only | integration_check_required
contract_surface:
  - none
  - execution_provider
  - ids_trace
  - errors
  - raw_normalized
  - diagnostics_observability
  - runtime_modes
  - integration_governance
joint_acceptance_needed: yes | no
integration_status_checked_before_pr: yes | no
integration_status_checked_before_merge: yes | no
```

约束：

- `integration_governance` 只用于 integration gate / review 语义、联合验收口径、metadata parser / policy 等治理表面，不得误标为 runtime business surface。
- `contract_surface=none` 只允许用于 local-only PR。
- `integration_ref=none` 只允许在 `integration_applicable=no` 时使用。
- `integration_applicable=yes` 时，`integration_ref` 必须指向可核查的具体 integration issue / project item；只写 owner-level project root、空值、`TBD` 或自然语言说明无效。

### 4. Local-only default

WebEnvoy core、普通本仓库治理 / 文档 / 实现事项默认 local-only。

local-only PR metadata 必须满足：

```yaml
integration_applicable: no
integration_touchpoint: none
integration_ref: none
shared_contract_changed: no
external_dependency: none
merge_gate: local_only
contract_surface: none
joint_acceptance_needed: no
integration_status_checked_before_pr: yes
integration_status_checked_before_merge: yes
```

约束：

- 仅因未来可能被 Syvert 或其他上层消费者使用，不得升级为 `integration_applicable=yes`。
- 只冻结 WebEnvoy-owned hints、refs、internal docs、formal suite、governance wording 或 local implementation，且不改变 shared contract / provider adapter / joint acceptance 时，保持 local-only。
- local-only PR 仍必须提供 `integration_status_checked_before_pr` 与 `integration_status_checked_before_merge` 字段；若不适用，值仍写 `yes` 表示作者和 merge gate 已确认无需 integration ref 检查。
- local-only PR 不得使用 `contract_surface=integration_governance` 来表达普通本仓库治理；只有 integration gate / review 语义本身被修改且 PR 被判定 integration-gated 时才使用该 surface。

### 5. Integration-gated triggers

满足以下任一条件时，PR 必须升级为 integration-gated：

- 明确进入 Syvert provider / WebEnvoy provider adapter。
- 改变跨仓共享输入输出。
- 改变错误码或错误语义。
- 改变 `raw` / `normalized` / `diagnostics` / `observability` 的共享语义。
- 改变 `task_id` / `request_id` / `run_id` 的共享生成、传递或消费规则。
- 改变跨仓共享执行模式。
- 改变 provider/shared-contract integration gate 口径。
- 改变联合验收规则、joint acceptance status 或 joint acceptance evidence requirement。
- 依赖 Syvert、WebEnvoy 或其他仓库先做、同步做或共同验收。
- PR 本身声明 `shared_contract_changed=yes`、`external_dependency != none` 或 `joint_acceptance_needed=yes`。

integration-gated PR metadata 必须满足：

```yaml
integration_applicable: yes
integration_touchpoint: check_required | active | blocked | resolved
integration_ref: <concrete integration issue or project item ref>
merge_gate: integration_check_required
contract_surface: <non-none surface>
integration_status_checked_before_pr: yes
integration_status_checked_before_merge: yes
```

约束：

- `integration_touchpoint=none` 与 `integration_applicable=yes` 不兼容。
- `merge_gate=local_only` 与任一 integration-gated trigger 不兼容。
- `contract_surface=none` 与 integration-gated PR 不兼容。
- 若 PR 只修改 integration gate / review 语义、metadata parser、template rules 或联合验收口径，`contract_surface` 必须为 `integration_governance`。
- `integration_status_checked_before_pr=yes` 表示作者在创建或更新 PR 前已核对 integration ref 状态；`integration_status_checked_before_merge=yes` 表示 latest head merge-ready 前已重新核对。缺失或 `no` 必须阻断对应阶段。

### 6. `shared_contract_changed` semantics

`shared_contract_changed=yes` 表示 PR 改变被跨仓、provider adapter、Syvert consumer 或 joint acceptance 消费的稳定契约。

约束：

- `shared_contract_changed=yes` 必须伴随 `integration_applicable=yes`、`merge_gate=integration_check_required` 与非 `none` 的 `contract_surface`。
- `shared_contract_changed=no` 不足以自动证明 local-only；仍需检查 provider adapter、external dependency、joint acceptance 和 integration gate 触发条件。
- WebEnvoy-owned formal docs 可以被未来消费者引用，但只要不冻结 shared input/output 或 consumer-owned schema，仍可保持 `shared_contract_changed=no`。
- FR-0071 mapping hint manifest 是 local-only 输入事实；后续若把 hints 写入 shared output 或 Syvert-owned wrapper，必须重新判断为 shared contract change。

### 7. `integration_touchpoint` semantics

`integration_touchpoint` 表达当前 PR 与 integration ref 的关系：

| value | 语义 |
|---|---|
| `none` | 当前 PR 是纯本仓库事项，不需要 integration ref。 |
| `check_required` | 实现前 / PR 前必须核对 integration ref，但当前 PR 不被外部 blocker 阻塞。 |
| `active` | 当前 PR 正受 integration ref 约束，且需要保持状态同步。 |
| `blocked` | 当前 PR 被 integration ref 或跨仓依赖阻塞。 |
| `resolved` | 当前 PR 的 integration 约束已在 ref 中收口，并仍需 merge 前 readback。 |

约束：

- `check_required|active|blocked|resolved` 均要求 `integration_applicable=yes` 和具体 `integration_ref`。
- `blocked` 不表示 worker 可继续实施；必须在 PR / scheduler report 中给出 blocker owner 和 next action。
- `resolved` 不替代 `integration_status_checked_before_merge=yes`。
- `none` 不得与 `shared_contract_changed=yes`、`external_dependency != none` 或 `joint_acceptance_needed=yes` 同时出现。

### 8. `joint_acceptance_needed` semantics

`joint_acceptance_needed=yes` 表示本 PR 的完成或 merge 放行需要 WebEnvoy 以外的仓库、integration issue / item 或联合验收动作共同确认。

约束：

- `joint_acceptance_needed=yes` 必须伴随 `integration_applicable=yes`、具体 `integration_ref`、`merge_gate=integration_check_required` 和非 `none` `contract_surface`。
- 即使 PR 没有直接改变 shared field，只要完成条件依赖联合验收，也不得申报 local-only。
- `joint_acceptance_needed=no` 不表示无需核对 integration ref；若其他 trigger 命中，仍必须 integration-gated。
- Joint acceptance implementation、runtime execution、hosted integration run 或 issue closeout 不属于本 FR；本 FR 只冻结 metadata gate。

### 9. Fail-closed relationship matrix

以下组合必须 fail closed：

- `integration_check` block 缺失。
- 任一 required field 缺失、空值、unknown enum 或不可解析。
- `integration_applicable=no` 且 `integration_ref != none`。
- `integration_applicable=yes` 且 `integration_ref=none|TBD|project-root-only`。
- `integration_applicable=yes` 且 `integration_touchpoint=none`。
- `integration_applicable=yes` 且 `merge_gate=local_only`。
- `integration_applicable=yes` 且 `contract_surface=none`。
- `shared_contract_changed=yes` 且 `integration_applicable=no`。
- `shared_contract_changed=yes` 且 `merge_gate != integration_check_required`。
- `external_dependency != none` 且 `integration_applicable=no`。
- `joint_acceptance_needed=yes` 且 `integration_applicable=no`。
- `integration_touchpoint != none` 且 `integration_applicable=no`。
- integration-gated PR 中 `integration_status_checked_before_pr=no`。
- merge-ready integration-gated PR 中 `integration_status_checked_before_merge=no`。
- integration gate / review semantics changed but `contract_surface != integration_governance`。

约束：

- Parser / reviewer 可以给出更精确错误信息，但不得把以上组合降级为 warning。
- 同类 metadata drift 修复后，必须做 same-class audit，确认模板、docs、parser tests 和 PR body 一致。

### 10. PR lifecycle obligations

PR 生命周期中必须保持 metadata 与 actual diff / issue scope 一致。

约束：

- 创建 PR 前：作者必须按 actual diff 与 issue scope 填写 `integration_check`，并记录 `integration_status_checked_before_pr`。
- PR 更新后：若 diff 或 issue scope 触发 integration-gated 条件，必须同步更新 `integration_check`。
- merge-ready 前：必须重新 read back PR body、head SHA、issue state 和 integration ref 状态；integration-gated PR 必须把 `integration_status_checked_before_merge` 更新为 `yes`。
- PR body 只改 metadata 也会改变 gate 输入；若只修 metadata，应重新运行相关 parser / metadata validation。
- scheduler-owned guardian / formal review / controlled merge 不属于 worker 自动执行范围；worker 完成本地验证后停在 scheduler gate。

## 异常与边界场景

- PR 是 WebEnvoy-owned formal spec，未来可能被 Syvert 消费，但不改变 shared output：保持 local-only。
- PR 修改 provider adapter contract、provider health shared diagnostics 或 provider runtime execution surface：integration-gated，`contract_surface` 选择最接近的 shared surface。
- PR 修改 integration metadata parser、PR template integration gate 规则或 reviewer addendum 中 integration 口径：若被判定影响 provider/shared-contract gate 口径，使用 `contract_surface=integration_governance`。
- PR 只修普通本仓库文案、README 或 local docs，没有 shared contract / joint acceptance：local-only。
- PR 添加 `shared_contract_changed=yes` 但声称 `integration_applicable=no`：阻断。
- PR 需要 Syvert 侧确认 mapping、taxonomy 或 wrapper 消费，但 WebEnvoy diff 不含 shared output：如果 completion depends on that external confirmation，仍使用 `joint_acceptance_needed=yes` 和 integration gate。
- PR 声称 live evidence / real browser closeout：本 FR 只处理 integration metadata；live evidence gate 仍按 FR-0016 / PR template / code_review 规则另行判定。

## GWT 验收场景

### 场景 1：local-only formal spec 不因未来 Syvert 消费升级

Given 一个 WebEnvoy formal spec 只冻结本仓库-owned hint 或 metadata 文档
And 不改变 shared output、provider adapter、Syvert-owned schema 或 joint acceptance
When 作者填写 `integration_check`
Then `integration_applicable` 必须为 `no`
And `integration_ref` 必须为 `none`
And `merge_gate` 必须为 `local_only`

### 场景 2：shared contract 改动必须启用 integration gate

Given 一个 PR 改变跨仓共享输出或 provider adapter contract
When 作者填写 `integration_check`
Then `shared_contract_changed` 必须为 `yes`
And `integration_applicable` 必须为 `yes`
And `merge_gate` 必须为 `integration_check_required`
And `contract_surface` 不得为 `none`

### 场景 3：joint acceptance 不得申报 local-only

Given 一个 PR 的完成条件依赖 Syvert 侧或 integration issue 的联合验收
When 作者填写 `integration_check`
Then `joint_acceptance_needed` 必须为 `yes`
And `integration_ref` 必须指向具体 integration issue / item
And `integration_status_checked_before_merge` 必须在 merge-ready 前为 `yes`

### 场景 4：integration governance surface

Given 一个 PR 修改 integration gate / review 语义或 metadata parser 规则
When 该 PR 被判定为 integration-gated
Then `contract_surface` 必须为 `integration_governance`
And 不得回退为 `none`

### 场景 5：缺字段阻断 merge-ready

Given PR body 缺少 `integration_check.merge_gate`
When merge gate 解析 PR metadata
Then 必须 fail closed
And 不得仅根据标题、路径或 issue labels 推断为 local-only

### 场景 6：提 PR 前与合并前状态 readback

Given 一个 integration-gated PR 已填写具体 `integration_ref`
When PR 进入 merge-ready
Then `integration_status_checked_before_pr` 必须为 `yes`
And `integration_status_checked_before_merge` 必须为 `yes`
And scheduler / merge gate 必须能 read back 当前 PR body 中这些字段

## 验收标准

1. `FR-0072` suite 明确 #1205 的 `integration_check` metadata owner、字段集合、枚举、local-only 默认、integration-gated trigger、field relationship matrix 和 PR lifecycle obligations。
2. Suite 明确 #1205 不实现 Syvert normalized result、provider adapter、joint acceptance implementation、runtime/live evidence、browser/account behavior、guardian/formal review/controlled merge 或 issue closeout。
3. `.github/spec-issue-sync-map.yml` 新增 `FR-0072 -> #1205` 映射。
4. Existing PR template / docs / guardian merge-gate parser expectations can consume or align with the contract; if drift exists, it is either fixed in this PR within allowed scope or recorded as scheduler-visible blocker.
