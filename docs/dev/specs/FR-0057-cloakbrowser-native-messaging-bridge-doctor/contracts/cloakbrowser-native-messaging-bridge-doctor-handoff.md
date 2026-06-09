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

## 1.1 Minimal valid example

以下示例是 redacted handoff JSON，用于说明最小合法 shape。它表达 `cloakbrowser.persistent` 已具备进入 WebEnvoy Native Messaging bridge doctor 的 current / redacted / non-stub preflight evidence；它不表达 runtime attestation、target tab readiness、page command success、account safety 或 live evidence。

```json
{
  "identity": {
    "handoff_id": "cb-nm-bridge-doctor-20260610-001",
    "handoff_contract_version": "v1",
    "canonical_issue": 1154,
    "provider_id": "cloakbrowser.persistent",
    "variant_kind": "persistent",
    "doctor_owner": "webenvoy_native_messaging_bridge_doctor",
    "provider_contract_ref": "docs/dev/specs/FR-0050-cloakbrowser-persistent-descriptor/spec.md",
    "created_at": "2026-06-10T00:00:00Z"
  },
  "input_refs": {
    "provider_descriptor_ref": "docs/dev/specs/FR-0050-cloakbrowser-persistent-descriptor/spec.md",
    "extension_identity_ref": "doctor-input://webenvoy-extension/redacted-identity",
    "native_host_identity_ref": "doctor-input://webenvoy-native-host/redacted-host-id",
    "native_host_manifest_ref": "doctor-input://webenvoy-native-host/redacted-manifest-locator",
    "allowed_origins_ref": "doctor-input://webenvoy-extension/redacted-allowed-origin",
    "host_registration_ref": "doctor-input://webenvoy-native-host/redacted-registration",
    "bridge_transport_ref": "doctor-input://webenvoy-native-host/redacted-transport",
    "profile_binding_ref": "doctor-input://cloakbrowser/redacted-profile-binding",
    "provider_broker_ref": "doctor-input://cloakbrowser/redacted-broker",
    "redaction_policy_ref": "FR-0041"
  },
  "applicability": {
    "state": "applicable",
    "reason": "cloakbrowser.persistent declares Native Messaging bridge inputs; WebEnvoy-owned bridge evidence refs are present.",
    "descriptor_support": "required",
    "can_enter_preflight": true
  },
  "required_checks": [
    {
      "check_id": "bridge_owner_attribution",
      "provider_doctor_category": "native_messaging",
      "capability_id": "N/A",
      "required": true,
      "mapped_failure_classes": ["ownership_mismatch"]
    },
    {
      "check_id": "descriptor_applicability",
      "provider_doctor_category": "native_messaging",
      "capability_id": "N/A",
      "required": true,
      "mapped_failure_classes": ["descriptor_unsupported", "descriptor_input_missing"]
    },
    {
      "check_id": "extension_identity_binding",
      "provider_doctor_category": "native_messaging",
      "capability_id": "N/A",
      "required": true,
      "mapped_failure_classes": ["extension_identity_missing", "extension_origin_mismatch"]
    },
    {
      "check_id": "native_host_manifest",
      "provider_doctor_category": "native_messaging",
      "capability_id": "N/A",
      "required": true,
      "mapped_failure_classes": ["native_manifest_missing", "native_manifest_redaction_invalid"]
    },
    {
      "check_id": "bridge_handshake_preflight",
      "provider_doctor_category": "native_messaging",
      "capability_id": "N/A",
      "required": true,
      "mapped_failure_classes": ["bridge_handshake_missing", "bridge_handshake_mismatch", "stub_or_fake_host_evidence"]
    }
  ],
  "stateful_conclusion": "bridge_doctor_ready",
  "failure_classes": [],
  "provider_doctor_report_ref": "doctor-artifact://cb-nm-bridge-doctor/report-redacted",
  "evidence_refs": [
    {
      "kind": "doctor_artifact_ref",
      "ref": "doctor-artifact://cb-nm-bridge-doctor/provider-descriptor-digest",
      "status": "available",
      "collected_at": "2026-06-10T00:00:00Z",
      "sensitivity": "internal"
    },
    {
      "kind": "extension_state_ref",
      "ref": "doctor-artifact://cb-nm-bridge-doctor/extension-identity-redacted",
      "status": "available",
      "collected_at": "2026-06-10T00:00:00Z",
      "sensitivity": "sensitive"
    },
    {
      "kind": "native_manifest_ref",
      "ref": "doctor-artifact://cb-nm-bridge-doctor/native-manifest-redacted",
      "status": "available",
      "collected_at": "2026-06-10T00:00:00Z",
      "sensitivity": "sensitive"
    },
    {
      "kind": "command_output_ref",
      "ref": "doctor-artifact://cb-nm-bridge-doctor/handshake-redacted",
      "status": "available",
      "collected_at": "2026-06-10T00:00:00Z",
      "sensitivity": "sensitive"
    }
  ],
  "next_required_gates": [
    "runtime_attestation",
    "live_evidence",
    "capability_matrix",
    "limitation_gate"
  ]
}
```

示例约束：

- `input_refs.provider_descriptor_ref` 是输入 locator；它不是 `evidence_refs[*].kind`。
- 如果后续需要把 descriptor material 作为 evidence 引用，必须转换为 FR-0038-compatible `doctor_artifact_ref` 或 `local_file_ref`，例如引用 descriptor digest、redacted artifact id 或 repo-local formal spec locator。
- 示例中的 `bridge_doctor_ready` 只说明 Native Messaging doctor-layer preflight ready；后续 runtime / live gates 仍保留在 `next_required_gates`。

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
  | "local_file_ref"
  | "extension_state_ref"
  | "native_manifest_ref"
  | "command_output_ref"
  | "profile_state_ref"
  | "doctor_artifact_ref"

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
- `BridgeDoctorEvidenceKind` 必须保持在 `FR-0038.ProviderDoctorEvidenceKind` 的闭集内；不得新增 handoff-only evidence kind。
- `provider_descriptor_ref` 只允许出现在 `input_refs.provider_descriptor_ref`。如 descriptor material 需要进入 `evidence_refs`，必须转换为 `doctor_artifact_ref` 或 `local_file_ref`，并以 digest、redacted artifact locator 或 repo-local formal spec locator 表达。
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
