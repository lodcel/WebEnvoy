# FR-0070 WebEnvoy-Owned Risk Evidence Boundary

Canonical Issue: #1183

## 背景

`#1183 WebEnvoy-Owned Risk Evidence Boundary` 属于 `#1118 Runtime Risk / Behavior Baseline`。`#1118` 的阶段目标是把旧的 Layer 1-4 反检测规划拆成两条清晰责任线：

- provider-owned stealth capabilities：由外部浏览器 provider 或 provider adapter 承担浏览器补丁、指纹伪装、stealth 参数、private patch 与底层执行面能力。
- WebEnvoy-owned risk/evidence gates：由 WebEnvoy 承担风险证据、门禁输入、closeout/audit 与 read/write gate 消费前置。

上游 `FR-0069 Provider-Owned Stealth Boundary` 已冻结 provider-owned stealth 与 WebEnvoy non-ownership：provider declaration、doctor pass、fingerprint seed ref、private patch ref、runtime ping 或 bootstrap ack 都不是 WebEnvoy-owned risk pass，也不能直接推导 read/write gate allow。

当前缺口是：后续 `#1188 Risk Hint Consumer Gate` 需要一个 WebEnvoy-owned 边界，先回答“哪些风险证据、scope/freshness 绑定、fail-closed blocker、closeout/audit 责任由 WebEnvoy 拥有”。否则 #1188 容易直接消费 provider stealth presence、历史 artifact 或 control-plane-only signal 来放行 read/write gates。

本 FR 只冻结 WebEnvoy-owned risk evidence boundary 的 formal contract。它不实现 risk hint consumer gate、不修改 read/write gate、不执行 runtime/browser/account/live/write action，也不关闭 #1188。

本 suite 是 #1183 的 formal boundary/spec carrier。当前 PR 必须使用 `Refs #1183`，等待 scheduler-owned spec review / gate；不得执行 issue closeout、guardian、formal review、controlled merge 或真实 browser/account/live/write action。

## 目标

1. 冻结 `webenvoy_owned_risk_evidence_boundary` 的 owner、scope、accepted evidence classes 与 non-proof signals。
2. 冻结 WebEnvoy-owned risk evidence 对 provider declaration、account safety、runtime target binding、live evidence、behavior baseline 与 closeout evidence 的消费边界。
3. 冻结 freshness / scope / head / run / profile / page / provider binding 的最低要求。
4. 冻结 fail-closed blockers、unclassified evidence 处理、redaction invalid 处理与 closeout/audit responsibility。
5. 为 #1188 保留明确 handoff：#1188 消费本 FR 定义的 risk evidence / risk hint input，但具体 read/write gate enforcement matrix、command output behavior 与 gate decision implementation 属于 #1188。

## 非目标

- 不实现 runtime code、parser、risk scorer、risk hint consumer gate、read/write gate、provider selection、account safety implementation、tests、fixtures、scripts、workflows、guardian、formal review、controlled merge 或 issue closeout。
- 不定义 #1188 的 read/write gate enforcement matrix、runtime block/allow decision、command output changes、closeout gate implementation 或 route evidence evaluator behavior。
- 不重定义 provider private patch schema、browser patch payload、stealth parameter raw values、driver internal state、fingerprint internals、worker/kernel-level patch details 或 provider proprietary diagnostics。
- 不修改 `FR-0033`、`FR-0040`、`FR-0041`、`FR-0066`、`FR-0067`、`FR-0068`、`FR-0069` 的 field shape。
- 不修改 #1187 account safety signal integration、FR-0066 / #1176 account safety gate semantics、#1184/#1185/#1186 behavior baseline work、#238、M10/M11 completed scope、XHS driver、JSON-RPC、Syvert normalized result 或 provider adapter implementation。
- 不执行 real browser、profile、extension、Native Messaging、account、live read/write、external-visible、network or page interaction actions。

## 功能需求

### 1. Boundary ownership

系统必须冻结一个稳定的 `webenvoy_owned_risk_evidence_boundary` formal boundary。

约束：

