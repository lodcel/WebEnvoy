# Extension / Native Bridge Gate Contract

## Contract owner

- Owner: `#1177` / `FR-0067`
- Contract id: `extension-native-bridge-gate.v1`
- Scope: extension smoke, Native Messaging bridge readiness, evidence refs, freshness, scope matching and fail-closed evaluation before live-write `write_prepare` or `live_write_commit` admission

This contract only defines the extension/native bridge lane. It does not define runtime implementation, browser interaction, provider selection, account safety, operator unlock storage, default lock release, live evidence record shape, publish behavior, cleanup behavior or release closeout.

## Gate scope

```ts
interface ExtensionNativeBridgeScopeV1 {
  schema_version: "extension-native-bridge-gate.v1";
  capability_level: "write_admit" | "write_prepare" | "live_write_commit";
  workflow_ref: string;
  target_domain: string;
  target_page: string;
  provider_id: string;
  provider_contract_version: string;
  profile_ref: string;
  browser_channel: string;
  execution_surface: "real_browser";
  extension_identity_ref: string;
  native_host_identity_ref: string;
  provider_doctor_report_ref: string;
  extension_smoke_ref: string | null;
  native_bridge_readiness_ref: string | null;
  head_sha: string;
  run_id: string | null;
  evaluation_context_ref: string;
}
```

Rules:

- `write_prepare` and `live_write_commit` require a scoped bridge result with `state=ready`.
- `write_admit` may request classification, but a classification result cannot be promoted into preparation or commit unless it is current, exact-scope and ready.
- `execution_surface=real_browser` is required for real evaluations, but it is not readiness proof by itself.
- `run_id` may be null only for non-runtime formal planning samples; real evaluations must provide a current `run_id` or a machine-checkable `evaluation_context_ref`.

## Gate state

```ts
type ExtensionNativeBridgeStateV1 =
  | "ready"
  | "unknown"
  | "blocked"
  | "stale"
  | "redaction_invalid"
  | "requires_recovery";
```

Rules:

- Only `ready` can support `decision=allow`.
- `unknown`, `blocked`, `stale`, `redaction_invalid` and `requires_recovery` must block `write_prepare` and `live_write_commit`.
- Unknown enum values must fail closed with `extension_native_bridge_state_missing` or a more specific blocker.
- `requires_recovery` can become `ready` only after fresh same-run recovery evidence replaces stale or disconnected evidence.

## Evidence refs

```ts
interface ExtensionNativeBridgeEvidenceRefV1 {
  kind:
    | "provider_doctor_report_ref"
    | "extension_identity_health_ref"
    | "service_worker_freshness_ref"
    | "native_messaging_health_ref"
    | "extension_smoke_ref"
    | "native_bridge_handshake_ref"
    | "profile_ref"
    | "redaction_policy_ref"
    | "freshness_ref"
    | "risk_disposition_ref"
    | "operator_unlock_ref"
    | "default_commit_lock_ref"
    | "provider_requirement_ref"
    | "account_safety_ref"
    | "runtime_target_binding_ref"
    | "live_evidence_gate_ref";
  ref: string;
  source_owner: string;
  collected_at: string | "N/A";
  head_sha: string | "N/A";
  run_id: string | "N/A";
  freshness_scope:
    | "current_health_run"
    | "current_runtime_admission"
    | "current_pr_head"
    | "historical_background"
    | "not_applicable";
  redaction_state:
    | "redacted"
    | "redaction_required"
    | "not_required"
    | "policy_missing"
    | "invalid";
}

interface ExtensionNativeBridgeEvidenceRefsV1 {
  provider_doctor_report_ref: ExtensionNativeBridgeEvidenceRefV1;
  extension_identity_health_ref: ExtensionNativeBridgeEvidenceRefV1;
  service_worker_freshness_ref: ExtensionNativeBridgeEvidenceRefV1;
  native_messaging_health_ref: ExtensionNativeBridgeEvidenceRefV1;
  extension_smoke_ref: ExtensionNativeBridgeEvidenceRefV1;
  native_bridge_handshake_ref: ExtensionNativeBridgeEvidenceRefV1;
  profile_ref: ExtensionNativeBridgeEvidenceRefV1;
  redaction_policy_ref: ExtensionNativeBridgeEvidenceRefV1;
  freshness_ref: ExtensionNativeBridgeEvidenceRefV1;
  risk_disposition_ref: ExtensionNativeBridgeEvidenceRefV1;
  operator_unlock_ref?: ExtensionNativeBridgeEvidenceRefV1;
  default_commit_lock_ref?: ExtensionNativeBridgeEvidenceRefV1;
  provider_requirement_ref?: ExtensionNativeBridgeEvidenceRefV1;
  account_safety_ref?: ExtensionNativeBridgeEvidenceRefV1;
  runtime_target_binding_ref?: ExtensionNativeBridgeEvidenceRefV1;
  live_evidence_gate_ref?: ExtensionNativeBridgeEvidenceRefV1;
}
```

