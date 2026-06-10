# FR-0067 Extension / Native Bridge Gate

Canonical Issue: #1177

## 背景

`#1177 Extension / Native Bridge Gate` 属于 `#1117 Live Write Gate Alignment`。已合入的 `FR-0038 Provider Health / Doctor Contract` 冻结了 provider doctor report、required checks、capability readiness 与 fail-closed 语义；`FR-0045`、`FR-0046`、`FR-0047` 已分别冻结 official Chrome persistent extension identity、Native Messaging health 与 service worker freshness 的 health checks；`FR-0062` 已冻结 `read_only`、`write_admit`、`write_prepare`、`live_write_commit` 四层能力；`FR-0066` 已冻结 account safety 是 `write_prepare` / `live_write_commit` 的必要但不充分条件。

当前缺口是：live-write admission 在继续进入 provider requirement、target binding、write preparation 或 commit unlock 之前，必须有一个独立 formal owner 明确消费 extension smoke 与 native bridge readiness。没有本 gate 时，下游容易把 descriptor refs、doctor pass、extension identity check、Native Messaging manifest ref、service worker wake signal、runtime ping、bootstrap ack、stub/fake host 或历史 artifact 误写成可以进入 live-write admission。

本 FR 只冻结 extension / native bridge gate contract。它不实现 runtime code，不执行 Chrome / extension / Native Messaging / browser / account / live / write 操作，不启用 `live_write_commit`，不实现 XHS publish，不修复、不重跑、不重开 #835，也不扩大到 #1175/#1176/#1179/#1180。

## 目标

1. 冻结 `extension_native_bridge_gate` 的 formal owner、input、result、state enum 与 fail-closed 语义。
2. 要求任何 `write_admit` 进入 `write_prepare` 前，必须具备 current-scope extension smoke 与 native bridge readiness result。
3. 明确本 gate 如何消费 `FR-0038`、`FR-0045`、`FR-0046`、`FR-0047` 的 health / doctor facts，而不把 doctor layer 误写成 runtime/live success。
4. 冻结 extension smoke 与 native bridge readiness 的 freshness、head/run/profile/provider scope matching、redaction 与 stub/fake/historical evidence 阻断规则。
5. 为 #1179 provider requirements、#1180 default lock、#1211 live-write gate matrix 和后续 runtime/live owner 提供可消费的 bridge gate result 与 blocking reasons。

## 非目标

- 不实现 runtime code、CLI、driver、adapter、provider selection、tests、fixtures、scripts、workflows、guardian、formal review、controlled merge 或 issue closeout。
- 不执行 browser、extension、Native Messaging、profile、account、live、external-visible、upload、submit、publish、file picker、DataTransfer、editor text write、cleanup 或 rollback 操作。
- 不启用 `live_write_commit`，不解除 default commit lock，不声明 operator unlock accepted、provider requirement pass、account safety clear、target binding pass、anti-detection gate pass 或 live evidence accepted。
- 不实现 XHS publish，不定义 Syvert normalized result，不引入 CloakBrowser-as-core、browser patching、provider private patch schema 或跨仓 shared contract。
- 不修改 `FR-0038`、`FR-0045`、`FR-0046`、`FR-0047`、`FR-0062`、`FR-0066` 或 provider/evidence contracts 的字段 shape；只消费其已冻结边界。
- 不修复、不重开、不关闭 #835；#835 的 closed baseline 只作为历史背景，不是当前 extension/native bridge readiness evidence。

## 功能需求

### 1. Gate ownership

系统必须把 extension / native bridge gate 的正式 owner 固定为 `#1177` / `FR-0067`。

约束：

- 本 gate 只回答“当前 exact live-write admission scope 是否具备 extension smoke 与 native bridge readiness prerequisites”。
- 本 gate 不等于 provider requirement pass、account safety clear、operator unlock、default lock release、runtime target binding、anti-detection gate、live evidence accepted、publish success 或 cleanup success。
- Downstream gate 必须消费本 FR 的 `extension_native_bridge_gate_result` 或等价 accepted result，而不是用 issue state、PR merge、doctor pass、runtime ping、bootstrap ack、service worker wake signal 或 hosted checks pass 替代。

### 2. Scope binding

每个 gate evaluation 必须绑定 exact scope。

必需 scope 字段：

- `capability_level`: `write_admit`、`write_prepare` 或 `live_write_commit`
- `workflow_ref`
- `target_domain`
- `target_page`
- `provider_id`
- `provider_contract_version`
- `profile_ref`
- `browser_channel`
- `execution_surface`
- `extension_identity_ref`
- `native_host_identity_ref`
- `provider_doctor_report_ref`
- `extension_smoke_ref`
- `native_bridge_readiness_ref`
- `head_sha`
- `run_id` 或 `evaluation_context_ref`

