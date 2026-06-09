# CloakBrowser Persistent Profile Health Contract

## Contract version

- `cloakbrowser_persistent_profile_health.version = v1`

## Schema

```yaml
cloakbrowser_persistent_profile_health:
  identity:
    persistent_profile_health_id: string
    health_contract_version: "v1"
    provider_id: "cloakbrowser.persistent"
    variant_kind: "persistent"
    provider_descriptor_ref: string
    doctor_report_ref: string
    run_id: string
    generated_at: rfc3339-utc
    artifact_identity: string
  profile_binding:
    profile_binding_ref: string
    selected_profile_identity_ref: string
    profile_locator_ref: string
    provider_workspace_ref: string
    identity_match_status: "match" | "mismatch" | "unknown"
    locator_resolution_status: "resolved" | "unresolved" | "not_accessible" | "unknown"
    binding_evidence_status: "available" | "partial" | "unavailable" | "invalid_redaction"
    profile_binding_blocking: "none" | "capability_blocking" | "provider_blocking"
    freshness: HealthSignalFreshness
    evidence_refs:
      - PersistentHealthEvidenceRef
  profile_state:
    profile_persistence_status: "persistent" | "ephemeral" | "missing" | "unknown"
    profile_lock_status: "locked_by_current_run" | "locked_by_other" | "stale_lock" | "unlocked" | "unknown"
    concurrent_use_status: "clear" | "suspected" | "detected" | "unknown"
    cleanup_expectation_observed: "preserve_profile_state" | "cleanup_requested" | "unknown"
    freshness: HealthSignalFreshness
    evidence_refs:
      - PersistentHealthEvidenceRef
  extension_surface:
    extension_binding_ref: string
    extension_identity_ref: string
    extension_installation_status: "installed" | "missing" | "ambiguous" | "unknown"
    extension_load_status: "loaded" | "not_loaded" | "load_error" | "unknown"
    extension_runtime_surface_status: "surface_visible" | "surface_missing" | "surface_stale" | "unknown"
    extension_profile_binding_status: "bound_to_selected_profile" | "bound_to_other_profile" | "unbound" | "unknown"
    service_worker_freshness_ref: string | "N/A"
    freshness: HealthSignalFreshness
    evidence_refs:
      - PersistentHealthEvidenceRef
  native_messaging_surface:
    native_messaging_ref: string
    host_manifest_ref: string
    allowed_origin_ref: string
    extension_id_ref: string
    native_host_locator_status: "resolved" | "missing" | "not_accessible" | "unknown"
    allowed_origin_status: "matches_extension" | "mismatch" | "missing" | "unknown"
    transport_surface_status: "surface_available" | "surface_missing" | "surface_error" | "unknown"
    freshness: HealthSignalFreshness
    evidence_refs:
      - PersistentHealthEvidenceRef
  outcome:
    overall_status: "pass" | "warn" | "fail" | "unknown"
    provider_blocked: boolean
    blocked_capabilities:
      - string
    health_verification_level: "declared_only" | "doctor_checked" | "health_checked"
    health_passed_requirements:
      - string
    health_failed_requirements:
      - string
    next_required_gates:
      - "runtime_attestation"
      - "target_tab_binding"
      - "capability_matrix"
      - "live_evidence"
      - "manual_review"
    does_not_prove:
      - "runtime_ready"
      - "runtime_bootstrap_success"
      - "target_tab_ready"
      - "extension_command_success"
      - "native_messaging_round_trip_success"
      - "capability_allowed"
      - "account_safety_pass"
      - "anti_detection_pass"
      - "live_evidence_attested"
```

```yaml
HealthSignalFreshness:
  collected_at: rfc3339-utc
  freshness_scope: "current_health_run" | "current_runtime_admission" | "historical_background" | "unknown"
  freshness_status: "fresh" | "stale" | "not_collected" | "unknown"
  max_age_policy_ref: string
  staleness_reason: string | "N/A"

PersistentHealthEvidenceRef:
  kind: "profile_state_ref" | "profile_lock_ref" | "extension_state_ref" | "native_manifest_ref" | "provider_broker_ref" | "health_artifact_ref"
  ref: string
  status: "available" | "partial" | "unavailable" | "not_applicable" | "invalid_redaction"
  collected_at: rfc3339-utc
  sensitivity: "public" | "internal" | "sensitive" | "secret"
```