Rules:

- Refs are locators only. They must not inline secrets, account identifiers, cookies, tokens, private profile paths, browser paths, raw manifests, socket paths, extension source, private payload, page content or live artifact payloads.
- Refs must follow `FR-0041` redaction semantics and live-write evidence redaction expectations.
- Refs must bind `source_owner`, `collected_at`, `head_sha`, `run_id`, `freshness_scope` and `redaction_state` so downstream gates can reject stale, unowned or under-redacted evidence.
- Required refs with `redaction_required`, `policy_missing`, `invalid`, stale freshness, partial availability or scope mismatch cannot satisfy `ready`.
- Optional downstream refs are references only; this gate does not create operator unlock, account safety, default lock, provider requirement, runtime target binding or live evidence results.

## Gate state record

```ts
interface ExtensionNativeBridgeStateRecordV1 {
  schema_version: "extension-native-bridge-gate.v1";
  bridge_state_id: string;
  canonical_issue_ref: "#1177";
  scope: ExtensionNativeBridgeScopeV1;
  state: ExtensionNativeBridgeStateV1;
  evidence_refs: ExtensionNativeBridgeEvidenceRefsV1;
  checked_at: string;
  expires_at: string;
  redaction_state:
    | "redacted"
    | "redaction_required"
    | "not_required"
    | "policy_missing"
    | "invalid";
  extension_smoke_status: "pass" | "warn" | "fail" | "unknown";
  native_bridge_status: "pass" | "warn" | "fail" | "unknown";
}
```

Rules:

- `checked_at` and `expires_at` are required for real evaluations.
- `expires_at` must be later than evaluation time.
- `redaction_state=redaction_required|policy_missing|invalid` blocks `ready`.
- `extension_smoke_status=pass` and `native_bridge_status=pass` are both required for `state=ready`.
- Historical records are background only unless freshness and scope are current.

## Evaluation input

```ts
interface ExtensionNativeBridgeGateInputV1 {
  schema_version: "extension-native-bridge-gate.v1";
  requested_capability_level: "write_prepare" | "live_write_commit";
  requested_scope: ExtensionNativeBridgeScopeV1;
  bridge_state_record: ExtensionNativeBridgeStateRecordV1 | null;
  evaluated_at: string;
}
```

Rules:

- Missing `bridge_state_record` returns `gate_status=unknown`, `decision=deny`.
- Any requested scope mismatch returns `gate_status=blocked`, `decision=deny`.
- Stale `checked_at` / `expires_at` returns `gate_status=stale`, `decision=deny`.

## Evaluation result

```ts
interface ExtensionNativeBridgeGateResultV1 {
  schema_version: "extension-native-bridge-gate.v1";
  gate_status:
    | "not_applicable"
    | "ready"
    | "unknown"
    | "blocked"
    | "stale"
    | "redaction_invalid"
    | "requires_recovery";
  decision: "allow" | "deny" | "defer";
  blocking_reasons: ExtensionNativeBridgeBlockingReasonV1[];
  extension_native_bridge_ref: string | null;
  evidence_refs_consumed: string[];
  evaluated_at: string;
  downstream_owner:
    | "#1179"
    | "#1180"
    | "#1211"
    | "runtime_owner"
    | "operator_owner"
    | "live_evidence_owner"
    | "none";
}
```

Rules:

- `decision=allow` is valid only when `gate_status=ready` and `blocking_reasons=[]`.
- `decision=allow` clears only the extension/native bridge lane. It does not release default lock, accept operator unlock, prove provider requirement, prove account safety, prove target binding, accept anti-detection gate or accept live evidence.
- If `blocking_reasons` is non-empty, `decision` must be `deny` or `defer`.
- Real evaluations must use concrete `evaluated_at`. Formal spec examples may use `N/A` only outside real gate outputs.

