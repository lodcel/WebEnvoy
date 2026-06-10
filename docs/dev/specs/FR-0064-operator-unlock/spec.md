# FR-0064 Operator Unlock

Canonical Issue: #1178

## 背景

`#1178 Operator Unlock` 属于 `#1117 Live Write Gate Alignment`。已合入的 `FR-0062 Live-Write Capability Taxonomy` 冻结了 `read_only`、`write_admit`、`write_prepare`、`live_write_commit` 四层 capability，并明确 `live_write_commit` 必须默认 locked，直到 operator unlock、default commit lock、provider requirements、account safety、runtime target binding、anti-detection gate 和 live evidence gate 同时满足。

本 FR 只冻结 `live_write_commit` 的显式 operator unlock 条件、audit evidence、fail-closed 默认和下游消费输入。它是 #1180 default lock 与 #1211 release gate matrix 的输入，不是 publish implementation，也不是 #835 的恢复或重跑。

## 目标

1. 冻结 `operator_unlock_record` 的最小契约，使下游 gate 能判断某个 `live_write_commit` 请求是否有显式 operator unlock。
2. 冻结 unlock scope 精确匹配规则，防止 profile、target、workflow、provider 或 head drift 后继续复用旧授权。
3. 冻结 audit evidence 与 redaction 要求，确保 operator unlock 可追溯、可撤销、可过期且不泄露账号或页面敏感内容。
4. 冻结 fail-closed 默认：缺失、过期、scope 不匹配、证据不可核查或 operator 身份不合规时，`live_write_commit` 必须保持 locked / deny。
5. 为 #1180 和 #1211 提供可消费的 operator unlock 输入字段与 blocking reasons。

## 非目标

- 不实现 runtime code、CLI、driver、adapter、provider selection、UI、tests、fixtures、scripts、workflows、guardian、formal review、controlled merge 或 issue closeout。
- 不执行 browser、profile、account、live、external-visible、upload、submit、publish、file picker、DataTransfer、editor text write、cleanup 或 rollback 操作。
- 不启用 `live_write_commit`，不解除 default commit lock，不声明 profile allowlist、account safety clear、provider requirement pass、runtime target binding pass 或 live evidence accepted。
- 不实现 XHS publish，不定义 Syvert normalized result，不引入 CloakBrowser-as-core、browser patching、provider private patch schema 或跨仓 shared contract。
- 不修改 `FR-0031`、`FR-0032`、`FR-0062` 的字段 shape；只消费其已冻结的 taxonomy 和 evidence 边界。
- 不修复、不重开、不关闭 #835；#835 的 closed 状态不是本 FR 的 operator unlock evidence。

## 功能需求

### 1. Operator unlock ownership

系统必须把 operator unlock 的正式 owner 固定为 `#1178` / `FR-0064`。

约束：

- Operator unlock 只回答“某个精确 scope 的 `live_write_commit` 是否获得显式操作者解锁”。
- Operator unlock 不等于 default commit lock release、provider requirement pass、account safety clear、runtime readiness、target binding、anti-detection gate pass、live evidence pass 或 publish success。
- Downstream gate 必须消费本 FR 的 unlock record，而不是用 issue 状态、PR merge、review comment 或人工口头说明替代 unlock record。

### 2. Unlock scope

系统必须要求每个 operator unlock record 绑定精确 scope。

必需 scope 字段：

- `capability_level`: 必须为 `live_write_commit`。
- `workflow_ref`: 例如 `xhs.creator_publish.commit` 或下游冻结的等价 workflow ref。
- `provider_requirement_ref`: #1179 或等价 accepted downstream provider requirement ref。
- `default_commit_lock_ref`: #1180 或等价 default lock disposition ref。
- `target_domain`
- `target_page`
- `profile_ref`
- `browser_channel`
- `execution_surface`
- `operator_ref`
- `head_sha`
- `unlock_reason_ref`
- `expires_at`

约束：

- Unlock scope 必须与请求的 `live_write_commit` scope 完全匹配；任何 profile、target、workflow、provider、runtime surface、head 或 lock ref drift 都必须 fail closed。
- `capability_level` 不能是 `read_only`、`write_admit` 或 `write_prepare` 的别名升级。
- `execution_surface` 必须为 `real_browser`，但该字段只声明 unlock scope，不证明真实浏览器 evidence 已通过。
- `head_sha` 只绑定 unlock record 适用的代码/契约输入；它不能替代 latest-head live evidence。