约束：

- Scope 必须与 downstream requested capability scope 完全匹配；任何 workflow、target、provider、profile、extension identity、native host identity、head 或 run/evaluation context drift 都必须 fail closed。
- `execution_surface=real_browser` 是进入 runtime/live-write admission 的必要字段，但不能单独证明 readiness。
- `write_admit` 可请求本 gate；缺少 `ready` result 时不得升级到 `write_prepare`。
- `live_write_commit` 仍需下游 owner 提供 operator unlock、default lock release、provider requirement pass、account safety clear、target binding、anti-detection gate 和 live evidence；本 gate 只贡献 extension/native bridge lane。

### 3. Gate states

Gate state 必须至少支持：

| state | 语义 | 可否支持 `write_prepare` / `live_write_commit` |
|---|---|---|
| `ready` | Extension smoke 与 native bridge readiness 当前、scope matched、redacted 且无 blockers。 | 可作为必要条件之一 |
| `unknown` | 证据缺失、不可解析或不足以判断。 | 否 |
| `blocked` | 已发现 bridge / extension / native host 阻断信号。 | 否 |
| `stale` | 曾经 ready 的证据已过期、head/run/profile/provider/target drift 或 freshness 不满足。 | 否 |
| `redaction_invalid` | required evidence 含 raw profile path、manifest body、secret、token、cookie、private payload 或未脱敏 locator。 | 否 |
| `requires_recovery` | 同 run 可能通过 bounded recovery 恢复，但当前仍未产生 fresh ready evidence。 | 否 |

约束：

- 只有 `state=ready` 且 blockers 为空时，本 gate 才能返回 `decision=allow`。
- Unknown state、unknown enum、missing state、unsupported state 必须 fail closed。
- `requires_recovery` 不得被当作 pass；只有 recovery 后重新采集的 fresh evidence 可进入 `ready`。
- `ready` 只表示 extension/native bridge lane 不阻断；它不替代其他 live-write gates。

### 4. Extension smoke requirements

Extension smoke 至少必须消费以下事实：

- Selected provider 是 expected official Chrome persistent provider 或后续明确 accepted provider。
- Observed browser channel 与 expected `Google Chrome stable` 或 accepted channel 匹配。
- `FR-0045` persistent extension identity/source binding health check 当前 pass-compatible。
- `FR-0047` service worker freshness / code identity health check 当前 pass-compatible。
- Extension runtime 可以完成最小 non-business smoke，例如 extension context reachable、expected extension id reachable、service worker current code identity 可观测、最小 message preflight 不含业务写动作。
- Evidence refs current、redacted、scope matched，且来自 official/accepted execution surface。

约束：

- Extension smoke 不得包含页面写入、上传、发布、提交、账号状态修改或 cleanup。
- Extension smoke 不能由 descriptor refs、extension locator、runtime ping、bootstrap ack、historical artifact、same-head old artifact、service worker wake signal 或 stub/fake host 单独满足。
- `FR-0045` 与 `FR-0047` 任一 required health input missing、unknown、stale、redaction invalid 或 non-pass 时，本 gate 必须 non-ready。
- Extension smoke pass 不能满足 Native Messaging bridge readiness；二者都必须满足。

### 5. Native bridge readiness requirements

Native bridge readiness 至少必须消费以下事实：

- `FR-0046` Native Messaging health required checks 当前 pass-compatible。
- Native host identity、manifest locator、allowed origins、host registration、socket availability 与 bridge handshake 均 current、scope matched、redacted。
- Bridge handshake 来源不是 stub/fake host、non-official Chrome surface、wrong extension origin、wrong provider id、historical artifact 或 unowned stale process。
- Same-run recoverable states 已完成 bounded recovery，并用 recovery 后 fresh evidence 替换 stale/disconnected evidence。

约束：

- Native bridge readiness 只证明 extension-to-native-host bridge preflight ready；不得被表述为 runtime target binding、page command success、account safety、anti-detection pass 或 live evidence accepted。
- `FR-0046` 的 `degraded_recoverable`、`disconnected`、`blocked` 或 `unknown` 状态不得满足 readiness。
- Manifest body、allowed origin raw source、socket locator、profile path、bootstrap secret、extension private payload、token、cookie 或 native host private payload 不得出现在 public evidence、PR body 或 stdout summary。
- Stub/fake host evidence 必须 fail closed，即使 handshake appears to ack。

### 6. Required evidence refs

Gate result 必须引用 evidence refs，而不是内联敏感值。

