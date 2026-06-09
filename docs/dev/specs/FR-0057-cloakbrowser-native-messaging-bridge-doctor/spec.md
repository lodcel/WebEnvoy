# FR-0057 CloakBrowser Native Messaging Bridge Doctor

Canonical Issue: #1154

## 背景

`#1154` 属于 `#1114 CloakBrowser Provider` 的 M10 native messaging lane。issue scope 要求通过 WebEnvoy extension / native host / bridge doctor 验证 Native Messaging，而不是把 Native Messaging 写成 CloakBrowser 自有 capability。

上游契约已经冻结了关键边界：

- `FR-0038 Provider Health / Doctor Contract`：provider doctor 的唯一共享 carrier 是 `provider_doctor_report`，Native Messaging 只能通过 `category="native_messaging"` 的 checks 和 capability readiness 聚合进入 `doctor_checked`。
- `FR-0046 Native Messaging Health`：official Chrome 的 Native Messaging health 已冻结 host identity、manifest locator、allowed origins、registration、socket availability、bridge handshake 与 fail-closed 语义。
- `FR-0050 cloakbrowser.persistent Descriptor`：persistent variant 需要 extension workflow、native messaging 与 provider broker inputs，但 descriptor refs 不等于 health pass。
- `FR-0051 cloakbrowser.cloakserve Descriptor`：cloakserve 默认不支持 WebEnvoy extension bridge / Native Messaging，任何相关 capability 必须 fail-closed，除非后续 owner 明确 opt in。

当前缺口是：CloakBrowser lane 中的 Native Messaging 必须由 WebEnvoy bridge owner 诊断并产出可消费证据，CloakBrowser descriptor 只能提供可检查输入或限制。若不单独冻结该边界，后续 capability matrix、health gate 或 PR 元数据可能把 CloakBrowser managed browser support 误写成 Native Messaging bridge ready，从而绕过 extension/native host ownership、source integrity、redaction、handoff 和 fail-closed gate。

本 FR 只冻结 CloakBrowser Native Messaging Bridge Doctor 的 formal contract。它不实现 doctor command、native host behavior、extension behavior、runtime code、capability matrix、limitation gate、browser patching、Syvert、XHS 或 live evidence execution。

`#1154` 是 `work-item-complete` native sub-issue，但本 PR 处于 formal spec review 阶段；suite 合入只冻结 FR-0057 formal inputs，后续 runtime implementation / doctor command / capability matrix 仍由下游 issue 承接。因此 PR metadata 必须使用 `Refs #1154`，不得自动关闭 issue。

## 目标

1. 冻结 CloakBrowser Native Messaging bridge doctor 的 ownership：WebEnvoy extension/native host/bridge owner 负责验证，CloakBrowser 不拥有该 capability。
2. 冻结 persistent / direct / cloakserve variants 的 Native Messaging doctor applicability 与 fail-closed边界。
3. 冻结 bridge doctor evidence 的输入边界、required checks、failure classes、redaction 与 source integrity 规则。
4. 冻结 handoff 输出，使后续 capability matrix、limitation gate、health implementation 与 evidence owner 能消费同一组 machine-readable conclusions。
5. 明确 doctor pass 最高只能支撑 `doctor_checked`，不得被表述为 runtime attestation、target tab ready、live evidence 或账号安全通过。

## 非目标

- 不实现 `webenvoy doctor`、provider doctor command、native host、socket server、extension service worker、bridge protocol、CLI、Playwright、fixtures、tests 或 runtime code。
- 不修改 `FR-0038`、`FR-0046`、`FR-0050`、`FR-0051` 的既有字段 shape；本 FR 只消费并缩窄它们。
- 不定义 capability matrix rows、supported actions、verification threshold、limitation gate result 或 selection policy；这些属于后续 #1149/#1152 等 owner。
- 不定义 CloakBrowser private patch schema、driver internal state、provider broker credential、license token、account strategy 或 browser patch behavior。
- 不触碰 Syvert normalized result、XHS business semantics、official Chrome service worker implementation、default live_write、real browser closeout 或 live evidence gate。
- 不执行 browser/profile/account/live/external-visible 动作；本 FR 的 `live_evidence_record` 为 `N/A`。

