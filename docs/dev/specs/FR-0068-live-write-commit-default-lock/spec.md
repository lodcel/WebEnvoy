# FR-0068 Live-Write Commit Default Lock

Canonical Issue: #1180

## 背景

`#1180 live_write_commit Default Lock` 属于 `#1117 Live Write Gate Alignment`。上游已经合入并冻结：

- `FR-0062 Live-Write Capability Taxonomy` / #1174：`live_write_commit` 是最高风险 capability，默认 locked，且缺少任一 required gate 时 fail closed。
- `FR-0065 Profile Manifest Provider Allowlist` / #1175：profile manifest allowlist 只清除 profile/provider allowlist lane，不解锁 commit。
- `FR-0066 Account Safety Gate` / #1176：`write_prepare` / `live_write_commit` 必须消费 current exact-scope account safety clear。
- `FR-0067 Extension / Native Bridge Gate` / #1177：`write_prepare` / `live_write_commit` 必须消费 current exact-scope extension/native bridge ready。
- `FR-0064 Operator Unlock` / #1178：operator unlock 只清除 operator lane，不能替代 default lock release、account safety、provider requirement、runtime target binding、anti-detection 或 live evidence。
- #1179 `xhs.creator_publish.admit Provider Requirements`：`xhs.creator_publish.admit` 只支持 `write_admit` / admission prerequisite，且已声明 `default_live_write_commit_lock=locked`。

当前缺口是：即使以上 lanes 各自存在，仍需要一个独立 default lock owner 明确规定 `live_write_commit` 默认不可用。只有当所有 risk gate、operator unlock、provider/runtime/admission/account-safety 条件均被 current exact-scope evidence 证明，且下游明确重消费这些 evidence 时，default lock 才能被考虑解除。本 FR 只冻结 formal contract，不实现 runtime、browser、account、live 或 write 行为。

`#1180` issue meta 声明 `Close Semantics: fr-complete`。因此本 suite 合入后只完成 #1180 的 FR/spec freeze；runtime parser、release gate matrix、actual live evidence、publish implementation、controlled merge 和 issue closeout 仍由后续 owner 承接。

## 目标

1. 冻结 `live_write_commit_default_lock` 的 owner、scope、state、release disposition 与 fail-closed rules。
2. 明确 `live_write_commit` 默认锁定；任何 missing、stale、scope mismatch、redaction invalid、stub/fake、control-plane-only 或 historical evidence 均不得解除锁。
3. 要求 default lock release 必须消费 current exact-scope inputs：provider requirement、profile allowlist、extension/native bridge readiness、account safety、runtime target binding、anti-detection gate、operator unlock、live evidence gate 和 freshness/head binding。
4. 明确 #1179 `xhs.creator_publish.admit` 的 `write_admit` provider requirement 不是 commit unlock，不能从 admission pass 推断 `live_write_commit` 可用。
5. 冻结 downstream re-consumption rule：任何下游 commit gate 必须重新消费当前 exact-scope evidence refs，不能沿用本 spec、issue closed state、PR merge、hosted checks 或历史 artifact。

## 非目标

- 不实现 runtime code、CLI、driver、adapter、provider selection、parser、tests、fixtures、scripts、workflows、guardian、formal review、controlled merge 或 issue closeout。
- 不执行 browser、extension、Native Messaging、profile、account、live、external-visible、upload、submit、publish、file picker、DataTransfer、editor text write、cleanup 或 rollback 操作。
- 不启用默认 `live_write_commit`，不执行 default lock release，不声明 operator unlock accepted、provider requirement pass、profile allowlist accepted、account safety clear、extension/native bridge ready、runtime target binding pass、anti-detection pass 或 live evidence accepted。
- 不实现 XHS publish，不定义 Syvert normalized result，不引入 CloakBrowser-as-core、browser patching、provider private patch schema 或跨仓 shared contract。
- 不修改 `FR-0031`、`FR-0032`、`FR-0033`、`FR-0040`、`FR-0041`、`FR-0062`、`FR-0064`、`FR-0065`、`FR-0066` 或 `FR-0067` 的字段 shape；只消费其已冻结边界。
- 不修复、不重开、不关闭 #835；#835 的 closed baseline 只作为历史背景，不是 current default lock release evidence。
- 不扩大到 #1166-#1173 read driver work、#835 recovery、M12 或 M13。

## 功能需求

### 1. Default lock ownership