- ownership 属于 #1183 / FR-0070。
- 该 boundary 只回答 WebEnvoy-owned risk evidence、gate inputs、closeout/audit ownership 与 fail-closed semantics。
- 该 boundary 不得被解释为：
  - provider-owned stealth boundary
  - provider registry row
  - provider doctor result
  - account safety gate result
  - runtime target binding result
  - live evidence record
  - route evidence evaluator result
  - read/write gate decision
  - Syvert normalized result
- 后续 #1188 或 implementation 如需要消费 risk hints，只能消费本 FR 允许的 evidence class、scope/freshness binding、decision status、blocking reasons 与 handoff refs；不得绕过本 FR 直接从 provider private internals 推导 allow。

### 2. Accepted evidence classes

WebEnvoy-owned risk evidence 至少支持以下 accepted evidence classes：

- `provider_stealth_boundary_ref`
- `provider_limitation_ref`
- `provider_redacted_evidence_ref`
- `runtime_target_binding_ref`
- `account_safety_ref`
- `extension_native_bridge_ref`
- `default_lock_ref`
- `operator_unlock_ref`
- `live_evidence_gate_ref`
- `behavior_baseline_ref`
- `route_evidence_ref`
- `closeout_audit_ref`
- `manual_risk_disposition_ref`

约束：

- Evidence class accepted 只表示该类输入允许进入 WebEnvoy-owned risk evidence evaluation；不表示 `decision=allow`。
- 每个 required evidence ref 必须具备 owner、scope、freshness、redaction state、artifact identity 或等价 locator。
- Provider-owned inputs 只能以 `FR-0069` 允许的 declarations、limitations、redacted refs、freshness/scope 与 blocking reasons 形式进入；不得内联 private patch payload、raw fingerprint seed、stealth raw parameters 或 provider internals。
- `account_safety_ref` 必须消费 `FR-0066` / #1176 的 account safety gate result；若后续 #1187 产出 account safety signal integration result，本 FR 只把它作为 sibling input，不重定义账号安全状态机。
- `extension_native_bridge_ref`、`default_lock_ref`、`operator_unlock_ref` 和 `live_evidence_gate_ref` 只作为 sibling/downstream evidence lanes 的引用，不由本 FR 重写各自 contract。
- `manual_risk_disposition_ref` 由 human/operator/governance owner 产生，只能作为 exact-scope manual disposition locator、blocker explanation 或 accepted-supporting context；它不得单独清除 provider、account safety、runtime binding、lock、live evidence、closeout 或 #1188 blockers。
- Manual disposition 只有在 owner、scope、freshness、redaction、artifact identity 与当前 request 完全匹配，且所有 required machine evidence lanes 已 accepted 且 blockers 为空时，才可作为 `risk_state=accepted` 的 supporting input；manual-only、stale、unknown-owner、out-of-scope 或 redaction-invalid manual input 必须 fail-closed。

Evidence lane owner/effect/admission matrix:

| evidence class | authoritative owner / producer | allowed effect in FR-0070 | fail-closed stance |
|---|---|---|---|
| `provider_stealth_boundary_ref` | #1182 / FR-0069 provider-owned stealth boundary | Provider-owned context and required provider boundary locator. | Missing/unresolved provider boundary blocks if target capability depends on provider stealth. |
| `provider_limitation_ref` | #1182 / FR-0069 provider owner | Limitation/context/blocker input only. | Unknown or stale limitation cannot prove accepted risk. |
| `provider_redacted_evidence_ref` | #1182 / FR-0069 plus FR-0040/FR-0041 redaction policy | Redacted provider locator only. | Raw/private provider disclosure blocks. |
| `runtime_target_binding_ref` | Runtime target binding owner / later implementation owner | Exact browser/page/profile binding locator. | Missing or mismatch blocks runtime-dependent risk evidence. |
| `account_safety_ref` | FR-0066 / #1176 account safety gate; #1187 may provide sibling signal later | Necessary sibling input for write_prepare/live_write_commit. | Missing or non-clear account safety blocks affected capability. |
| `extension_native_bridge_ref` | FR-0067 extension/native bridge owner | Required bridge readiness locator where runtime path depends on it. | Presence-only bridge text is non-proof; missing accepted bridge blocks dependent path. |
| `default_lock_ref` | FR-0068 default lock owner | Lock/readiness locator only. | Lock presence or release request cannot replace accepted risk evidence. |
| `operator_unlock_ref` | Operator/governance unlock owner | Manual unlock locator only. | Unlock presence cannot clear risk, live, account or #1188 blockers. |
| `live_evidence_gate_ref` | Live evidence gate / closeout owner | Fresh live evidence locator when live/account-touching proof is required. | Historical/stub/control-plane-only live evidence blocks. |
| `behavior_baseline_ref` | #1184/#1185/#1186 behavior baseline owners | Behavior baseline locator only. | Missing required baseline blocks; this FR does not implement baseline behavior. |
| `route_evidence_ref` | Route evidence evaluator owner | Route evidence locator only. | Missing required route evidence blocks closeout/gate path. |
| `closeout_audit_ref` | Closeout/audit owner | Closeout evidence locator and blocker split context. | Cannot close #1183 or live closeout without current accepted evidence. |
| `manual_risk_disposition_ref` | Human/operator/governance manual disposition owner | Exact-scope manual context, blocker explanation, or accepted-supporting input. | Manual-only, unknown-owner, stale, out-of-scope or redaction-invalid manual input blocks or defers to `manual_disposition_owner`. |

### 3. Evidence classification states

WebEnvoy-owned risk evidence 必须至少支持：

| state | 语义 | 是否可作为 #1188 gate allow 的输入 |
|---|---|---|
| `accepted` | required evidence class 存在、fresh、scope matched、redacted 且未命中 blocker。 | 可作为必要输入之一 |
| `blocked` | 已发现明确风险阻断或 required lane deny。 | 否 |
| `unclassified` | evidence 存在但 WebEnvoy 无法判断风险归属或状态。 | 否 |
| `missing` | required evidence 缺失。 | 否 |
| `stale` | evidence 过期、head/run/profile/page/provider drift 或 freshness 不满足。 | 否 |
| `scope_mismatch` | evidence 与请求 scope 不一致。 | 否 |
| `redaction_invalid` | evidence 暴露 forbidden data 或 redaction policy gap。 | 否 |
| `provider_private_boundary_violation` | provider private internals 被展开或被要求作为 proof。 | 否 |

约束：

- 只有 `state=accepted` 且 blockers 为空时，该 evidence lane 才能进入 #1188 的 later consumer gate。
- Unknown state、unknown enum、missing state 或 unsupported state 必须 fail-closed。
- `accepted` 只表示该 risk evidence lane 不阻断；它不替代 #1188 read/write gate allow、account safety clear、runtime target binding pass、operator unlock accepted、default lock release 或 live evidence accepted。

### 4. Required binding fields

任何 real evaluation 或 closeout-bound risk evidence 必须绑定 exact scope。

最低 binding 字段：

- `workflow_ref`
- `capability_level`
- `target_domain`
- `target_page`
- `profile_ref`
- `browser_channel`
- `execution_surface`
- `provider_ref`
- `provider_stealth_boundary_ref`
- `account_safety_ref`，当 capability 涉及 `write_prepare` 或 `live_write_commit` 时必需
- `runtime_target_binding_ref`
- `head_sha`
- `run_id` 或 `evaluation_context_ref`
- `evidence_collected_at`
- `artifact_identity`

约束：

- 任何 workflow、capability、target、profile、browser、execution surface、provider、head、run、page 或 artifact drift 都必须使 evidence 进入 `stale`、`scope_mismatch` 或 `blocked`。
- `execution_surface=real_browser` 是 live / account-touching closeout 的必要字段，但不能单独证明 risk accepted。
- Formal spec sample 可以使用 synthetic refs；真实 evaluation 不得把 sample、历史 artifact 或同一 head 的旧 artifact 当作 fresh evidence。

### 5. Freshness semantics

WebEnvoy-owned risk evidence 必须冻结 freshness 规则。

最低要求：