## 功能需求

### 1. Contract 定位与 ownership

系统必须冻结一个稳定的 `cloakbrowser_native_messaging_bridge_doctor_handoff` contract。

约束：

- 本 contract 的 ownership 属于 `#1154` / `FR-0057`，它是 CloakBrowser provider lane 对 WebEnvoy Native Messaging bridge doctor 的 handoff contract。
- Native Messaging bridge 的实际验证 owner 必须是 WebEnvoy extension / native host / bridge doctor owner，不是 CloakBrowser provider、CloakBrowser browser patch、CloakBrowser broker 或 provider-private automation layer。
- CloakBrowser variant descriptor 只能提供 doctor input refs、applicability constraints 和 limitations；不能把 Native Messaging 声明为 CloakBrowser-owned capability。
- 后续 implementation 必须将 bridge doctor 结论写入或映射到 `FR-0038.provider_doctor_report.checks[*].category="native_messaging"`；不得新增 parallel health result schema。
- 本 handoff contract 不得被解释为 runtime status、provider registry row、capability matrix allow row、limitation gate pass、launch evidence、live evidence record 或 account safety proof。

### 2. Variant applicability

`cloakbrowser_native_messaging_bridge_doctor_handoff.identity` 必须至少绑定：

- `handoff_id`
- `handoff_contract_version`
- `canonical_issue`
- `provider_id`
- `variant_kind`
- `doctor_owner`
- `provider_contract_ref`
- `created_at`

约束：

- `handoff_contract_version` 当前冻结为 `v1`。
- `provider_id` 只能为 `cloakbrowser.direct`、`cloakbrowser.persistent` 或 `cloakbrowser.cloakserve`。
- `variant_kind` 只能为 `direct`、`persistent` 或 `cloakserve`，且必须与 `provider_id` 一致。
- `doctor_owner` 必须为 `webenvoy_native_messaging_bridge_doctor` 或后续正式 FR 等价 owner；不得为 `cloakbrowser_provider`。
- `cloakbrowser.persistent` 是本 FR 的主要 applicable variant，因为其 descriptor 声明 extension workflow 与 Native Messaging refs。
- `cloakbrowser.cloakserve` 默认 `native_messaging_support=none`，本 FR 只能输出 `unsupported_by_descriptor|not_applicable_fail_closed` 结论，不得升级为 supported。
- `cloakbrowser.direct` 只有在后续正式 descriptor/owner 明确提供 WebEnvoy extension/native host refs 时才可进入 doctor preflight；否则必须 `not_applicable_fail_closed`。

### 3. Doctor input boundary

handoff 必须至少表达以下 input refs：

- `provider_descriptor_ref`
- `extension_identity_ref`
- `native_host_identity_ref`
- `native_host_manifest_ref`
- `allowed_origins_ref`
- `host_registration_ref`
- `bridge_transport_ref`
- `profile_binding_ref`
- `provider_broker_ref`
- `redaction_policy_ref`

约束：

- input refs 是 locator、redacted ref、opaque handle 或 report-local ref，不得内联 manifest 原文、full local path、token、Cookie、license secret、profile path、account id、provider broker credential 或 private patch payload。
- `provider_descriptor_ref` 必须指向相应 CloakBrowser descriptor owner；descriptor 存在不等于 bridge ready。
- `extension_identity_ref` 与 `allowed_origins_ref` 必须可追溯到 WebEnvoy extension identity owner；CloakBrowser upstream extension loading support 不得替代 WebEnvoy extension identity conclusion。
- `native_host_identity_ref`、`native_host_manifest_ref`、`host_registration_ref` 与 `bridge_transport_ref` 必须由 WebEnvoy Native Messaging bridge owner提供或验证。
- 缺失 required input、input owner 不匹配、redaction invalid 或 source conflict 时，bridge doctor 必须 fail-closed。