系统必须把 `live_write_commit_default_lock` 的 formal owner 固定为 `#1180` / `FR-0068`。

约束：

- Default lock 只回答“某个 exact scope 的 `live_write_commit` 是否仍被默认锁阻断，或是否具备可交给下游 commit gate 重消费的 release disposition”。
- Default lock 不是 publish implementation、runtime execution、operator unlock record、provider requirement pass、account safety result、extension/native bridge readiness、runtime target binding、anti-detection pass、live evidence accepted、cleanup success 或 release gate closeout。
- Downstream gate 必须消费本 FR 的 `default_lock_result` 或等价 release disposition；不得用 issue state、PR merge、review approval、hosted checks pass、guardian approval、operator text 或 #835 closed state 替代。

### 2. Lock scope

每个 default lock evaluation 必须绑定 exact scope。

必需 scope 字段：

- `capability_level`: 必须为 `live_write_commit`。
- `workflow_ref`: 例如 `xhs.creator_publish.commit` 或下游冻结的等价 commit workflow。
- `provider_requirement_ref`: #1179 或等价 accepted downstream provider requirement disposition。
- `profile_manifest_allowlist_ref`
- `extension_native_bridge_ref`
- `account_safety_ref`
- `runtime_target_binding_ref`
- `anti_detection_gate_ref`
- `operator_unlock_ref`
- `live_evidence_gate_ref`
- `target_domain`
- `target_page`
- `profile_ref`
- `browser_channel`
- `execution_surface`
- `head_sha`
- `run_id`
- `evaluated_at`

约束：

- Scope 必须与 downstream requested commit scope 完全匹配；任何 workflow、provider、profile、target、runtime, operator, evidence, head 或 run drift 都必须 fail closed。
- `execution_surface` 必须为 `real_browser`；但该字段只说明请求 scope，不能单独证明 live evidence。
- `run_id`、`head_sha` 与 `evaluated_at` 必须能共同绑定 current exact-scope evaluation；formal examples 可以写 `N/A`，真实 gate 输出不得写 `N/A`。

### 3. Lock states

Default lock state 必须至少支持：

| state | 语义 | 可否交给下游 commit gate |
|---|---|---|
| `locked` | 默认锁仍生效，或未请求 release。 | 否 |
| `release_not_requested` | 仅进行 classification / planning，未请求解除锁。 | 否 |
| `release_blocked` | 请求 release，但存在 required blocker。 | 否 |
| `release_deferred` | 需要下游 owner 或人工流程补齐 evidence，但当前不得执行 live/write 探测。 | 否 |
| `release_ready_for_downstream_gate` | 所有 required refs 在 default lock lane 内已 current、redacted、scope matched，可交给下游 gate 重消费。 | 仅作为必要条件之一 |
| `release_revoked` | 曾经的 release disposition 被撤销。 | 否 |
| `release_expired` | 曾经的 release disposition 已过期。 | 否 |
| `redaction_invalid` | required evidence locator 或 disposition 暴露敏感值或未满足 redaction policy。 | 否 |

约束：

- `live_write_commit` 默认状态必须为 `locked`。
- 只有 `state=release_ready_for_downstream_gate` 且 blockers 为空时，default lock lane 才可返回 `decision=allow`。
- `decision=allow` 只表示 default lock lane 不再阻断；它不执行 commit，也不替代任何下游 gate。
- Unknown state、missing state、unsupported state 或 ambiguous release disposition 必须 fail closed。

### 4. Required release preconditions

Default lock release 必须至少消费以下 current exact-scope preconditions：

- `provider_requirement_ref`: #1179 or equivalent accepted provider requirement disposition for the commit workflow.
- `profile_manifest_allowlist_ref`: FR-0065 accepted result for requested profile/provider/workflow/target.
- `extension_native_bridge_ref`: FR-0067 ready result for requested scope.
- `account_safety_ref`: FR-0066 clear result for requested scope.
- `runtime_target_binding_ref`: current target binding / runtime target readiness result from downstream owner.
- `anti_detection_gate_ref`: applicable anti-detection / account-risk gate result from downstream owner.
- `operator_unlock_ref`: FR-0064 accepted operator unlock for exact scope.
- `live_evidence_gate_ref`: latest-head fresh real-browser live evidence gate result from downstream owner.
- `freshness_ref`: evidence freshness record binding head/run/profile/target/workflow.
- `redaction_policy_ref`: FR-0041 / #1181-compatible redaction disposition.