- Formal spec review PR：只需要 static spec validation；不得声称 runtime risk accepted。
- Implementation / gate validation：必须绑定当前 PR head 或当前 bounded evaluation context。
- Live evidence / account-touching closeout：必须绑定 latest head、current run、exact profile、target page、provider、browser channel 与 artifact identity。

约束：

- 旧 head、旧 run、历史 artifact、same-head historical artifact、post-merge 补证据、runtime ping、runtime bootstrap ack、stub/fake host 或 control-plane-only signal 均不能满足 current risk evidence freshness。
- `evidence_collected_at`、`expires_at` 或 equivalent freshness ref 必须存在于 real evaluation；过期或缺失时必须 fail-closed。
- 如果 target/profile/provider/head/run/page 发生 drift，必须重新评估 risk evidence，不能沿用旧 accepted。

### 6. Non-proof signals

以下内容不得被解释为 WebEnvoy-owned risk evidence accepted、anti-detection pass、live evidence accepted、closeout complete 或 read/write gate allow：

- Provider 声明自己支持 stealth。
- Provider contract、descriptor、capability matrix、registry row、limitation row 或 provider-owned boundary 存在。
- Provider doctor pass、health pass、descriptor pass、runtime ping 或 bootstrap ack。
- Redacted fingerprint seed ref、seed hash ref、final args ref、private patch ref 或 provider private ref 存在。
- Account safety issue/PR merged、operator unlock exists、default lock exists 或 live evidence gate exists，但没有 exact-scope accepted result。
- Historical artifact、old run、same-head historical artifact、post-merge补证据或 non-current evidence。
- Stub/fake host、control-plane-only signal、dry-run-only output、spec sample 或 fixture-only output。
- Browser channel label、headless policy forbidden、managed browser runtime、CDP/Playwright support 或 OS input support。
- Manual disposition ref 存在但缺少 exact-scope owner/freshness/redaction/artifact binding，或只有 manual disposition 而 required machine evidence lane 未 accepted。

约束：

- Non-proof 可以作为 context 或 blocker 输入，但不能单独解除 WebEnvoy-owned risk blocker。
- #1188 必须消费本 FR 输出的 risk evidence / hint semantics；不得从 non-proof signal 直接推导 gate allow。

### 7. Fail-closed blockers

本 FR 至少冻结以下 blocking reasons：

- `risk_evidence_missing`
- `risk_evidence_unclassified`
- `risk_evidence_stale`
- `risk_evidence_scope_mismatch`
- `risk_evidence_head_mismatch`
- `risk_evidence_run_mismatch`
- `risk_evidence_profile_mismatch`
- `risk_evidence_page_mismatch`
- `risk_evidence_provider_mismatch`
- `risk_evidence_redaction_invalid`
- `provider_stealth_boundary_missing`
- `provider_stealth_boundary_unresolved`
- `provider_stealth_non_proof`
- `provider_private_patch_disclosed`
- `provider_private_patch_required_but_unverified`
- `account_safety_required`
- `account_safety_not_clear`
- `runtime_target_binding_required`
- `runtime_target_binding_not_accepted`
- `extension_native_bridge_required`
- `default_lock_required`
- `operator_unlock_required`
- `live_evidence_required`
- `behavior_baseline_required`
- `route_evidence_required`
- `closeout_audit_required`
- `stub_or_fake_host_evidence`
- `control_plane_only_signal`
- `historical_or_stale_evidence`
- `manual_disposition_required`
- `manual_disposition_not_accepted`
- `risk_hint_consumer_required`
- `downstream_owner_required`

约束：

- Unknown blocking reason 或 required evidence lane 的 unclassified result 必须 fail-closed。
- Manual disposition 缺失、unknown owner、scope drift、freshness drift、redaction invalid、manual-only proof 或未达到 accepted-supporting 条件时，必须使用 `manual_disposition_required`、`manual_disposition_not_accepted` 或更具体的 stale/scope/redaction blocker fail-closed。
- `risk_hint_consumer_required` 表示必须交给 #1188，不表示 #1183 已定义 read/write gate allow。
- `downstream_owner_required` 只允许在本 FR 能明确指出 downstream owner 且当前 PR 不允许实施时使用；不得作为绕过 blocker 的 allow。