### 4. Required bridge doctor checks

当 variant applicability 要求 Native Messaging bridge doctor 时，后续 `FR-0038.provider_doctor_report` 必须至少包含以下 `native_messaging` provider-level checks：

- `bridge_owner_attribution`
- `descriptor_applicability`
- `extension_identity_binding`
- `native_host_identity`
- `native_host_manifest`
- `allowed_origins`
- `host_registration`
- `bridge_transport_availability`
- `bridge_handshake_preflight`
- `handoff_artifact_integrity`

约束：

- 每项 check 必须使用 `ProviderDoctorCheck`，`category="native_messaging"`。
- provider-level check 使用 `capability_id="N/A"`。
- 如果 requested capability 要求 `native_messaging`，必须另有对应 `capability_readiness` check 消费上述 provider-level results。
- 任一 required check 缺失、`status=not_applicable|unknown|fail`、required evidence 不可用、owner mismatch 或 source integrity 失败时，受影响 provider / capability 必须 fail-closed。
- `bridge_handshake_preflight` 只证明 WebEnvoy extension/native host bridge preflight，不证明 runtime bootstrap、target tab、page command success、account safety 或 live evidence。

### 5. Ownership attribution check

`bridge_owner_attribution` 必须证明 Native Messaging bridge doctor 的 owner 是 WebEnvoy。

必须验证：

- handoff `doctor_owner` 是 WebEnvoy bridge owner。
- evidence ref 来自 WebEnvoy extension/native host/bridge doctor boundary。
- CloakBrowser descriptor、provider broker 或 private browser patch 没有被写成 Native Messaging capability owner。

失败语义：

- owner missing、owner mismatch、CloakBrowser-owned claim、provider-private source claim 或 ambiguous ownership 必须 `status=fail`。
- 命中 required Native Messaging provider/capability 时，`blocking=provider_blocking`。

### 6. Descriptor applicability check

`descriptor_applicability` 必须按 variant fail-closed：

- `cloakbrowser.persistent`：只有 descriptor refs 与 extension/native bridge inputs 均存在时，才可进入 bridge doctor preflight。
- `cloakbrowser.direct`：默认不满足 Native Messaging doctor，除非后续 owner 明确提供 extension/native bridge refs。
- `cloakbrowser.cloakserve`：默认不支持 WebEnvoy extension bridge / Native Messaging，必须输出 unsupported / blocked conclusion。

约束：

- descriptor refs 只决定是否进入 doctor preflight，不产生 pass。
- `native_messaging_support=required` 只表达 required doctor input，不等于 ready。
- `native_messaging_support=none` 不得被 later handshake artifact 覆盖，除非先有正式 FR 修改 descriptor applicability。

### 7. Extension identity and allowed origins checks

`extension_identity_binding` 与 `allowed_origins` 必须证明 WebEnvoy extension identity 与 Native Messaging manifest allowed origins 可绑定。

必须验证：

- `extension_identity_ref` 存在，并来自 WebEnvoy extension identity owner。
- `allowed_origins_ref` 存在，且能绑定到 expected WebEnvoy extension id / origin。
- evidence redaction 符合 `FR-0041` 或等价 redaction policy。
- CloakBrowser upstream extension loading、extension paths 或 provider-managed extension workflow 不得替代 WebEnvoy extension identity binding。

失败语义：

- extension identity missing、allowed origins missing、origin mismatch、descriptor-only refs、upstream-only support、redaction invalid 或 stale evidence 必须 fail-closed。

### 8. Native host, registration and transport checks

`native_host_identity`、`native_host_manifest`、`host_registration` 与 `bridge_transport_availability` 必须消费 WebEnvoy Native Messaging bridge owner 的 evidence refs。