必需 evidence refs：

- `provider_doctor_report_ref`
- `extension_identity_health_ref`
- `service_worker_freshness_ref`
- `native_messaging_health_ref`
- `extension_smoke_ref`
- `native_bridge_handshake_ref`
- `profile_ref`
- `redaction_policy_ref`
- `freshness_ref`
- `risk_disposition_ref`

`live_write_commit` 额外需要 downstream refs，但本 gate 不生成：

- `operator_unlock_ref`
- `default_commit_lock_ref`
- `provider_requirement_ref`
- `account_safety_ref`
- `runtime_target_binding_ref`
- `live_evidence_gate_ref`

约束：

- Evidence refs 必须是 locator，不得内联 cookie、token、account identifier、profile path、browser path、raw manifest、socket path、extension source、private payload、private URL、page content、media content、secret 或 live artifact payload。
- Required evidence missing、unavailable、partial、stale、scope mismatch、redaction invalid 或只来自 control-plane signal 时，state 不得为 `ready`。
- PR metadata 中 `live_evidence_record` 对本 formal spec PR 必须为 `N/A`。

### 7. Freshness and current-head binding

Extension/native bridge readiness 必须绑定 freshness。

最低 freshness 要求：

- `write_admit`: 当前 PR head 或当前 bounded evaluation context 下的 fresh readiness result。
- `write_prepare`: 当前 PR head、current provider/profile scope、current run/evaluation context 的 fresh readiness result。
- `live_write_commit`: 当前 latest head、current run、exact scope 的 fresh readiness result plus downstream gates；本 FR 不提供 commit-level pass。

约束：

- #835 closed baseline、旧 run、旧 artifact、same-head historical artifact、runtime ping、runtime bootstrap ack、stub/fake host 或 control-plane-only signal 均不能满足 current readiness。
- `checked_at`、`expires_at` 或 equivalent freshness ref 必须存在于 real evaluation；过期或缺失时 state 必须为 `stale` 或 `unknown`。
- 如果 target/provider/profile/extension/native host/head/run 发生 drift，必须重新评估 readiness，不能沿用旧 ready。

### 8. Gate result

Gate 必须输出可消费 result。

Allowed decision:

- `allow`
- `deny`
- `defer`

Allowed gate status:

- `not_applicable`
- `ready`
- `unknown`
- `blocked`
- `stale`
- `redaction_invalid`
- `requires_recovery`

约束：

- `decision=allow` 只允许在 `gate_status=ready`、`blocking_reasons=[]`、required evidence fresh 且 scope matched 时出现。
- `decision=allow` 只移除 extension/native bridge lane blocker；不得解除 default commit lock、operator unlock、provider requirement、account safety、target binding、anti-detection gate 或 live evidence gate。
- `decision=defer` 只允许在需要 downstream owner 或 bounded recovery owner 继续处理，但当前不能执行 browser/account/live/write action 的场景。

### 9. Blocking reasons

本 FR 至少冻结以下 blocking reasons：

- `extension_native_bridge_state_missing`
- `extension_smoke_missing`
- `extension_smoke_unknown`
- `extension_smoke_stale`
- `extension_identity_health_missing`
- `extension_identity_not_ready`
- `service_worker_freshness_missing`
- `service_worker_not_fresh`
- `native_messaging_health_missing`
- `native_bridge_handshake_missing`
- `native_bridge_not_ready`
- `native_bridge_recovery_required`
- `native_bridge_recovery_failed`
- `provider_doctor_report_missing`
- `provider_doctor_report_not_checked`
- `scope_mismatch`
- `head_mismatch`
- `run_mismatch`
- `profile_mismatch`
- `provider_mismatch`
- `extension_identity_mismatch`
- `native_host_identity_mismatch`
- `evidence_missing`
- `evidence_stale`
- `evidence_redaction_invalid`
- `stub_or_fake_host_evidence`
- `control_plane_only_signal`
- `historical_or_stale_evidence`
- `downstream_owner_required`

约束：

- `write_prepare` 或 `live_write_commit` 请求命中任何 required blocking reason 时，decision 必须为 `deny` 或 `defer`。
- Unknown blocking reason 或 unknown gate state 必须 fail closed。
- `stub_or_fake_host_evidence`、`control_plane_only_signal`、`historical_or_stale_evidence`、`evidence_redaction_invalid` 必须阻断 `live_write_commit`。

### 10. Downstream handoff

本 FR 冻结以下 handoff：

