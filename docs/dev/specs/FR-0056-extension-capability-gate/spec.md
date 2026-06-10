# FR-0056 Extension Capability Gate

Canonical Issue: #1153

## 背景

`#1153` 属于 `#1114 CloakBrowser Provider` 的 M10 extension / admission lane。它的 issue scope 是在需要 WebEnvoy extension bridge 的 workflow 被准入前，先验证 extension load capability 与相关 health / doctor 输入是否满足最低要求。

上游输入已经由相邻 formal suites 冻结：

- `FR-0052 CloakBrowser Capability Matrix`：冻结 `extension-runtime.bridge`、`native-bridge.messaging` 与 page automation rows 的 support level、minimum support state、required runtime requirements 和 limitation disposition。
- `FR-0054 CloakBrowser Persistent Profile Health`：冻结 persistent profile、extension load、extension runtime surface、profile binding、Native Messaging surface 与 freshness / evidence refs 的 health signal。
- `FR-0055 Cloakserve Limitation Gate`：冻结 `cloakbrowser.cloakserve` 对 extension runtime、Native Messaging 与 WebEnvoy relay bridge 的 default blocked / deny gate。
- `FR-0057 CloakBrowser Native Messaging Bridge Doctor`：冻结 Native Messaging bridge doctor handoff 与 WebEnvoy extension/native host ownership 边界。

当前缺口是：downstream runtime / provider selection / page automation owner 需要一个稳定 gate，判断“请求的 workflow 是否可以依赖 WebEnvoy extension bridge”。如果没有本 gate，后续 PR 容易把 descriptor 存在、extension locator、profile health、Native Messaging doctor、runtime ping、bootstrap ack 或历史 artifact 误写成 extension bridge ready。

本 FR 只冻结 `extension_capability_gate` formal suite。它不实现 runtime code、provider adapter behavior、extension/native host behavior、browser/live actions、fixtures、scripts、workflows、guardian/formal review、controlled merge 或 issue closeout；也不声明 extension bridge ready、Native Messaging ready、target-tab ready、runtime-ready 或 live evidence attested。

## 目标

1. 冻结 `extension_capability_gate` 的 input / output、ownership、decision policy 与 fail-closed 语义。
2. 消费 `FR-0052` capability matrix，按 provider variant 与 capability row 判断 extension bridge / Native Messaging / page automation admission minimum。
3. 消费 `FR-0054` persistent profile health，明确 extension load、extension runtime surface、profile binding、freshness 与 evidence refs 的最低要求。
4. 消费 `FR-0055` cloakserve limitation gate，确保 cloakserve 默认 extension / Native Messaging / relay bridge workflow blocked / deny。
5. 消费 `FR-0057` Native Messaging bridge doctor handoff，在 requested workflow 需要 Native Messaging 时要求 WebEnvoy-owned doctor refs。
6. 明确本 suite 只定义 gate requirements，不生成 current runtime attestation、runtime observation、target tab binding、live evidence 或 capability allow evidence。

## 非目标

- 不修改 `FR-0052` capability matrix rows、support levels、variant inputs 或 downstream owner。
- 不修改 `FR-0054` health result fields、freshness model、evidence refs 或 fail-closed matrix。
- 不修改 `FR-0055` cloakserve limitation gate result、default hard block 或 experimental issue requirement。
- 不修改 `FR-0057` Native Messaging bridge doctor handoff、failure classes 或 doctor ownership。
- 不实现 provider registry parser、provider selection、doctor command、runtime launch、extension install/load/probe、Native Messaging bridge、Playwright/CDP attach、CLI、fixtures、tests、scripts 或 workflows。
- 不执行 browser/profile/account/live/external-visible actions。
- 不定义 Syvert normalized result、XHS business semantics、default live_write、CloakBrowser private patch schema、raw local path、credential、account identifier、page content、raw argv、raw seed、native host secret 或 provider broker secret。
- 不推进 #1145 closeout blocker，也不声明 #1153 work item complete by auto-close keyword。

## 功能需求

### 1. Gate 定位与 ownership

系统必须冻结一个稳定的 `extension_capability_gate`。

约束：

- Gate owner 固定为 `#1153` / `FR-0056`。
- Gate 输入只能消费 `FR-0052` matrix rows、`FR-0054` persistent profile health refs、`FR-0055` limitation gate refs、`FR-0057` bridge doctor refs，以及 `FR-0035` support state / blocking reason 语义。
- Gate 输出只表达 extension capability admission disposition，不表达 runtime status、provider health payload、launch evidence record、live evidence record、fixture payload 或 provider implementation detail。
- Gate 不得被解释为 extension bridge、Native Messaging、target tab、runtime bootstrap、page command 或 live evidence 已通过。
- Downstream runtime / page automation / provider selection owner 必须消费本 gate output，不得用 descriptor prose、local operator flag 或 historical artifact 绕过本 gate。