约束：

- host identity 必须使用 stable logical id 或 redacted locator，不得内联 raw manifest、full path、argv/env、token 或 profile path。
- host registration 必须证明 selected execution surface 可发现目标 host；wrong channel、wrong profile、wrong origin 或 stale registration 均不能 pass。
- bridge transport availability 只能表达 local socket / pipe / stdio preflight 的当前可达结论；不得冻结 implementation path、pipe name、port 或 retry algorithm。
- transport availability 不等于 runtime bootstrap ready 或 target tab ready。

失败语义：

- missing host, manifest missing, registration missing, wrong channel, socket unavailable, stale pipe, contention, permission denied, redaction invalid 或 source owner mismatch 必须映射为 non-pass FR-0038 check。

### 9. Bridge handshake preflight

`bridge_handshake_preflight` 必须判断 WebEnvoy extension-to-native-host bridge 能完成最小 doctor handshake。

约束：

- handshake payload 不得包含 bootstrap secret、extension private payload、Cookie、token、profile path、raw manifest、provider private patch payload 或 account id。
- handshake 必须绑定 provider id、expected extension origin、native host identity 与 doctor scope。
- 来自 stub/fake host、历史 artifact、same-head old artifact、非目标 profile、非 WebEnvoy extension origin 或 CloakBrowser provider-private bridge 的 ack 不能 pass。
- handshake pass 最高只能满足 doctor-layer `native_messaging` readiness；仍需后续 runtime / live gates。

失败语义：

- no ack、version mismatch、provider id mismatch、extension origin mismatch、host identity mismatch、secret leak、stale ack、stub/fake source 或 non-WebEnvoy source 必须 fail-closed。

### 10. Failure classes

handoff 与后续 doctor report 必须使用稳定 failure classes。至少冻结：

- `ownership_mismatch`
- `descriptor_unsupported`
- `descriptor_input_missing`
- `extension_identity_missing`
- `extension_origin_mismatch`
- `native_host_identity_missing`
- `native_manifest_missing`
- `native_manifest_redaction_invalid`
- `allowed_origins_missing`
- `host_registration_missing`
- `host_registration_mismatch`
- `bridge_transport_unavailable`
- `bridge_transport_stale`
- `bridge_transport_contention`
- `bridge_handshake_missing`
- `bridge_handshake_mismatch`
- `stub_or_fake_host_evidence`
- `stale_or_historical_evidence`
- `source_integrity_failed`
- `secret_or_private_payload_leak`
- `runtime_gate_required`

约束：

- failure class 必须机器可读，可映射到 `FR-0038.ProviderDoctorDiagnostics.code`。
- `runtime_gate_required` 是 non-proof boundary，不得被用于绕过 required doctor failures。
- 新增 failure class 可以在后续实现细化，但不得降低 fail-closed 语义。

### 11. Stateful conclusion matrix

Bridge doctor handoff 至少支持以下 conclusion states：

| State | Required signals | FR-0038 mapping | Next action |
|---|---|---|---|
| `bridge_doctor_ready` | WebEnvoy owner attribution、descriptor applicability、extension identity、manifest/origin/registration、transport availability、handshake 和 handoff artifact integrity 均为 current / redacted / non-stub evidence | `status=pass`; no provider/capability blocking for native messaging doctor requirement | 可满足 doctor-layer `native_messaging` requirement；仍需 runtime/live gates |
| `bridge_doctor_recoverable` | 当前 preflight 发现 stale transport、transient no-ack、recoverable lock/contention，且 source 是 WebEnvoy owner / redacted | `status=warn|fail`; capability blocking when requested capability requires Native Messaging | 后续实现可 bounded same-run recovery；未恢复前不能 pass |
| `bridge_doctor_blocked` | descriptor unsupported、owner mismatch、origin mismatch、registration mismatch、stub/fake source、secret leak、provider-private source 或不可安全清理的 contention | `status=fail`; provider/capability blocking according to required scope | 修复配置、owner 或 evidence 后重跑 |
| `bridge_doctor_unknown` | missing evidence、partial evidence、stale without freshness proof、source conflict、unsupported enum 或 policy gap | `status=unknown|fail`; fail-closed for required Native Messaging | 收集 evidence 或 manual review |
| `not_applicable_fail_closed` | variant 不支持或未声明 WebEnvoy extension/native bridge inputs | `status=not_applicable|fail`; required Native Messaging 不得满足 | 下游 capability/limitation owner 保持 deny/block |