## Blocking reasons

```ts
type ExtensionNativeBridgeBlockingReasonV1 =
  | "extension_native_bridge_state_missing"
  | "extension_smoke_missing"
  | "extension_smoke_unknown"
  | "extension_smoke_stale"
  | "extension_identity_health_missing"
  | "extension_identity_not_ready"
  | "service_worker_freshness_missing"
  | "service_worker_not_fresh"
  | "native_messaging_health_missing"
  | "native_bridge_handshake_missing"
  | "native_bridge_not_ready"
  | "native_bridge_recovery_required"
  | "native_bridge_recovery_failed"
  | "provider_doctor_report_missing"
  | "provider_doctor_report_not_checked"
  | "scope_mismatch"
  | "head_mismatch"
  | "run_mismatch"
  | "profile_mismatch"
  | "provider_mismatch"
  | "extension_identity_mismatch"
  | "native_host_identity_mismatch"
  | "evidence_missing"
  | "evidence_stale"
  | "evidence_redaction_invalid"
  | "stub_or_fake_host_evidence"
  | "control_plane_only_signal"
  | "historical_or_stale_evidence"
  | "downstream_owner_required";
```

Rules:

- `stub_or_fake_host_evidence`, `control_plane_only_signal` and `historical_or_stale_evidence` cannot satisfy `live_write_commit`.
- `evidence_redaction_invalid` blocks both `write_prepare` and `live_write_commit`.
- `provider_doctor_report_not_checked` means doctor layer is missing or not at the required checked level; even a valid doctor report does not prove runtime/live readiness by itself.

## Minimum consumable examples

These examples are redacted contract examples for implementation and test calibration. They are not live evidence, do not identify a real account or profile, and do not allow `live_write_commit`.

### Ready state example

