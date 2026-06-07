# FR-0046 Contract: Native Messaging Health Mapping

Canonical Issue: #1141

## Contract boundary

This contract defines how official Chrome Native Messaging readiness maps into `FR-0038.provider_doctor_report`.

It does not define a new health result schema, Native Messaging message envelope, bridge protocol, runtime status row, launch evidence record, fixture schema, or live evidence record.

## Required FR-0038 mapping

Every scoped check is represented as:

```ts
interface NativeMessagingHealthCheckMapping {
  owner: "FR-0046-native-messaging-health"
  provider_id: "official-chrome.persistent"
  doctor_category: "native_messaging"
  check_id:
    | "native_host_identity"
    | "native_host_manifest"
    | "allowed_origins"
    | "host_registration"
    | "socket_availability"
    | "bridge_handshake"
  capability_id: string | "N/A"
  status: ProviderDoctorCheckStatus
  severity: ProviderDoctorSeverity
  blocking: ProviderDoctorBlocking
  diagnostics: ProviderDoctorDiagnostics
  evidence_refs: ProviderDoctorEvidenceRef[]
}
```

Constraints:

- `status`, `severity`, `blocking`, `diagnostics` and `evidence_refs` are exactly the FR-0038 fields.
- Provider-level checks use `capability_id="N/A"`.
- Capability-level consumption happens through FR-0038 `capability_readiness`; this contract does not add a capability health object.
- Unknown enum, missing required check, required evidence unavailable, secret leak or redaction invalid must fail closed.

## Required check ids

| Check id | Required input | Required conclusion |
|---|---|---|
| `native_host_identity` | `FR-0043.native_host_identity_ref` | Host identity belongs to `official-chrome.persistent` and is not expressed with secret/private raw values. |
| `native_host_manifest` | `FR-0043.native_host_manifest_ref` | Manifest locator is present, redacted and resolvable for doctor scope. |
| `allowed_origins` | `FR-0043.allowed_origins_ref` | Allowed origin ref is present, redacted and compatible with the extension identity owner. |
| `host_registration` | `FR-0043.host_registration_ref` | Host registration can be discovered by official Google Chrome stable. |
| `socket_availability` | `FR-0043.bridge_readiness_ref` or runtime preflight evidence | Local transport is available for Native Messaging preflight without leaking locator secrets. |
| `bridge_handshake` | `FR-0043.bridge_readiness_ref` or runtime preflight evidence | Extension-to-native-host bridge handshake matches selected provider and non-stub source. |

## Diagnostics code enum

This FR freezes the minimum Native Messaging diagnostic code namespace:

```ts
type NativeMessagingHealthDiagnosticCode =
  | "native_messaging.host_identity_missing"
  | "native_messaging.host_identity_mismatch"
  | "native_messaging.manifest_ref_missing"
  | "native_messaging.manifest_ref_invalid"
  | "native_messaging.allowed_origins_missing"
  | "native_messaging.allowed_origins_mismatch"
  | "native_messaging.registration_missing"
  | "native_messaging.registration_channel_mismatch"
  | "native_messaging.socket_unavailable"
  | "native_messaging.socket_stale_or_disconnected"
  | "native_messaging.bridge_handshake_missing"
  | "native_messaging.bridge_handshake_mismatch"
  | "native_messaging.stub_or_fake_host_evidence"
  | "native_messaging.evidence_redaction_invalid"
  | "native_messaging.required_evidence_unavailable";
```

Constraints:

- Diagnostic codes are stable machine-readable strings.
- Human summaries may describe the failure, but parsers must consume `diagnostics.code`.
- Observed/expected/remediation fields must not contain raw private paths, profile locators, manifest body, cookies, tokens or bootstrap secrets.

## Evidence ref contract

Native Messaging checks consume FR-0038 evidence refs and may point to FR-0040 evidence records.

Allowed evidence kinds from FR-0038:

- `native_manifest_ref`
- `extension_state_ref`
- `command_output_ref`
- `doctor_artifact_ref`
- `local_file_ref`

FR-0040 alignment:

- `provider_evidence_record.native_messaging_status.native_host_name`
- `provider_evidence_record.native_messaging_status.native_host_manifest_ref`
- `provider_evidence_record.native_messaging_status.allowed_origin_ref`
- `provider_evidence_record.native_messaging_status.native_messaging_runtime_status`
- `provider_evidence_record.native_messaging_status.native_messaging_evidence_refs`
- top-level `provider_evidence_record.evidence_refs[*]`

FR-0041 redaction requirements:

- Native host manifest locator, allowed origin source, socket locator, command output excerpt and bridge artifact are at least `sensitive`.
- Bootstrap secret, extension private payload, provider private patch secret, token, Cookie, auth header, profile path or account id are `secret` when raw or replayable.
- Required evidence with `redaction_required`, `policy_missing`, `invalid`, raw private path or raw secret must make the related FR-0038 check non-pass.

## Outcome consumption

When any required Native Messaging provider-level check fails or is unknown:

- `ProviderDoctorOutcome.overall_status` must be `fail` or `unknown`.
- `provider_blocked` must be true when the selected provider requires Native Messaging.
- Requested capabilities requiring `native_messaging` must appear in `blocked_capabilities` or keep `native_messaging` in `unsatisfied_runtime_requirements`.

When all required checks pass:

- The highest doctor layer remains `doctor_checked`.
- Runtime attestation, target tab binding and live evidence remain future gates.