约束：

- `bridge_doctor_ready` 不得升级为 `runtime_attested` 或 `live_evidence_attested`。
- `recoverable` 不满足 admission，除非当前 doctor scope 内产生 fresh `bridge_doctor_ready` evidence。
- historical artifact、same-head old artifact 或 descriptor-only refs 不能满足 current readiness。

### 12. Handoff output

handoff 输出必须至少包含：

- `identity`
- `input_refs`
- `applicability`
- `required_checks`
- `stateful_conclusion`
- `failure_classes`
- `provider_doctor_report_ref`
- `evidence_refs`
- `next_required_gates`

约束：

- `provider_doctor_report_ref` 可为空；为空时 `stateful_conclusion` 不得为 `bridge_doctor_ready`。
- `evidence_refs` 必须按 FR-0038/FR-0040/FR-0041 兼容语义表达 kind、ref、status、collected_at、sensitivity，不得内嵌 secret。
- `next_required_gates` 至少可包含 `runtime_attestation`、`live_evidence`、`capability_matrix`、`limitation_gate`、`manual_review`。
- handoff 不得包含 raw handshake payload、manifest body、profile path、account id、private patch payload 或 broker credential。

### 13. Capability readiness consumption

当 requested capability 声明 `native_messaging` runtime requirement 时，对应 `capability_readiness` 必须消费本 FR 定义的 provider-level checks。

约束：

- 所有 required checks 必须 `status=pass`、`blocking=none`、evidence current/redacted 且 source integrity pass，`native_messaging` 才可进入 `satisfied_runtime_requirements`。
- `target_tab`、`runtime_bootstrap_ready`、`runtime_attested`、`live_evidence_attested` 不得由 bridge doctor 满足。
- `cloakbrowser.cloakserve` 默认 Native Messaging 不适用时，`native_messaging` 必须保留在 `unsatisfied_runtime_requirements`。
- `provider_doctor_passed` 仍按 FR-0038 聚合规则处理；本 FR 不重写 capability readiness schema。

## GWT 验收场景

### 场景 1：persistent variant 只在 WebEnvoy bridge evidence 齐备时 ready

Given selected provider is `cloakbrowser.persistent`
And handoff input refs contain WebEnvoy extension identity, Native Messaging host, manifest, allowed origins, registration, transport and handshake evidence
And each required evidence ref is current, redacted and non-stub
When provider doctor consumes the handoff
Then required `native_messaging` checks may pass
And requested capability may satisfy `native_messaging`
And the report still must not claim runtime attestation, target tab readiness or live evidence.

### 场景 2：CloakBrowser-owned Native Messaging claim 被阻断

Given handoff declares `doctor_owner=cloakbrowser_provider`
When bridge doctor validates ownership
Then `bridge_owner_attribution` must fail
And diagnostics code must map to `ownership_mismatch`
And provider/capability admission must fail closed.

### 场景 3：cloakserve 默认 Native Messaging 不适用

Given selected provider is `cloakbrowser.cloakserve`
And descriptor declares `native_messaging_support=none`
When capability matrix requests a capability requiring WebEnvoy Native Messaging bridge
Then handoff state must be `not_applicable_fail_closed`
And `native_messaging` must remain unsatisfied
And no later handshake artifact may override descriptor unsupported status without a formal FR revision.