### 3. Explicit operator action

系统必须要求 operator unlock 来自显式操作者动作。

最低要求：

- `operator_ref` 必须指向可审计的操作者身份引用，而不是自然语言姓名、聊天文本或未绑定账号。
- `operator_action` 必须为 `unlock_live_write_commit`。
- `operator_intent` 必须说明本次 unlock 只适用于精确 scope。
- `acknowledged_risks` 必须至少覆盖 external-visible write、account safety、cleanup/residual、default lock release 和 latest-head live evidence requirements。
- `created_at`、`expires_at`、`revoked_at` 必须可机读；`expires_at` 必须存在。

约束：

- 缺少显式 operator action 时，不能从 PR approval、issue label、branch name、merged spec、guardian approve 或 hosted checks pass 推断 unlock。
- `revoked_at` 非空时，该 unlock 必须失效。
- `expires_at` 过期时，该 unlock 必须失效。
- Operator unlock 只能解除 “operator_unlock_missing” 这一类 blocker；其他 blocker 仍由对应 owner 判定。

### 4. Audit evidence

系统必须要求 operator unlock record 指向最小 audit evidence。

必需 evidence refs：

- `unlock_request_ref`
- `operator_identity_ref`
- `scope_snapshot_ref`
- `risk_ack_ref`
- `default_lock_disposition_ref`
- `provider_requirement_disposition_ref`
- `account_safety_ref`
- `runtime_target_binding_ref`
- `anti_detection_gate_ref`
- `live_evidence_gate_ref`

约束：

- Evidence refs 是 locator，不得内联 secret、账号标识、cookie、token、私有 profile path、页面正文、媒体内容或 live artifact payload。
- `account_safety_ref`、`runtime_target_binding_ref`、`anti_detection_gate_ref` 和 `live_evidence_gate_ref` 可以在 operator unlock record 中声明为 required refs；本 FR 不要求当前 PR 提供真实 live evidence。
- Stub/fake host、runtime ping、runtime bootstrap ack、control-plane-only signal、same-head historical artifact 或 #835 closed state 不能作为 unlock evidence。
- Evidence 不可核查、过期、scope mismatch 或 redaction 不合规时，unlock result 必须 blocked / deny。

### 5. Unlock evaluation result

系统必须提供下游可消费的 operator unlock evaluation result。

Allowed status:

- `not_requested`
- `missing`
- `present`
- `expired`
- `revoked`
- `scope_mismatch`
- `evidence_invalid`
- `operator_invalid`
- `accepted`

Allowed decision:

- `allow`
- `deny`
- `defer`

约束：

- 只有 status 为 `accepted` 且所有 required refs 对 exact scope 有效时，decision 才能为 `allow`。
- 任一 blocker 存在时，decision 必须为 `deny` 或 `defer`。
- `allow` 只表示 operator unlock blocker 已解除；它不允许绕过 #1180 default commit lock、#1179 provider requirements、account safety、runtime target binding、anti-detection gate、FR-0016 live evidence 或 FR-0032 controlled success ladder。

### 6. Fail-closed blocking reasons

本 FR 至少冻结以下 operator unlock blocking reasons：

- `operator_unlock_missing`
- `operator_unlock_expired`
- `operator_unlock_revoked`
- `operator_unlock_scope_mismatch`
- `operator_identity_missing`
- `operator_identity_untrusted`
- `operator_action_missing`
- `risk_ack_missing`
- `unlock_evidence_missing`
- `unlock_evidence_stale`
- `unlock_evidence_scope_mismatch`
- `unlock_redaction_invalid`
- `unlock_head_mismatch`
- `default_lock_disposition_missing`
- `provider_requirement_disposition_missing`
- `account_safety_ref_missing`
- `runtime_target_binding_ref_missing`
- `anti_detection_gate_ref_missing`
- `live_evidence_gate_ref_missing`

约束：

