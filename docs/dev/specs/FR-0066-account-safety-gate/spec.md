# FR-0066 Account Safety Gate

Canonical Issue: #1176

## 背景

`#1176 Account Safety Gate` 属于 `#1117 Live Write Gate Alignment`。已合入的 `FR-0062 Live-Write Capability Taxonomy` 冻结了 `read_only`、`write_admit`、`write_prepare`、`live_write_commit` 四层能力，并要求 higher level 缺少 required gate 时 fail closed。`FR-0064 Operator Unlock` 已冻结 `live_write_commit` 必须有显式 operator unlock，且 unlock record 只解除 operator lane，不证明 account safety、default lock、provider requirement、runtime target binding、anti-detection gate 或 live evidence。

`FR-0032 / #835` 已把 `account_safety_state=clear` 列为受控 live write entry gate 的必要条件。`#1181 Live-Write Evidence Redaction` 已完成，要求 live-write evidence 默认脱敏 account、profile、proxy、seed 和 secret-bearing paths。当前缺口是：account safety state 自身尚未有独立 formal owner、状态枚举、freshness、evidence refs、redaction、fail-closed blocking reasons 与下游消费规则。

本 FR 只冻结 account safety gate contract。它要求任何 `write_prepare` 或 `live_write_commit` admission 在进入前必须具备当前 scope 的 account safety state，并且该 state 必须为 `clear` 才能继续。本 FR 不启用 `live_write_commit`，不实现 XHS publish，不执行 browser / profile / account / live / write 操作，也不修复、不重跑、不重开 #835。

## 目标

1. 冻结 `account_safety_gate` 的 formal owner、scope、state enum 和 fail-closed 语义。
2. 冻结 `write_prepare` 与 `live_write_commit` admission 前必须消费 `account_safety_state` 的规则。
3. 冻结 account safety evidence refs、freshness、scope matching、redaction 与 disclosure boundary。
4. 明确 #835、#1174、#1178、#1181 的消费方式，防止历史 baseline、operator unlock 或 redaction success 被误写成 current safety clear。
5. 为 #1179、#1180、#1211 和后续 runtime/live owner 提供可消费的 account safety gate result 与 blocking reasons。

## 非目标

- 不实现 runtime code、CLI、driver、adapter、provider selection、tests、fixtures、scripts、workflows、guardian、formal review、controlled merge 或 issue closeout。
- 不执行 browser、profile、account、live、external-visible、upload、submit、publish、file picker、DataTransfer、editor text write、cleanup 或 rollback 操作。
- 不启用 `live_write_commit`，不解除 default commit lock，不声明 operator unlock accepted、provider requirement pass、runtime target binding pass、anti-detection gate pass 或 live evidence accepted。
- 不实现 XHS publish，不定义 Syvert normalized result，不引入 CloakBrowser-as-core、browser patching、provider private patch schema 或跨仓 shared contract。
- 不修改 `FR-0031`、`FR-0032`、`FR-0062`、`FR-0064`、`FR-0041` 或 provider/evidence contracts 的字段 shape；只消费其已冻结的边界。
- 不修复、不重开、不关闭 #835；#835 的 closed baseline 只作为历史背景，不是当前 account safety evidence。

## 功能需求

### 1. Account safety ownership

系统必须把 account safety gate 的正式 owner 固定为 `#1176` / `FR-0066`。

约束：

- Account safety gate 只回答“当前 exact scope 的账号安全状态是否允许进入 `write_prepare` 或 `live_write_commit` admission”。
- Account safety gate 不等于 operator unlock、provider requirement pass、default lock release、runtime readiness、target binding、anti-detection gate、live evidence accepted、publish success 或 cleanup success。
- Downstream gate 必须消费本 FR 的 `account_safety_gate_result` 或等价 accepted result，而不是用 issue state、PR merge、review comment、operator acknowledgement、#835 closed state 或 hosted checks pass 替代。

### 2. Scope binding

每个 account safety evaluation 必须绑定 exact scope。

必需 scope 字段：

- `capability_level`: `write_prepare` 或 `live_write_commit`；`write_admit` 可请求 safety classification，但不能因此进入 preparation / commit。
- `workflow_ref`
- `target_domain`
- `target_page`
- `profile_ref`
- `browser_channel`
- `execution_surface`
- `provider_requirement_ref`
- `runtime_target_binding_ref`
- `operator_unlock_ref`，仅 `live_write_commit` 必需
- `head_sha`
- `run_id` 或 `evaluation_context_ref`

约束：

- Scope 必须与 downstream requested capability scope 完全匹配；任何 workflow、target、profile、provider、runtime target binding、operator unlock、head 或 run/evaluation context drift 都必须 fail closed。
- `execution_surface=real_browser` 是 write-prep / commit scope 的必要字段，但不能单独证明 safety clear。
- `write_admit` 只能产出 classification 或 blocker；缺少 `clear` 时不得升级到 `write_prepare`。

### 3. Account safety states

Account safety state 必须至少支持：