### 场景 4：descriptor refs 不等于 bridge ready

Given `cloakbrowser.persistent` descriptor contains `native_messaging_ref`
And no WebEnvoy bridge doctor report exists
When downstream admission consumes the descriptor
Then Native Messaging must not pass
And `provider_doctor_report_ref` missing must block `bridge_doctor_ready`.

### 场景 5：stub/fake host evidence 失效

Given bridge handshake evidence comes from a stub host, fake host, historical artifact or provider-private bridge
When handoff validates source integrity
Then `bridge_handshake_preflight` must fail
And diagnostics code must map to `stub_or_fake_host_evidence` or `source_integrity_failed`.

### 场景 6：handshake pass 不等于 runtime/live pass

Given bridge handshake preflight passes
When runtime admission requests target tab or live evidence
Then bridge doctor may only support `doctor_checked`
And `target_tab`, `runtime_bootstrap_ready`, `runtime_attested` and `live_evidence_attested` must remain next gates.

## 异常与边界场景

- Required bridge doctor check missing: consumer must treat affected provider/capability as fail-closed.
- `status=not_applicable` on required Native Messaging: cannot satisfy required provider/capability admission.
- Descriptor unsupported: `cloakbrowser.cloakserve` and unprepared `cloakbrowser.direct` must not be promoted by ad hoc bridge evidence.
- Owner mismatch: any CloakBrowser-owned, provider-private or ambiguous Native Messaging owner claim blocks.
- Source mismatch: wrong extension origin, wrong provider id, wrong native host identity, wrong profile or wrong channel blocks.
- Stale evidence: historical artifact, same-head old artifact, stale pipe/socket or old ack cannot satisfy current doctor readiness.
- Stub/fake evidence: stub host, fake host or non-WebEnvoy source cannot satisfy CloakBrowser Native Messaging bridge doctor.
- Secret leak: raw manifest, bootstrap secret, token, Cookie, profile path, account id, provider credential or private patch payload invalidates evidence.
- Runtime boundary: transport availability and handshake preflight do not satisfy target tab binding, runtime bootstrap readiness, runtime attestation or live evidence.

## 验收标准

1. `FR-0057` formal suite exists at `docs/dev/specs/FR-0057-cloakbrowser-native-messaging-bridge-doctor/`.
2. `.github/spec-issue-sync-map.yml` maps `docs/dev/specs/FR-0057-cloakbrowser-native-messaging-bridge-doctor/spec.md` to #1154.
3. Suite clearly states Native Messaging bridge doctor is WebEnvoy-owned, not CloakBrowser-owned.
4. Suite consumes `FR-0038` and `FR-0046` semantics without defining a parallel health result schema.
5. Suite distinguishes `cloakbrowser.persistent` applicable inputs from `cloakbrowser.cloakserve` default unsupported and `cloakbrowser.direct` default not-applicable boundaries.
6. Suite freezes failure classes, stateful conclusions, handoff output and fail-closed semantics.
7. PR touches only FR-0057 suite and one sync-map entry, with no runtime/code/live/browser changes.
8. PR metadata uses `Refs #1154`, not auto-close wording.

## 依赖与前置条件

- GitHub issue:
  - `#1154 Native Messaging Bridge Doctor via WebEnvoy`
  - `#1114 CloakBrowser Provider`
- Upstream formal inputs:
  - `FR-0038-provider-health-doctor-contract`
  - `FR-0046-native-messaging-health`
  - `FR-0050-cloakbrowser-persistent-descriptor`
  - `FR-0051-cloakbrowser-cloakserve-descriptor`
- Downstream but not owned here:
  - `#1149 CloakBrowser Capability Matrix`
  - `#1152 CloakBrowser Limitation Gate`
  - Native Messaging doctor command / implementation owner
  - Runtime attestation, live evidence and closeout owners
