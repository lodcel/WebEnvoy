# CloakBrowser Native Messaging Bridge Doctor Handoff Contract

## 1. Object

```ts
interface CloakBrowserNativeMessagingBridgeDoctorHandoff {
  identity: BridgeDoctorHandoffIdentity
  input_refs: BridgeDoctorInputRefs
  applicability: BridgeDoctorApplicability
  required_checks: BridgeDoctorRequiredCheck[]
  stateful_conclusion: BridgeDoctorConclusion
  failure_classes: BridgeDoctorFailureClass[]
  provider_doctor_report_ref: string | "N/A"
  evidence_refs: BridgeDoctorEvidenceRef[]
  next_required_gates: BridgeDoctorNextGate[]
}
```

约束：

- 该对象是 handoff contract，不是 health result schema、runtime status、capability matrix row、limitation gate result 或 live evidence record。
- 后续 health implementation 必须把可消费结论映射到 `FR-0038.provider_doctor_report`，并使用 `category="native_messaging"`。
- `bridge_doctor_ready` 只能表示 doctor-layer readiness，不表示 runtime attestation、target tab readiness、page command success、account safety 或 live evidence。

## 2. Identity

```ts
interface BridgeDoctorHandoffIdentity {
  handoff_id: string
  handoff_contract_version: "v1"
  canonical_issue: 1154
  provider_id: "cloakbrowser.direct" | "cloakbrowser.persistent" | "cloakbrowser.cloakserve"
  variant_kind: "direct" | "persistent" | "cloakserve"
  doctor_owner: "webenvoy_native_messaging_bridge_doctor"
  provider_contract_ref: string
  created_at: string
}
```

约束：

- `provider_id` 与 `variant_kind` 必须一致。
- `doctor_owner` 不允许使用 `cloakbrowser_provider`、`provider_private_bridge` 或 display name。
- `provider_contract_ref` 必须指向 formal descriptor / provider contract ref，不得是 runtime artifact、profile name 或 broker credential。

## 3. Input refs

```ts
interface BridgeDoctorInputRefs {
  provider_descriptor_ref: string
  extension_identity_ref: string | "N/A"
  native_host_identity_ref: string | "N/A"
  native_host_manifest_ref: string | "N/A"
  allowed_origins_ref: string | "N/A"
  host_registration_ref: string | "N/A"
  bridge_transport_ref: string | "N/A"
  profile_binding_ref: string | "N/A"
  provider_broker_ref: string | "N/A"
  redaction_policy_ref: "FR-0041" | string
}
```

约束：

- refs 必须是 redacted locator、opaque handle、artifact id 或 report-local ref。
- refs 不得内联 manifest body、full local path、Cookie、token、license secret、profile path、account id、provider broker credential、raw handshake payload 或 private patch payload。
- `extension_identity_ref="N/A"`、`native_host_manifest_ref="N/A"`、`allowed_origins_ref="N/A"` 等命中 required Native Messaging 时必须 fail-closed。

## 4. Applicability

```ts
type BridgeDoctorApplicabilityState =
  | "applicable"
  | "not_applicable_fail_closed"
  | "unsupported_by_descriptor"
  | "input_incomplete"

interface BridgeDoctorApplicability {
  state: BridgeDoctorApplicabilityState
  reason: string
  descriptor_support: "required" | "none" | "unknown"
  can_enter_preflight: boolean
}
```

约束：

- `cloakbrowser.persistent` 可在 required inputs 齐备时进入 `applicable`。
- `cloakbrowser.cloakserve` 默认必须为 `unsupported_by_descriptor` 或 `not_applicable_fail_closed`。
- `cloakbrowser.direct` 默认必须为 `not_applicable_fail_closed`，除非后续 formal owner 提供 extension/native bridge refs。
- `can_enter_preflight=false` 时不得输出 `bridge_doctor_ready`。

## 5. Required checks