## Normative rules

1. `provider_id` must be `cloakbrowser.persistent`, and `variant_kind` must be `persistent`.
2. `provider_descriptor_ref` must point to `FR-0050` or a later accepted persistent descriptor artifact.
3. `doctor_report_ref` must point to `FR-0038.provider_doctor_report`; this contract does not define a second doctor report.
4. Every required signal must include freshness and at least one evidence ref unless explicitly `not_applicable`.
5. Required signals must fail closed when freshness is stale, unknown, historical, not collected, or redaction invalid.
6. Required profile binding fails closed on identity mismatch, unresolved locator, inaccessible locator, unavailable evidence, or invalid redaction.
7. Required profile state fails closed on missing or ephemeral persistence, lock owned by another run, stale lock, detected concurrent use, or unknown lock/concurrency state.
8. Required extension surface fails closed when the extension is missing, ambiguous, not loaded, load-error, stale, missing runtime surface, or bound to a profile other than the selected profile.
9. Required Native Messaging surface fails closed when manifest or host locator is missing/inaccessible, allowed origin mismatches, or transport surface is missing/error.
10. `health_verification_level` must never exceed `health_checked`.
11. `does_not_prove` is mandatory and must include every v1 enum listed above.
12. Health pass cannot satisfy runtime attestation, target tab binding, command success, Native Messaging round-trip success, capability allow, account safety, anti-detection pass, or live evidence attestation.

## Minimal valid example

```yaml
identity:
  persistent_profile_health_id: "persistent-health-run-123"
  health_contract_version: "v1"
  provider_id: "cloakbrowser.persistent"
  variant_kind: "persistent"
  provider_descriptor_ref: "FR-0050.cloakbrowser_persistent_descriptor.v1"
  doctor_report_ref: "doctor-artifact:run-123"
  run_id: "run-123"
  generated_at: "2026-06-09T00:00:00Z"
  artifact_identity: "artifact:persistent-health:run-123"
profile_binding:
  profile_binding_ref: "descriptor:profile-binding:selected"
  selected_profile_identity_ref: "opaque:selected-profile"
  profile_locator_ref: "redacted:profile-locator"
  provider_workspace_ref: "opaque:workspace"
  identity_match_status: "match"
  locator_resolution_status: "resolved"
  binding_evidence_status: "available"
  profile_binding_blocking: "none"
  freshness:
    collected_at: "2026-06-09T00:00:00Z"
    freshness_scope: "current_health_run"
    freshness_status: "fresh"
    max_age_policy_ref: "policy:persistent-health:max-age:v1"
    staleness_reason: "N/A"
  evidence_refs:
    - kind: "profile_state_ref"
      ref: "artifact:profile-state:run-123"
      status: "available"
      collected_at: "2026-06-09T00:00:00Z"
      sensitivity: "sensitive"
outcome:
  overall_status: "pass"
  provider_blocked: false
  blocked_capabilities: []
  health_verification_level: "health_checked"
  health_passed_requirements:
    - "profile_binding"
  health_failed_requirements: []
  next_required_gates:
    - "runtime_attestation"
    - "target_tab_binding"
    - "capability_matrix"
    - "live_evidence"
  does_not_prove:
    - "runtime_ready"
    - "runtime_bootstrap_success"
    - "target_tab_ready"
    - "extension_command_success"
    - "native_messaging_round_trip_success"
    - "capability_allowed"
    - "account_safety_pass"
    - "anti_detection_pass"
    - "live_evidence_attested"
```

## Invalid examples

```yaml
outcome:
  health_verification_level: "live_evidence_attested"
```

```yaml
profile_binding:
  profile_locator_ref: "/Users/example/Library/Application Support/CloakBrowser/Profile 1"
```

```yaml
native_messaging_surface:
  transport_surface_status: "surface_available"
outcome:
  health_passed_requirements:
    - "runtime_bootstrap_success"
```