约束：

- Missing, stale, partial, wrong-head, wrong-run, wrong-profile, wrong-target, wrong-provider, under-redacted or unowned precondition keeps `state=locked|release_blocked|release_deferred`.
- #1179 `xhs.creator_publish.admit` supports `write_admit`; it cannot by itself satisfy commit workflow provider requirements unless a downstream provider requirement owner explicitly upgrades and reconsumes the exact commit scope.
- Operator unlock can clear only the operator lane; default lock release still requires all other preconditions.
- Account safety clear, extension/native bridge ready, profile allowlist accepted or provider requirement accepted can only clear their respective lanes.

### 5. Non-proofs

以下内容不得解除 default lock：

- `#1180` issue closed state、FR-0068 spec text、PR merge、review approval、guardian approval 或 hosted checks pass。
- #835 closed state、FR-0032 historical baseline、old run、old artifact、same-head historical artifact 或 post-merge补证据。
- Runtime ping、runtime bootstrap ack、service worker wake signal、descriptor ref、doctor pass、extension locator 或 Native Messaging manifest ref。
- Stub/fake host evidence、本地 fake runtime、control-plane-only signal、dry-run/admission-only output 或 `xhs.creator_publish.admit` pass。
- Raw operator chat text、PR comment、issue label、branch name 或 unbound manual note.
- Redaction-invalid evidence、raw account/profile/secret/path values、private URL、cookie、token、media payload 或 page content.

### 6. Release result

Default lock evaluator 必须输出下游可消费 result。

Allowed decision:

- `allow`
- `deny`
- `defer`

Allowed gate status:

- `locked`
- `release_not_requested`
- `release_blocked`
- `release_deferred`
- `release_ready_for_downstream_gate`
- `release_revoked`
- `release_expired`
- `redaction_invalid`

约束：

- `decision=allow` 只允许在 `gate_status=release_ready_for_downstream_gate`、`blocking_reasons=[]`、required refs current 且 exact scope matched 时出现。
- `decision=allow` 不表示 `live_write_commit` 已执行、可自动执行或已经 merge-ready；downstream commit gate 必须重新消费 evidence refs。
- `decision=defer` 只能表示等待 downstream owner / operator / release gate 补齐当前缺口，不能驱动 live/write 探测。
- 任何 blocker 存在时，decision 必须为 `deny` 或 `defer`。

### 7. Blocking reasons

本 FR 至少冻结以下 blocking reasons：

- `default_commit_lock_active`
- `default_lock_release_not_requested`
- `default_lock_release_missing`
- `default_lock_release_expired`
- `default_lock_release_revoked`
- `default_lock_scope_mismatch`
- `default_lock_head_mismatch`
- `default_lock_run_mismatch`
- `provider_requirement_missing`
- `provider_requirement_scope_mismatch`
- `profile_manifest_missing`
- `profile_manifest_scope_mismatch`
- `extension_native_bridge_missing`
- `extension_native_bridge_not_ready`
- `account_safety_missing`
- `account_safety_not_clear`
- `runtime_target_binding_missing`
- `anti_detection_gate_missing`
- `operator_unlock_missing`
- `operator_unlock_not_accepted`
- `live_evidence_missing`
- `live_evidence_not_current`
- `live_evidence_scope_mismatch`
- `stub_or_fake_host_evidence`
- `control_plane_only_signal`
- `historical_or_stale_evidence`
- `redaction_invalid`
- `downstream_reconsumption_required`

约束：

- `live_write_commit` 请求命中任何 required blocking reason 时，decision 必须为 `deny` 或 `defer`。
- `default_commit_lock_active` 是初始 blocker；它只有在 current exact-scope release disposition ready 且下游重消费所有 refs 后，才可从 final commit gate 中移除。
- Unknown blocking reason 或 unknown precondition state 必须 fail closed。

### 8. Downstream re-consumption

任何下游 commit gate 必须重新消费 default lock result 和所有 referenced evidence refs。

约束：

- Downstream gate 必须验证 `head_sha`、`run_id`、`workflow_ref`、`target_domain`、`target_page`、`profile_ref`、`provider_requirement_ref` 和 `operator_unlock_ref` 仍然与请求完全一致。
- Downstream gate 必须重新判断 freshness、redaction、scope matching、revocation/expiry 和 non-proof exclusions。
- Default lock result 可以是必要输入，但不能替代 final commit gate、release gate matrix、formal review、guardian、hosted checks 或 controlled merge。
- 若下游未明确声明已重消费 current exact-scope evidence，`live_write_commit` 必须继续 locked / denied。