### 2. Gate 输入

`extension_capability_gate_input` 必须至少包含：

- `provider_id`
- `variant_kind`
- `capability_id`
- `requested_workflow`
- `capability_matrix_ref`
- `capability_matrix_row_ref`
- `minimum_support_state`
- `required_runtime_requirements`
- `persistent_profile_health_ref`
- `cloakserve_limitation_gate_ref`
- `native_messaging_bridge_doctor_ref`
- `runtime_attestation_ref`
- `runtime_observation_ref`
- `live_evidence_ref`
- `evidence_refs`
- `caller_intent`

约束：

- `provider_id` 只能是 `cloakbrowser.direct`、`cloakbrowser.persistent` 或 `cloakbrowser.cloakserve`。
- `capability_matrix_ref` 必须指向 `FR-0052`；缺失或 stale 时必须 fail-closed。
- `persistent_profile_health_ref` 只适用于 `cloakbrowser.persistent` required route；direct / cloakserve 不得伪造 persistent health pass。
- `cloakserve_limitation_gate_ref` 在 provider 为 `cloakbrowser.cloakserve` 时必须存在并被消费；缺失时所有 extension / Native Messaging / relay workflow blocked / deny。
- `native_messaging_bridge_doctor_ref` 只在 requested workflow 或 capability runtime requirements 包含 Native Messaging 时必需；direct / cloakserve 默认 unsupported 时不得用 doctor ref 覆盖 descriptor limitation。
- `runtime_attestation_ref`、`runtime_observation_ref` 与 `live_evidence_ref` 是 downstream refs；本 formal suite 不生成它们。
- `evidence_refs` 只能引用 carrier，不得内联 sensitive logs、full page content、cookies、tokens、raw profile path、raw native manifest、raw argv、raw seed 或 provider-private patch detail。

### 3. Requested workflow 分类

Gate 必须至少识别以下 `requested_workflow`：

- `extension_runtime_bridge`
- `webenvoy_relay_bridge`
- `native_messaging_bridge`
- `runtime_launch_with_extension`
- `page_read_with_extension`
- `page_write_with_extension`
- `page_download_with_extension`
- `provider_diagnose_extension`
- `capability_admission_preflight`

约束：

- Unknown workflow 必须按 `FR-0035` 输出 blocked / deny，blocking reason 包含 `unknown_requested_workflow` 或 `capability_not_declared`。
- `extension_runtime_bridge`、`webenvoy_relay_bridge` 与任何 `*_with_extension` workflow 必须消费 `FR-0052` 的 `extension-runtime.bridge` row 或对应 page automation row。
- `native_messaging_bridge` 或任何 runtime requirement 包含 `native_messaging` 的 workflow 必须消费 `FR-0057` doctor handoff；doctor pass 最高只能满足 doctor-layer requirement，不得自动产生 runtime/live allow。
- `provider_diagnose_extension` 可接受 diagnostic-only evaluation，但不得把 diagnostics 结果转化为 business read/write/download allow。

### 4. Provider variant gate policy

#### 4.1 `cloakbrowser.direct`

Direct variant 默认不满足 WebEnvoy extension bridge admission。

约束：

- `FR-0052` 中 direct 的 `extension-runtime.bridge` row 是 locator-only / declared boundary；它不满足 stable extension identity、extension runtime surface 或 Native Messaging bridge requirement。
- `native-bridge.messaging` 对 direct 为 unsupported；请求 Native Messaging 必须 deny。
- Direct page read/write/download 不能用 extension bridge gate 产生 allow；若 downstream runtime owner 另有 non-extension route，必须在独立 runtime gate 中处理。
- Future owner 若要允许 direct extension bridge，必须先冻结 stable extension identity / extension runtime / runtime attestation refs；本 FR 不提供该例外。

#### 4.2 `cloakbrowser.persistent`

Persistent variant 是本 gate 的主要 applicable route，但仍默认 fail closed，直到 required refs 当前、可追溯且满足最低状态。

Persistent extension workflow 至少要求：

- `FR-0052` row support level 不低于目标 workflow 的 minimum support state。
- `FR-0054` `profile_binding`、`profile_state`、`extension_surface` 与 required `freshness` 均为 pass-compatible state。
- 当 workflow 需要 Native Messaging 时，`FR-0057` bridge doctor handoff 结论达到 doctor-layer ready，并且 owner 是 WebEnvoy extension/native host/bridge owner。
- Runtime / page automation admission 仍需要 downstream `runtime_attestation_ref`、`target_tab_binding_ref` 或 `runtime_observation_ref`，不得只依赖 health / doctor pass。