```ts
type BridgeDoctorCheckId =
  | "bridge_owner_attribution"
  | "descriptor_applicability"
  | "extension_identity_binding"
  | "native_host_identity"
  | "native_host_manifest"
  | "allowed_origins"
  | "host_registration"
  | "bridge_transport_availability"
  | "bridge_handshake_preflight"
  | "handoff_artifact_integrity"

interface BridgeDoctorRequiredCheck {
  check_id: BridgeDoctorCheckId
  provider_doctor_category: "native_messaging"
  capability_id: string | "N/A"
  required: boolean
  mapped_failure_classes: BridgeDoctorFailureClass[]
}
```

约束：

- Required check 必须映射到 `FR-0038.ProviderDoctorCheck`。
- Provider-level check 使用 `capability_id="N/A"`。
- Requested capability requiring `native_messaging` must consume these checks through `capability_readiness`.

## 6. Conclusion

```ts
type BridgeDoctorConclusion =
  | "bridge_doctor_ready"
  | "bridge_doctor_recoverable"
  | "bridge_doctor_blocked"
  | "bridge_doctor_unknown"
  | "not_applicable_fail_closed"
```

约束：

- `bridge_doctor_ready` requires all required checks pass with current, redacted, non-stub evidence.
- `bridge_doctor_recoverable` does not satisfy admission until a later same-scope ready conclusion is produced.
- `bridge_doctor_blocked|bridge_doctor_unknown|not_applicable_fail_closed` are fail-closed when Native Messaging is required.
- No conclusion may claim `runtime_attested` or `live_evidence_attested`.

## 7. Failure classes

```ts
type BridgeDoctorFailureClass =
  | "ownership_mismatch"
  | "descriptor_unsupported"
  | "descriptor_input_missing"
  | "extension_identity_missing"
  | "extension_origin_mismatch"
  | "native_host_identity_missing"
  | "native_manifest_missing"
  | "native_manifest_redaction_invalid"
  | "allowed_origins_missing"
  | "host_registration_missing"
  | "host_registration_mismatch"
  | "bridge_transport_unavailable"
  | "bridge_transport_stale"
  | "bridge_transport_contention"
  | "bridge_handshake_missing"
  | "bridge_handshake_mismatch"
  | "stub_or_fake_host_evidence"
  | "stale_or_historical_evidence"
  | "source_integrity_failed"
  | "secret_or_private_payload_leak"
  | "runtime_gate_required"
```

约束：

- Every failure class must map to machine-readable diagnostics code in `FR-0038.ProviderDoctorDiagnostics.code`.
- `runtime_gate_required` is a boundary marker, not a pass state.
- `secret_or_private_payload_leak` invalidates related evidence.

## 8. Evidence refs

```ts
type BridgeDoctorEvidenceKind =
  | "extension_state_ref"
  | "native_manifest_ref"
  | "command_output_ref"
  | "profile_state_ref"
  | "doctor_artifact_ref"
  | "provider_descriptor_ref"

type BridgeDoctorEvidenceStatus =
  | "available"
  | "partial"
  | "unavailable"
  | "not_applicable"

type BridgeDoctorEvidenceSensitivity =
  | "public"
  | "internal"
  | "sensitive"
  | "secret"

interface BridgeDoctorEvidenceRef {
  kind: BridgeDoctorEvidenceKind
  ref: string
  status: BridgeDoctorEvidenceStatus
  collected_at: string
  sensitivity: BridgeDoctorEvidenceSensitivity
}
```

约束：

- This shape remains compatible with `FR-0038` evidence refs.
- `sensitivity=secret` values may only appear as redacted locator or secret handle.
- Required check with only `partial|unavailable` evidence cannot pass.

## 9. Next gates

```ts
type BridgeDoctorNextGate =
  | "runtime_attestation"
  | "live_evidence"
  | "capability_matrix"
  | "limitation_gate"
  | "manual_review"
```

约束：

- `next_required_gates` lists remaining gates; it never asserts those gates have passed.
- Runtime and live gates remain required for target tab, page command success, account safety or latest-head live evidence claims.