| state | 语义 | 可否放行 `write_prepare` / `live_write_commit` |
|---|---|---|
| `clear` | 当前 exact scope 未发现账号安全 blocker，且 required evidence fresh、redacted、scope matched。 | 可以作为必要条件之一 |
| `unknown` | 没有足够证据判断账号安全，或 required evidence 缺失。 | 否 |
| `blocked` | 已发现账号安全阻断信号。 | 否 |
| `stale` | 曾经的 safety evidence 已过期、head/run/profile/target drift 或 freshness 不满足。 | 否 |
| `redaction_invalid` | required safety evidence 包含 raw account/profile/secret/path 或 redaction policy gap。 | 否 |
| `requires_operator_attention` | 需要人工确认登录、安全提示、风控挑战或残留风险，但当前回合不得用 live action 探测。 | 否 |

约束：

- 只有 `state=clear` 且 blockers 为空时，account safety lane 才能返回 `decision=allow`。
- Unknown state、unknown enum、missing state、unsupported state 必须 fail closed。
- `clear` 只表示 account safety lane 不阻断；它不替代 #1180 default lock、#1178 operator unlock、#1179 provider requirement、runtime target binding、anti-detection gate 或 live evidence。

### 4. Safety signal classes

Account safety evaluation 必须能表达至少以下 signal classes：

- `login_required`
- `captcha_required`
- `security_redirect`
- `account_restricted`
- `account_verification_required`
- `rate_limited`
- `browser_environment_abnormal`
- `profile_concurrency_conflict`
- `session_integrity_unknown`
- `previous_residual_unresolved`
- `cleanup_or_rollback_pending`
- `account_identifier_redaction_invalid`
- `safety_evidence_stale`

约束：

- 任一 blocking signal 命中 required path 时，state 必须为 `blocked`、`unknown`、`stale`、`redaction_invalid` 或 `requires_operator_attention`，不得为 `clear`。
- Login challenge、captcha、安全验证、账号限制、security redirect 或 browser abnormal 出现时，later write actions 必须保持 blocked。
- `requires_operator_attention` 不能被 operator unlock 自动解除；operator unlock 只属于 FR-0064 lane。

### 5. Required evidence refs

Account safety result 必须引用 evidence refs，而不是内联敏感值。

必需 evidence refs：

- `safety_check_ref`
- `profile_ref`
- `runtime_status_ref`
- `target_binding_ref`
- `signal_scan_ref`
- `redaction_policy_ref`
- `freshness_ref`
- `risk_disposition_ref`

`live_write_commit` 额外需要：

- `operator_unlock_ref`
- `default_commit_lock_ref`
- `live_evidence_gate_ref`

约束：

- Evidence refs 必须是 locator，不得内联 cookie、token、account identifier、profile path、browser path、private URL、page content、media content、secret、raw storage 或 live artifact payload。
- Evidence refs 必须消费 `FR-0041` redaction policy 和 #1181 redaction work item 的默认脱敏要求。
- Required evidence missing、unavailable、partial、stale、scope mismatch、redaction invalid 或只来自 control-plane signal 时，state 不得为 `clear`。

### 6. Freshness and current-head binding

Account safety state 必须绑定 freshness。

最低 freshness 要求：

- `write_prepare`: 当前 PR head 或当前 bounded evaluation context 下的 fresh safety result。
- `live_write_commit`: 当前 latest head、current run、exact scope 的 fresh safety result。

约束：

- #835 closed baseline、旧 run、旧 artifact、same-head historical artifact、runtime ping、runtime bootstrap ack、stub/fake host 或 control-plane-only signal 均不能满足 current safety clear。
- `checked_at`、`expires_at` 或 equivalent freshness ref 必须存在；过期或缺失时 state 必须为 `stale` 或 `unknown`。
- 如果 target/profile/head/run 发生 drift，必须重新评估 account safety，不能沿用旧 clear。

### 7. Gate result

Account safety gate 必须输出可消费 result。

Allowed decision:

- `allow`
- `deny`
- `defer`

Allowed gate status:

- `not_applicable`
- `clear`
- `unknown`
- `blocked`
- `stale`
- `redaction_invalid`
- `requires_operator_attention`

约束：

- `decision=allow` 只允许在 `gate_status=clear`、`blocking_reasons=[]`、required evidence fresh 且 scope matched 时出现。
- `decision=allow` 只移除 account safety lane blocker；不得解除 default commit lock、operator unlock、provider requirement、runtime target binding、anti-detection gate 或 live evidence gate。
- `decision=defer` 只允许在需要 downstream owner 或人工确认但不能执行 account/live/write action 的场景。

### 8. Blocking reasons

本 FR 至少冻结以下 blocking reasons：

- `account_safety_state_missing`
- `account_safety_unknown`
- `account_safety_blocked`
- `account_safety_stale`
- `account_safety_scope_mismatch`
- `account_safety_head_mismatch`
- `account_safety_run_mismatch`
- `login_required`
- `captcha_required`
- `security_redirect`
- `account_restricted`
- `account_verification_required`
- `rate_limited`
- `browser_environment_abnormal`
- `profile_concurrency_conflict`
- `session_integrity_unknown`
- `previous_residual_unresolved`
- `cleanup_or_rollback_pending`
- `safety_evidence_missing`
- `safety_evidence_stale`
- `safety_evidence_redaction_invalid`
- `stub_or_fake_host_evidence`
- `control_plane_only_signal`
- `historical_or_stale_evidence`
- `operator_attention_required`
- `downstream_owner_required`