### 8. Closeout and audit responsibility

WebEnvoy-owned risk evidence 必须定义 closeout/audit responsibility。

最低 closeout evidence boundary：

- closeout evidence 必须来自当前 PR latest head 或 current latest main 的 fresh run。
- closeout evidence 必须指向具体 `risk_evidence_ref`、`artifact_identity`、`run_id` 或 equivalent machine-checkable locator。
- closeout evidence 必须声明 issue type、readiness/admission status、live validation ladder position、fallback limitations 与 blocker split handling。
- closeout evidence 必须区分 provider-owned declaration、WebEnvoy-owned risk evidence、#1188 gate result、live evidence、account safety 与 fallback product value。

约束：

- 本 FR 不关闭 #1183；formal spec PR 使用 `Refs #1183`。
- Closeout issue 不得承载 implementation discovery、重复 probing 或首次 live 探测。
- DOM/state extraction、observed context、fallback 证据或 provider declaration 不能替代 formal closeout evidence。
- 若 closeout 中出现失败，必须停在失败检查点并拆分 blocker 归属，不得继续推进整个 bundle。

### 9. Provider stealth consumption boundary

WebEnvoy-owned risk evidence 可以消费 `FR-0069` 的以下内容：

- `provider_owned_stealth_boundary_ref`
- `provider_contract_ref`
- `provider_id`
- `provider_mode`
- `owned_domains`
- `limitation_refs`
- `redacted_evidence_refs`
- `freshness_ref`
- `scope_binding`
- `blocking_reasons`
- `handoff_refs`

约束：

- 这些内容只能作为 provider-owned lane 的 declaration/context/blocker 输入。
- Provider private patch payload、raw fingerprint seed、stealth raw values、browser binary diff、driver internal state 或 fingerprint internals 不得进入 WebEnvoy-owned risk evidence object。
- Provider declaration、doctor pass、private patch presence 或 fingerprint seed ref 不得产生 `risk_state=accepted`，除非 WebEnvoy-owned required evidence 同时 fresh、scope matched、redacted 且 blockers 为空。

### 10. Handoff to #1188

本 FR 必须冻结以下 handoff：

- #1183 owns WebEnvoy-owned risk evidence classes、risk evidence state、fail-closed blockers、closeout/audit evidence boundary and provider-stealth consumption limits.
- #1188 owns read/write gate consumer behavior, risk hint enforcement matrix, command output changes and gate decision implementation.
- FR-0066 / #1176 account safety gate remains the base contract; #1187 account safety signal integration remains a sibling/consumer input. This FR consumes account safety refs but does not redefine account safety clear.
- #1182 / FR-0069 owns provider-owned stealth boundary and WebEnvoy non-ownership.

约束：

- #1188 必须消费 #1183 的 `RiskEvidenceGateInputV1` / `RiskEvidenceGateResultV1` 或 later compatible formal contract。
- #1188 不得直接消费 provider private patch payload，也不得把 provider-owned stealth presence 解释为 gate allow。
- 若 #1188 需要新增 read/write gate matrix、command output or parser implementation，必须在 #1188 的独立 PR 中冻结或实现。

## GWT 验收场景

### 场景 1：provider stealth presence 不能直接放行

Given provider-owned stealth boundary 存在且 provider doctor pass
When WebEnvoy 需要判断当前 target capability 的风险证据
Then provider stealth presence 只能作为 provider-owned lane context
And risk evidence 必须继续要求 WebEnvoy-owned accepted evidence
And 不得直接输出 read/write gate allow

### 场景 2：exact scope drift 必须阻断

Given 一个 risk evidence ref 绑定 head A、profile P1 和 target page X
When 当前请求使用 head B、profile P1 和 target page X
Then risk evidence state 必须为 `stale` 或 `scope_mismatch`
And blocking reasons 必须包含 `risk_evidence_head_mismatch`

### 场景 3：account safety 只作为 sibling input

Given `FR-0066` account safety result 为 `clear`
When WebEnvoy-owned risk evidence 需要进入 #1188
Then account safety clear 可以作为 required evidence lane 的必要输入
And 不能替代 provider stealth boundary、runtime target binding、live evidence 或 #1188 gate allow