- 这些 blocking reasons 只覆盖 operator unlock lane；下游 gate 仍必须保留 FR-0062 已冻结的 broader blocking reasons。
- `operator_unlock_missing`、`operator_unlock_scope_mismatch`、`operator_unlock_expired`、`operator_unlock_revoked` 和 `operator_identity_untrusted` 对 `live_write_commit` 必须是 blocking。
- Unknown operator unlock status、unknown operator action 或 unknown identity trust state 必须 fail closed。

### 7. Downstream handoff

本 FR 冻结以下 handoff：

| downstream item | 消费输入 | 本 FR 不提供 |
|---|---|---|
| #1180 Default Lock | `operator_unlock_ref`、unlock decision、blocking reasons、scope matching result | default lock release |
| #1211 Live Write Gate Matrix | operator unlock status、audit evidence refs、fail-closed reasons | release gate pass |
| #1179 Provider Requirements | provider requirement ref linkage for exact scope | provider requirement pass |
| FR-0032 / #835 related baseline | controlled success ladder as downstream evidence context | current live evidence or #835 recovery |

约束：

- #1178 合入后只能说明 operator unlock contract frozen；不能关闭 #1180/#1211。
- #1178 PR 使用 `Refs #1178`，不得使用 auto-closing keyword。
- Downstream implementation 必须重新提供 current evidence refs；不能把本 spec 文本当作 operator unlock record。

## 异常与边界场景

### 1. PR approval 被误认为 operator unlock

Given a PR has reviewer approval
When a downstream gate requests `live_write_commit`
Then the gate must still require an `operator_unlock_record`
And PR approval alone cannot satisfy operator unlock.

### 2. Unlock scope 与请求 scope 不一致

Given an unlock record exists for profile A and target page A
When a commit request targets profile B or target page B
Then the unlock result is `scope_mismatch`
And decision is `deny`.

### 3. Unlock 已过期

Given an unlock record has `expires_at` in the past
When a commit request consumes it
Then the unlock result is `expired`
And blocking reasons include `operator_unlock_expired`.

### 4. Unlock 只解除 operator blocker

Given an accepted operator unlock record exists
When #1180 default commit lock remains active
Then `live_write_commit` remains locked
And #1180 still decides default lock release.

### 5. Historical live evidence 被复用

Given #835 is closed or an old live artifact exists
When a downstream gate uses it as operator unlock evidence
Then the unlock result is `evidence_invalid`
And the evidence must be treated as historical or stale.

### 6. Missing audit locator

Given an operator says they approve live commit in chat
When no `unlock_request_ref`, `risk_ack_ref` or `scope_snapshot_ref` exists
Then the unlock result is `missing`
And decision is `deny`.

## 验收标准

1. `spec.md` freezes explicit operator unlock ownership, scope, evidence refs, evaluation result, fail-closed behavior and downstream handoff.
2. `contracts/operator-unlock.md` provides machine-consumable types and enums.
3. `data-model.md` explains logical entities without adding SQLite schema, migrations or runtime persistence.
4. `plan.md` includes required seven sections and keeps implementation/live actions out of scope.
5. `TODO.md` records review and downstream handoff checks without becoming project truth source.
6. `risks.md` covers implicit unlock, stale evidence, scope drift, account safety and default lock confusion.
7. The PR only changes the FR-0064 suite and the #1178 sync-map entry, uses `Refs #1178`, and keeps `closingIssuesReferences=[]`.

## GWT 验收场景

### 场景 1：operator unlock is explicit

Given a downstream gate requests `live_write_commit`
When no `operator_unlock_record` exists for the exact scope
Then the result includes `operator_unlock_missing`
And `live_write_commit` remains locked.

### 场景 2：scope drift fails closed

Given an unlock record exists for one profile, target and head
When the request changes profile, target or head
Then the unlock evaluator returns `operator_unlock_scope_mismatch` or `unlock_head_mismatch`
And decision is not `allow`.

### 场景 3：accepted unlock does not bypass default lock

Given an operator unlock result is accepted
When #1180 default commit lock is still active
Then the overall live-write gate remains locked
And the accepted unlock only removes the operator unlock blocker.

### 场景 4：spec PR claims no live evidence

Given FR-0064 is a formal spec PR
When reviewer checks PR metadata and suite text
Then live evidence is marked not applicable
And no browser/account/runtime/live/write action is claimed.