约束：

- `write_prepare` 或 `live_write_commit` 请求命中任何 required blocking reason 时，decision 必须为 `deny` 或 `defer`。
- Unknown blocking reason 或 unknown safety state 必须 fail closed。
- `safety_evidence_redaction_invalid`、`stub_or_fake_host_evidence`、`control_plane_only_signal` 和 `historical_or_stale_evidence` 必须阻断 `live_write_commit`。

### 9. Downstream handoff

本 FR 冻结以下 handoff：

| downstream item | 消费输入 | 本 FR 不提供 |
|---|---|---|
| #1179 Provider Requirements | Account safety required ref for `write_admit` / `write_prepare` provider requirement disposition | provider requirement pass |
| #1180 Default Lock | Account safety clear is required before any exact-scope commit lock release can be considered | default lock release |
| #1211 Live Write Gate Matrix | Safety status、blocking reasons、freshness and redaction validity | release gate pass |
| #1178 Operator Unlock | May reference `account_safety_ref` as required evidence locator | operator unlock accepted |
| FR-0032 / #835 | Controlled success ladder remains downstream context | current live evidence or #835 recovery |

约束：

- #1176 合入后只能说明 account safety contract frozen；不能关闭 #1179/#1180/#1211。
- Downstream implementation 必须重新提供 current scoped account safety refs；不能把本 spec 文本当作 safety clear。
- #835 的 closed 状态只证明 historical controlled live-write baseline 已存在，不证明当前 account safety clear。

## 异常与边界场景

### 1. write_prepare 缺少 safety state

Given a downstream gate requests `write_prepare`
When no current `account_safety_state` exists for the exact scope
Then account safety gate returns `decision=deny`
And blocking reasons include `account_safety_state_missing`.

### 2. historical #835 baseline 被复用

Given #835 is closed
When a downstream gate uses #835 closed state as current account safety clear
Then account safety gate returns `decision=deny` or `defer`
And blocking reasons include `historical_or_stale_evidence`.

### 3. operator unlock exists but safety is unknown

Given an operator unlock record exists for the exact scope
When account safety state is `unknown`
Then `live_write_commit` remains blocked
And blocking reasons include `account_safety_unknown`.

### 4. redaction invalid

Given safety evidence includes raw account identifier, raw profile path, cookie, token or secret-bearing locator
When the account safety gate consumes the evidence
Then state is `redaction_invalid`
And decision is `deny`.

### 5. requires operator attention

Given page or runtime evidence indicates captcha, login challenge, security redirect or account verification
When write preparation is requested
Then gate status is `requires_operator_attention` or `blocked`
And no live action may be used as a probe in this FR scope.

### 6. stale safety clear

Given account safety was clear for a previous run, head, profile or target
When the requested scope changes
Then the old clear cannot be reused
And account safety gate returns `account_safety_scope_mismatch`, `account_safety_head_mismatch`, `account_safety_run_mismatch` or `account_safety_stale`.

## 验收标准

1. `spec.md` freezes account safety ownership, scope binding, states, signal classes, evidence refs, freshness and fail-closed behavior.
2. `contracts/account-safety-gate.md` provides machine-consumable types, enums, result shape and minimum examples.
3. `data-model.md` explains logical entities without adding SQLite schema, migrations or runtime persistence.
4. `plan.md` includes required seven sections and keeps implementation/live actions out of scope.
5. `TODO.md` records review and downstream handoff checks without becoming project truth source.
6. `risks.md` covers historical #835 reuse, implicit safety clear, redaction failure, operator unlock confusion, stale evidence and live action probing.
7. The PR only changes the FR-0066 suite and the #1176 sync-map entry, uses `Fixes #1176` only because #1176 close semantics are `fr-complete`, and does not claim live evidence.

## GWT 验收场景

### 场景 1：write_prepare requires account safety

Given requested capability level is `write_prepare`
When account safety state is missing, unknown, stale or blocked
Then gate decision is not `allow`
And later write preparation remains blocked.

### 场景 2：live_write_commit requires fresh clear

Given requested capability level is `live_write_commit`
And operator unlock and provider requirement refs exist
When account safety state is not `clear` for the exact latest-head scope
Then `live_write_commit` remains unavailable
And account safety blocker is preserved.

### 场景 3：redaction success is not safety clear

Given safety evidence refs satisfy redaction policy
When no current safety signal scan or risk disposition exists
Then account safety state is `unknown`
And redaction compliance alone does not allow `write_prepare`.

### 场景 4：spec PR claims no live evidence

Given FR-0066 is a formal spec PR
When reviewer checks PR metadata and suite text
Then live evidence is marked not applicable
And no browser/account/runtime/live/write action is claimed.