| downstream item | 消费输入 | 本 FR 不提供 |
|---|---|---|
| #1179 Provider Requirements | Extension/native bridge gate result for `write_admit` / `write_prepare` provider requirement disposition | provider requirement pass |
| #1180 Default Lock | Extension/native bridge readiness is required before any exact-scope commit lock release can be considered | default lock release |
| #1211 Live Write Gate Matrix | Bridge gate status、blocking reasons、freshness and redaction validity | release gate pass |
| #1178 Operator Unlock | May reference bridge readiness as required evidence locator | operator unlock accepted |
| FR-0032 / #835 | Controlled success ladder remains historical context | current bridge readiness or #835 recovery |

约束：

- #1177 合入后只能说明 extension/native bridge gate contract frozen；不能关闭 #1175/#1176/#1179/#1180/#1211/#835。
- Downstream implementation 必须重新提供 current scoped readiness refs；不能把本 spec 文本当作 bridge ready。
- #835 的 closed 状态只证明 historical controlled live-write baseline 已存在，不证明当前 extension/native bridge readiness。

## 异常与边界场景

### 1. write_prepare 缺少 bridge readiness

Given a downstream gate requests `write_prepare`
When no current `extension_native_bridge_gate_result` exists for the exact scope
Then the gate returns `decision=deny`
And blocking reasons include `extension_native_bridge_state_missing`.

### 2. Extension smoke pass 但 Native Messaging 不 ready

Given extension smoke evidence is current and redacted
When `FR-0046` native messaging health is missing, stale, recoverable-but-not-recovered or non-pass
Then the bridge gate remains non-ready
And blocking reasons include `native_bridge_not_ready` or `native_bridge_recovery_required`.

### 3. Native bridge ack 来自 stub/fake host

Given a bridge handshake appears successful
When the evidence source is a stub/fake host or non-official execution surface
Then the gate returns `decision=deny`
And blocking reasons include `stub_or_fake_host_evidence`.

### 4. historical #835 baseline 被复用

Given #835 is closed
When a downstream gate uses #835 closed state as current extension/native bridge readiness
Then the gate returns `decision=deny` or `defer`
And blocking reasons include `historical_or_stale_evidence`.

### 5. Service worker wake signal 被误写成 readiness

Given the extension service worker can be woken
When current code identity freshness or extension identity health is missing
Then extension smoke cannot be `ready`
And service worker wake alone cannot satisfy extension/native bridge gate.

### 6. Redaction invalid

Given bridge evidence includes raw profile path, manifest body, socket path, cookie, token or bootstrap secret
When the gate consumes evidence refs
Then state is `redaction_invalid`
And decision is `deny`.

## 验收标准

1. `spec.md` freezes extension/native bridge gate ownership, exact scope, states, required evidence refs, freshness and fail-closed blocking reasons.
2. `contracts/extension-native-bridge-gate.md` provides machine-consumable scope, state record, input/result and blocking reason shape.
3. `data-model.md` explains logical gate entities without introducing runtime persistence or SQLite schema.
4. `plan.md` includes required seven sections and keeps implementation/live actions out of scope.
5. `TODO.md` records review and downstream handoff checks without becoming project truth source.
6. `risks.md` covers doctor-pass confusion, bridge-smoke confusion, stale/historical evidence, stub/fake host evidence, redaction leaks and live-write gate bypass.
7. The PR only changes the FR-0067 suite and the #1177 sync-map entry, uses `Fixes #1177` because #1177 close semantics are `fr-complete`, and does not close #1175/#1176/#1179/#1180/#1211/#835.

## GWT 验收场景

### 场景 1：extension/native bridge readiness is required before write preparation

Given `write_admit` is requested for a live-write workflow
When the workflow tries to proceed to `write_prepare`
Then a current exact-scope `extension_native_bridge_gate_result` with `state=ready` is required
And missing, stale or non-ready bridge result must deny or defer.

### 场景 2：doctor checked 不等于 bridge ready

Given provider doctor report reaches `doctor_checked`
When extension smoke or Native Messaging bridge readiness is missing
Then FR-0067 gate is not ready
And downstream admission cannot treat doctor pass as bridge readiness.

### 场景 3：extension smoke and native bridge must both pass

Given extension identity and service worker freshness are current
And native bridge handshake is missing or stale
When the bridge gate evaluates the scope
Then state is not `ready`
And blocking reasons include native bridge blocker.

### 场景 4：no live evidence is claimed by this PR

Given FR-0067 is a formal spec PR
When reviewer checks PR metadata and suite text
Then live evidence is marked not applicable
And no browser/account/runtime/live/write action is claimed.

### 场景 5：stub/fake and historical evidence fail closed

Given bridge evidence comes from stub/fake host or historical artifact
When the gate evaluates readiness
Then decision is `deny`
And current extension/native bridge readiness remains unsatisfied.