```json
{
  "schema_version": "extension-native-bridge-gate.v1",
  "bridge_state_id": "extension-native-bridge-redacted-20260611-001",
  "canonical_issue_ref": "#1177",
  "scope": {
    "schema_version": "extension-native-bridge-gate.v1",
    "capability_level": "write_prepare",
    "workflow_ref": "xhs.creator_publish.prepare",
    "target_domain": "creator.xiaohongshu.com",
    "target_page": "creator_publish_tab",
    "provider_id": "official-chrome.persistent",
    "provider_contract_version": "v1",
    "profile_ref": "profile:redacted-extension-native-bridge-demo",
    "browser_channel": "Google Chrome stable",
    "execution_surface": "real_browser",
    "extension_identity_ref": "extension:redacted-stable-id",
    "native_host_identity_ref": "native-host:redacted-webenvoy",
    "provider_doctor_report_ref": "artifact-redacted/provider-doctor-report",
    "extension_smoke_ref": "artifact-redacted/extension-smoke",
    "native_bridge_readiness_ref": "artifact-redacted/native-bridge-readiness",
    "head_sha": "9eab6ed18ff524855a258e9dbe448dfa51110e64",
    "run_id": "run-redacted-bridge-ready",
    "evaluation_context_ref": "artifact-redacted/bridge/context"
  },
  "state": "ready",
  "evidence_refs": {
    "provider_doctor_report_ref": {
      "kind": "provider_doctor_report_ref",
      "ref": "artifact-redacted/provider-doctor-report",
      "source_owner": "FR-0038",
      "collected_at": "2026-06-11T00:00:00Z",
      "head_sha": "9eab6ed18ff524855a258e9dbe448dfa51110e64",
      "run_id": "run-redacted-bridge-ready",
      "freshness_scope": "current_health_run",
      "redaction_state": "redacted"
    },
    "extension_identity_health_ref": {
      "kind": "extension_identity_health_ref",
      "ref": "artifact-redacted/extension-identity-health",
      "source_owner": "FR-0045",
      "collected_at": "2026-06-11T00:00:00Z",
      "head_sha": "9eab6ed18ff524855a258e9dbe448dfa51110e64",
      "run_id": "run-redacted-bridge-ready",
      "freshness_scope": "current_health_run",
      "redaction_state": "redacted"
    },
    "service_worker_freshness_ref": {
      "kind": "service_worker_freshness_ref",
      "ref": "artifact-redacted/service-worker-freshness",
      "source_owner": "FR-0047",
      "collected_at": "2026-06-11T00:00:00Z",
      "head_sha": "9eab6ed18ff524855a258e9dbe448dfa51110e64",
      "run_id": "run-redacted-bridge-ready",
      "freshness_scope": "current_health_run",
      "redaction_state": "redacted"
    },
    "native_messaging_health_ref": {
      "kind": "native_messaging_health_ref",
      "ref": "artifact-redacted/native-messaging-health",
      "source_owner": "FR-0046",
      "collected_at": "2026-06-11T00:00:00Z",
      "head_sha": "9eab6ed18ff524855a258e9dbe448dfa51110e64",
      "run_id": "run-redacted-bridge-ready",
      "freshness_scope": "current_health_run",
      "redaction_state": "redacted"
    },
    "extension_smoke_ref": {
      "kind": "extension_smoke_ref",
      "ref": "artifact-redacted/extension-smoke",
      "source_owner": "FR-0067",
      "collected_at": "2026-06-11T00:00:00Z",
      "head_sha": "9eab6ed18ff524855a258e9dbe448dfa51110e64",
      "run_id": "run-redacted-bridge-ready",
      "freshness_scope": "current_runtime_admission",
      "redaction_state": "redacted"
    },
    "native_bridge_handshake_ref": {
      "kind": "native_bridge_handshake_ref",
      "ref": "artifact-redacted/native-bridge-handshake",
      "source_owner": "FR-0067",
      "collected_at": "2026-06-11T00:00:00Z",
      "head_sha": "9eab6ed18ff524855a258e9dbe448dfa51110e64",
      "run_id": "run-redacted-bridge-ready",
      "freshness_scope": "current_runtime_admission",
      "redaction_state": "redacted"
    },
    "profile_ref": {
      "kind": "profile_ref",
      "ref": "profile:redacted-extension-native-bridge-demo",
      "source_owner": "FR-0067",
      "collected_at": "2026-06-11T00:00:00Z",
      "head_sha": "9eab6ed18ff524855a258e9dbe448dfa51110e64",
      "run_id": "run-redacted-bridge-ready",
      "freshness_scope": "current_runtime_admission",
      "redaction_state": "redacted"
    },
    "redaction_policy_ref": {
      "kind": "redaction_policy_ref",
      "ref": "FR-0041",
      "source_owner": "FR-0041",
      "collected_at": "N/A",
      "head_sha": "N/A",
      "run_id": "N/A",
      "freshness_scope": "not_applicable",
      "redaction_state": "not_required"
    },
    "freshness_ref": {
      "kind": "freshness_ref",
      "ref": "artifact-redacted/bridge/freshness",
      "source_owner": "FR-0067",
      "collected_at": "2026-06-11T00:00:00Z",
      "head_sha": "9eab6ed18ff524855a258e9dbe448dfa51110e64",
      "run_id": "run-redacted-bridge-ready",
      "freshness_scope": "current_runtime_admission",
      "redaction_state": "redacted"
    },
    "risk_disposition_ref": {
      "kind": "risk_disposition_ref",
      "ref": "artifact-redacted/bridge/risk-disposition",
      "source_owner": "FR-0067",
      "collected_at": "2026-06-11T00:00:00Z",
      "head_sha": "9eab6ed18ff524855a258e9dbe448dfa51110e64",
      "run_id": "run-redacted-bridge-ready",
      "freshness_scope": "current_runtime_admission",
      "redaction_state": "redacted"
    }
  },
  "checked_at": "2026-06-11T00:00:00Z",
  "expires_at": "2026-06-11T01:00:00Z",
  "redaction_state": "redacted",
  "extension_smoke_status": "pass",
  "native_bridge_status": "pass"
}
```

### Stub/fake host blocked example

```json
{
  "schema_version": "extension-native-bridge-gate.v1",
  "gate_status": "blocked",
  "decision": "deny",
  "blocking_reasons": [
    "stub_or_fake_host_evidence"
  ],
  "extension_native_bridge_ref": null,
  "evidence_refs_consumed": [
    "artifact-redacted/native-bridge-handshake-stub-source"
  ],
  "evaluated_at": "2026-06-11T00:10:00Z",
  "downstream_owner": "runtime_owner"
}
```