约束：

- `FR-0054` health pass 不等于 runtime bootstrap ready、target tab ready、command success、account safety pass 或 live evidence。
- `extension_runtime_surface_status=surface_visible` 仍只能作为 health input；business admission 必须继续满足 requested workflow 的 runtime minimum。
- `native_messaging_surface` health 与 `FR-0057` bridge doctor 都不能替代 runtime attestation。
- Stale health, stale doctor, unknown freshness, invalid redaction, profile lock conflict, extension source mismatch, Native Messaging owner mismatch 或 stub/fake host evidence 必须 blocked / deny。

#### 4.3 `cloakbrowser.cloakserve`

Cloakserve variant 必须消费 `FR-0055` limitation gate。

约束：

- Extension runtime bridge、WebEnvoy relay bridge 与 Native Messaging bridge 默认 blocked / deny。
- `FR-0055` scoped experimental issue 只能把 hard block 降为 downstream-specific evaluation；它不能产生 allow。
- `FR-0052` declared-only cloakserve business rows 不满足 default business admission。
- CDP endpoint existence、runtime ping、bootstrap ack、doctor success、final args evidence、historical artifact 或 same-head old artifact 不能绕过 `FR-0055` 与本 gate。

### 5. Minimum evidence and state policy

Gate 必须按 `FR-0035` support state 处理 minimum。

默认 minimum：

| workflow class | minimum support state | required refs |
|---|---|---|
| diagnostics only | `health_checked` | capability matrix row, relevant health / doctor refs |
| extension bridge preflight | `runtime_attested` | matrix row, extension health, runtime attestation |
| Native Messaging bridge preflight | `runtime_attested` | matrix row, extension health, bridge doctor, runtime attestation |
| page read with extension | `runtime_attested` | matrix row, extension health, target tab binding, runtime attestation |
| page write / download with extension | `runtime_observed` | matrix row, extension health, target tab binding, runtime observation, applicable risk/artifact policy refs |
| latest-head live closeout | `live_evidence_attested` | accepted live evidence gate refs from downstream owner |

约束：

- `declared` 或 `statically_verified` 不满足 extension bridge runtime admission。
- `health_checked` 只满足 diagnostic / doctor-layer requirement；业务 workflow 仍需 runtime refs。
- `runtime_attested` 不证明 page behavior, artifact output 或 live evidence。
- `live_evidence_attested` 只有 downstream live gate owner 可提供；本 suite 不生成或要求 fresh live run。
- 任一 required ref 缺失、stale、owner mismatch、head mismatch、source conflict 或 redaction invalid 时，gate 必须 blocked / deny。

### 6. Gate 输出

`extension_capability_gate_result` 必须至少包含：

- `provider_id`
- `variant_kind`
- `capability_id`
- `requested_workflow`
- `support_state`
- `decision`
- `gate_status`
- `blocking_reasons`
- `matrix_refs_consumed`
- `health_refs_consumed`
- `limitation_gate_refs_consumed`
- `bridge_doctor_refs_consumed`
- `runtime_refs_required`
- `runtime_refs_consumed`
- `downstream_owner`
- `verified_at`

约束：

- `support_state` 必须使用 `FR-0035.support_state`。
- `decision` 只能为 `allow`、`deny` 或 `defer`。
- 本 formal suite 不产出具体 `decision=allow` artifact；`allow` 只是 future implementation 在 current refs 满足 minimum 时可用的 enum。
- `gate_status` 至少支持 `blocked`、`deferred_to_runtime_owner`、`deferred_to_experimental_owner`、`admission_ready`、`not_applicable`。
- `admission_ready` 仍只表示本 gate 的 extension capability prerequisites 满足；它不等于 live evidence, target-tab command success, business result success 或 issue closeout。
- `blocking_reasons` 必须机器可读；非空时最终 `support_state=blocked` 且 `decision=deny`。
- `verified_at` 是 concrete gate evaluation time；formal suite sample 可写 `N/A`，不得伪装成 runtime verification time。

### 7. Blocking reasons

Gate 至少冻结以下 blocking reason：

- `capability_not_declared`
- `unknown_requested_workflow`
- `matrix_ref_missing`
- `minimum_support_state_unmet`
- `extension_binding_missing`
- `extension_identity_missing`
- `extension_load_not_ready`
- `extension_runtime_surface_missing`
- `profile_binding_missing`
- `profile_state_not_healthy`
- `health_freshness_stale`
- `native_messaging_required`
- `native_messaging_unsupported`
- `native_bridge_doctor_missing`
- `native_bridge_doctor_not_ready`
- `cloakserve_limitation_gate_missing`
- `cloakserve_extension_bridge_blocked`
- `cloakserve_native_messaging_blocked`
- `runtime_attestation_required`
- `runtime_observation_required`
- `target_tab_binding_required`
- `live_evidence_required`
- `evidence_ref_invalid`
- `source_owner_mismatch`
- `stub_or_fake_host_evidence`
- `stale_or_historical_evidence`
- `redaction_invalid`