## 异常与边界场景

### 1. Admission pass 被误认为 commit unlock

Given #1179 reports `xhs.creator_publish.admit` provider requirements satisfy `write_admit`
When a downstream request asks for `live_write_commit`
Then default lock remains active
And the request must still provide commit-scope provider requirement, operator unlock, account safety, bridge readiness, runtime target binding, anti-detection and live evidence refs.

### 2. Operator unlock 已接受但 default lock 未解除

Given an operator unlock record is accepted for exact scope
When no default lock release disposition exists
Then default lock result is `locked`
And blocking reasons include `default_commit_lock_active`.

### 3. Evidence scope drift

Given all required refs existed for profile A and target page A
When the commit request targets profile B or target page B
Then default lock result is `release_blocked`
And blocking reasons include `default_lock_scope_mismatch`.

### 4. Historical evidence 被复用

Given #835 is closed or an old live artifact exists
When a commit request uses it as current release evidence
Then default lock result is `release_blocked`
And blocking reasons include `historical_or_stale_evidence`.

### 5. Stub or control-plane-only signal

Given runtime ping, bootstrap ack or stub/fake host handshake succeeds
When no real-browser live evidence gate result exists
Then default lock remains active
And blocking reasons include `control_plane_only_signal` or `stub_or_fake_host_evidence`.

### 6. Downstream does not reconsume evidence

Given default lock result is `release_ready_for_downstream_gate`
When downstream commit gate does not explicitly reconsume current exact-scope evidence refs
Then final decision must remain `deny` or `defer`
And blocking reasons include `downstream_reconsumption_required`.

## GWT 验收场景

### 1. 默认锁定

Given a `live_write_commit` request has no default lock release record
When the default lock evaluator consumes the request
Then `gate_status` is `locked`
And `decision` is `deny`
And `blocking_reasons` include `default_commit_lock_active`.

### 2. Admission 不能升级为 commit

Given #1179 `xhs.creator_publish.admit` provider requirements pass for `write_admit`
When a downstream owner requests `live_write_commit`
Then default lock still requires commit-scope provider requirement, operator unlock, account safety, bridge readiness, runtime target binding, anti-detection and live evidence refs
And `xhs.creator_publish.admit` pass alone cannot produce `release_ready_for_downstream_gate`.

### 3. 所有 refs current 后仍需下游重消费

Given all required default lock refs are current, exact-scope and redacted
When downstream re-consumption is not declared
Then final commit remains denied or deferred
And `blocking_reasons` include `downstream_reconsumption_required`.

### 4. Scope drift 后 fail closed

Given a default lock release disposition exists for head A, run A, profile A and target A
When a commit request uses head B, run B, profile B or target B
Then default lock evaluation returns `release_blocked`
And blocking reasons identify the matching head, run or scope mismatch.

### 5. Non-proof evidence 被拒绝

Given evidence input is runtime ping, bootstrap ack, hosted checks pass, #835 closed state, old artifact, stub/fake host or control-plane-only signal
When it is used to request default lock release
Then the evaluator rejects it as non-proof
And default lock remains active.

## 验收标准

1. `spec.md` freezes default locked semantics, release preconditions, non-proofs, blocking reasons, downstream re-consumption and fail-closed behavior.
2. `contracts/live-write-commit-default-lock.md` provides machine-consumable scope, state, evidence refs, result and blocking reason shapes.
3. `data-model.md` defines logical entities only and does not introduce runtime storage or migrations.
4. `research.md` records the consumed facts from #1174-#1179 and confirms #1179 remains `write_admit` / provider requirement input, not commit unlock.
5. `risks.md` covers accidental unlock, stale evidence, redaction leakage, admission/commit confusion, operator unlock overreach and #835 historical evidence misuse.
6. `TODO.md` separates review checklist from future implementation / release-gate tasks.
7. `.github/spec-issue-sync-map.yml` maps `docs/dev/specs/FR-0068-live-write-commit-default-lock/spec.md` to canonical issue #1180.
8. The PR changes only the FR-0068 suite and sync-map mapping, uses parser-friendly metadata, and does not execute or enable live write behavior.