### 场景 4：redaction invalid 必须 fail closed

Given risk evidence ref 包含 raw fingerprint seed、private patch payload、cookie、token 或 raw profile path
When WebEnvoy-owned risk evidence consumer 处理该 evidence
Then risk evidence state 必须为 `redaction_invalid`
And blocking reasons 必须包含 `risk_evidence_redaction_invalid` 或 `provider_private_patch_disclosed`

### 场景 5：#1188 不得绕过 #1183

Given read/write gate 需要消费 runtime risk hints
When provider boundary、account safety 或 live evidence lane 独立存在
Then #1188 必须消费 #1183 输出的 risk evidence / hint semantics
And 不得从单一 lane presence 直接推导 read/write allow

### 场景 6：manual disposition 不能单独清除 blocker

Given 一个 `manual_risk_disposition_ref` 声称 operator 已接受当前风险
When provider boundary、account safety、runtime target binding 或 live evidence required lane 缺失、过期或 scope 不匹配
Then manual disposition 只能作为 manual context 或 blocker explanation
And risk evidence state 必须为 `blocked`、`stale`、`scope_mismatch` 或 `unclassified`
And blocking reasons 必须包含 `manual_disposition_not_accepted` 或对应的 required lane blocker

## 异常与边界场景

- Provider 不声明 stealth boundary：若 target capability 依赖 stealth，risk evidence 必须 fail-closed；若不依赖 stealth，仍不得把缺失解释为 risk accepted。
- Provider 声明 `declared_only` 或 `doctor_checked`：只能作为 diagnostic/context 输入，不得满足 WebEnvoy-owned accepted evidence。
- Account safety result 缺失或非 clear：涉及 `write_prepare` / `live_write_commit` 的 risk evidence 必须 blocked；本 FR 不尝试修复 account safety。
- Runtime target binding、extension/native bridge、default lock、operator unlock 或 live evidence lane 只存在 issue/PR/contract 文本：不能替代 current exact-scope accepted result。
- Redacted refs 存在但 freshness / scope 不匹配：不得消费为当前 head / run / profile / target / provider 的 accepted evidence。
- Future risk evidence class 不在本 FR enum 内：后续 consumer 必须 fail-closed 或另开 formal spec review 扩展 enum。

## 验收标准

- `FR-0070-webenvoy-owned-risk-evidence-boundary` formal suite 已建立，并映射 canonical issue #1183。
- Suite 明确 accepted evidence classes、non-proof signals、risk evidence states、binding/freshness rules、fail-closed blockers、closeout/audit responsibility、provider stealth consumption boundary 与 #1188 handoff。
- Suite 未修改 runtime/source code、scripts、workflows、tests、fixtures、provider adapter、XHS driver、JSON-RPC、Syvert normalized result、account safety implementation、live evidence gate、read/write gate 或 browser patch implementation。
- PR metadata 使用 `Refs #1183`，不自动关闭 #1183/#1188/#1118。
- 本地静态验证通过：docs guard、spec guard、sync map、spec mapping assertion、PR purity、diff check 与 same-class scope/closing scan。

## 依赖与前置条件

- 已合入：`FR-0069 Provider-Owned Stealth Boundary` / #1182，PR #1280 merge commit `a16bcdf8a7f5245fcda0ee587bbd2f0b9999377b`。
- 已合入并可被引用：`FR-0033 Browser Provider Contract`、`FR-0040 Provider Evidence Kernel`、`FR-0041 Evidence Redaction Policy`、`FR-0066 Account Safety Gate` / #1176、`FR-0067 Extension Native Bridge Gate`、`FR-0068 Live-Write Commit Default Lock`。
- #1183 issue 当前为 OPEN，scope 是 “Define WebEnvoy-owned risk evidence, gates and closeout responsibilities independent of provider stealth internals.” 它依赖 #1182。
- #1188 issue 当前为 OPEN，scope 是 “Define how runtime risk hints are consumed by read/write gates and closeout evidence.” 它依赖 #1183。