约束：

- Blocking reason 命中 required workflow 时必须优先于 any non-blocking support state。
- `live_evidence_required` 只能说明 downstream live gate 仍未满足；不得在本 FR 中补造 live evidence record。
- `stub_or_fake_host_evidence`、`stale_or_historical_evidence` 与 `source_owner_mismatch` 必须 fail closed。

## GWT 验收场景

### 场景 1：persistent extension bridge 缺少 extension health 时阻断

Given selected provider is `cloakbrowser.persistent`
And requested workflow is `extension_runtime_bridge`
And `FR-0052` declares an extension bridge row for persistent
When `FR-0054` extension health ref is missing, stale or non-pass
Then extension capability gate must return blocked / deny
And it must not treat descriptor refs as extension load capability proof

### 场景 2：persistent Native Messaging 需要 WebEnvoy-owned bridge doctor

Given requested workflow requires Native Messaging
And `FR-0054` native messaging surface health exists
When `FR-0057` bridge doctor handoff is missing, stale, owner-mismatched or sourced from stub/fake host
Then gate must keep Native Messaging requirement unsatisfied
And blocking reason must include `native_bridge_doctor_missing` or `native_bridge_doctor_not_ready`

### 场景 3：health pass 不等于 runtime ready

Given persistent profile and extension health are pass-compatible
And Native Messaging doctor is doctor-layer ready
When `runtime_attestation_ref` or target tab binding is absent for a runtime/page workflow
Then gate must return blocked / deny or defer to runtime owner
And must not claim runtime-ready, target-tab-ready or command success

### 场景 4：cloakserve extension bridge 默认阻断

Given selected provider is `cloakbrowser.cloakserve`
And requested workflow is `webenvoy_relay_bridge`
When no matching `FR-0055` scoped experimental issue and downstream evidence are attached
Then gate must return blocked / deny
And blocking reasons must include `cloakserve_extension_bridge_blocked`

### 场景 5：direct Native Messaging unsupported

Given selected provider is `cloakbrowser.direct`
And requested workflow is `native_messaging_bridge`
When consumer provides a local Native Messaging artifact
Then gate must still return blocked / deny unless a later formal descriptor owner changes direct applicability
And it must not override `FR-0052` unsupported disposition

### 场景 6：live evidence remains downstream

Given a workflow requires latest-head live evidence
When only this FR-0056 formal suite exists
Then gate must report `live_evidence_required`
And `live_evidence_record` for this PR must remain `N/A`

## 异常与边界场景

- `capability_matrix_ref` is not `FR-0052`: blocked / deny.
- Persistent route has profile health pass but extension health unknown: blocked / deny.
- Persistent route has extension loaded but profile binding or freshness stale: blocked / deny.
- Bridge doctor says ready but owner is not WebEnvoy extension/native host/bridge owner: blocked / deny.
- Cloakserve limitation gate result is missing, stale, closed experimental issue, scope mismatch or still blocked: blocked / deny.
- Result tries to use runtime ping, bootstrap ack, descriptor existence, provider-private flag, historical artifact or same-head old artifact as current proof: blocked / deny.
- Result contains raw profile path, native manifest body, cookie, token, provider broker secret, private patch payload, page content or raw seed: redaction violation and blocked.
- Gate result claims extension bridge ready, Native Messaging ready, target-tab ready, runtime-ready, live evidence attested or issue closeout without downstream accepted refs: scope violation.

## 验收标准

1. `FR-0056` maps to canonical issue `#1153` and defines only the Extension Capability Gate formal suite.
2. Gate consumes `FR-0052`, `FR-0054`, `FR-0055`, `FR-0057` and `FR-0035` semantics without modifying their owners.
3. Persistent extension workflows require current extension/profile health and, where applicable, WebEnvoy-owned Native Messaging bridge doctor refs.
4. Direct and cloakserve variants fail closed for extension / Native Messaging workflows according to their matrix and limitation inputs.
5. Suite does not touch runtime/source code, provider adapter behavior, scripts, workflows, browser/live actions, #1145 closeout or issue closeout.
6. PR metadata uses `Refs #1153` / refs-only, `closingIssuesReferences=[]`, `local_only` integration, `live_evidence_record=N/A`, and scheduler-owned gate.
