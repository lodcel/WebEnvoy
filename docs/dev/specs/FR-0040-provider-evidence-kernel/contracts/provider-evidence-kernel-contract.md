# Provider Evidence Kernel Contract v1

## Contract name

- `provider_evidence_record.v1`
- Canonical suite: `FR-0040-provider-evidence-kernel`
- Canonical issue: `#1128`

## Required top-level shape

```yaml
provider_evidence_record:
  identity:
    provider_evidence_record_id: string
    provider_evidence_contract_version: v1
    run_id: string
    command_ref: string
    created_at: iso8601
    evidence_scope: selection | launch_admission | runtime_admission | capability_closeout | diagnostic
    base_refs:
      - FR-0033.browser_provider_contract.v1
      - FR-0037.launch_envelope.v1
  selected_provider:
    provider_id: string
    provider_contract_ref: string
    provider_contract_version: string
    provider_mode: core_managed | external_managed | adapter_only | diagnostic_only
    provider_class_ref: string | null
    selection_reason: default_eligible | explicit_request | diagnostic_only | fallback_candidate | blocked_candidate
    selection_source: provider_registry | launch_envelope | manual_override | diagnostic_input
    selection_evidence_refs: [provider_evidence_ref_id]
  version_evidence:
    provider_version: string
    browser_channel: string | unknown
    browser_version: string | unknown
    extension_version: string | unknown | not_applicable
    native_host_version: string | unknown | not_applicable
    contract_version: string
    version_evidence_refs: [provider_evidence_ref_id]
  launch_arguments:
    launch_envelope_ref: string
    launch_envelope_version: v1
    provider_launch_ref: string
    browser_mode:
      headed: boolean
      headless: boolean
      real_browser_required: boolean
      browser_channel: string | unknown
    runtime_bindings:
      extension_binding_mode: persistent_profile_extension | dev_unpacked_extension | not_required | unknown
      native_messaging_mode: required | supported | not_required | unknown
      runtime_bootstrap_required: boolean
    network_regional_ref: string | null
    fingerprint_policy_ref: string | null
    launch_argument_evidence_refs: [provider_evidence_ref_id]
  profile_reference:
    profile_ref: string
    profile_binding_mode: required_existing | allow_create_for_login | not_required
    profile_lock_status: locked_by_current_run | shared_read_only | unlocked | stale_or_disconnected | blocked | unknown
    login_state_evidence: ready | login_allowed | not_required | blocked | unknown
    profile_persistence_status: persistent | ephemeral | blocked | unknown
    profile_evidence_refs: [provider_evidence_ref_id]
  extension_status:
    extension_required: boolean
    extension_binding_mode: persistent_profile_extension | dev_unpacked_extension | not_required | unknown
    extension_id: string | null
    extension_version: string | unknown | not_applicable
    extension_installation_status: installed_in_profile | dev_unpacked | missing | mismatch | unknown
    extension_runtime_status: ready | disconnected | recoverable | blocked | unknown
    extension_evidence_refs: [provider_evidence_ref_id]
  native_messaging_status:
    native_messaging_required: boolean
    native_host_name: string | null
    native_host_manifest_ref: string | null
    allowed_origin_ref: string | null
    native_host_version: string | unknown | not_applicable
    native_messaging_runtime_status: ready | disconnected | recoverable | blocked | unknown
    native_messaging_evidence_refs: [provider_evidence_ref_id]
  evidence_refs:
    - evidence_ref_id: string
      kind: provider_contract_ref | registry_entry_ref | launch_envelope_ref | launch_config_snapshot | profile_binding_ref | extension_binding_ref | native_messaging_binding_ref | runtime_bootstrap_ref | browser_channel_attestation | version_attestation | provider_health_ref | runtime_observation_ref | live_evidence_ref | closeout_artifact_ref
      ref: string
      source: provider_contract | provider_registry | launch_envelope | provider_doctor | runtime_admission | runtime_observation | live_evidence_gate | manual_review
      status: available | partial | unavailable | not_applicable
      collected_at: iso8601 | null
      freshness: current_record | current_launch | current_pr_head | historical_background | not_applicable
      sensitivity: public | internal | sensitive | secret
      redaction_state: redacted | redaction_required | not_required | policy_missing | invalid
      artifact_identity: string | null
  closeout_plan:
    required_evidence_kinds: [string]
    required_freshness: current_record | current_launch | current_pr_head | not_applicable
    minimum_attestation_level: declared_only | static_checked | doctor_checked | runtime_attested | live_evidence_attested
    coverage_status: complete | partial | missing_required | blocked | unknown
    blocking_reasons: [provider_evidence_blocking_reason]
    missing_evidence: [string]
    redaction_gaps: [string]
    next_required_gates: [string]
    closeout_decision: allow | deny | defer
```

## Closed enum: `provider_evidence_blocking_reason`

- `provider_contract_missing`
- `provider_contract_version_mismatch`
- `provider_selection_unproven`
- `provider_limitation_conflict`
- `launch_envelope_missing`
- `launch_argument_snapshot_missing`
- `profile_ref_missing`
- `profile_lock_unavailable`
- `profile_login_state_unknown`
- `extension_binding_missing`
- `extension_status_unready`
- `native_messaging_binding_missing`
- `native_messaging_status_unready`
- `version_evidence_missing`
- `evidence_ref_invalid`
- `evidence_ref_unavailable`
- `evidence_freshness_stale`
- `redaction_policy_missing`
- `redaction_invalid`
- `secret_leak_detected`
- `live_evidence_required`
- `runtime_attestation_required`
- `manual_review_required`
- `source_conflict`

## Required reference rules

1. `identity.base_refs` must include `FR-0033.browser_provider_contract.v1` and `FR-0037.launch_envelope.v1` for launch/runtime/capability closeout scopes.
2. `selected_provider.provider_contract_ref` must resolve to the selected provider contract and match `provider_id`, `provider_contract_version`, and `provider_mode`.
3. `launch_arguments.launch_envelope_ref` must resolve to the authoritative Launch Envelope when `evidence_scope` is `launch_admission`, `runtime_admission`, or `capability_closeout`.
4. Every id listed in section-specific `*_evidence_refs` must exist in top-level `evidence_refs`.
5. Required evidence with `status=unavailable|partial`, stale freshness, or invalid redaction must produce `closeout_plan.closeout_decision=deny` unless a later formal FR freezes a narrower exception.

## Redaction contract

- `sensitivity=secret` must never expose raw values in PR body, stdout summary, spec sample, or unredacted artifact.
- `sensitivity=sensitive` must use `redaction_state=redacted` before it can satisfy required closeout evidence.
- `redaction_state=policy_missing|invalid` must produce a blocking reason when the evidence is required.
- `profile_ref`, `native_host_manifest_ref`, `allowed_origin_ref`, `network_regional_ref`, and `fingerprint_policy_ref` are locators; they must not inline account secret, proxy credential, cookie, token, fingerprint seed, or provider private patch payload.

## Minimal valid example

```yaml
provider_evidence_record:
  identity:
    provider_evidence_record_id: per-example-001
    provider_evidence_contract_version: v1
    run_id: run-example-001
    command_ref: command-envelope-example
    created_at: "2026-06-07T00:00:00Z"
    evidence_scope: launch_admission
    base_refs:
      - FR-0033.browser_provider_contract.v1
      - FR-0037.launch_envelope.v1
  selected_provider:
    provider_id: official-chrome-stable
    provider_contract_ref: provider-contract:official-chrome-stable:v1
    provider_contract_version: v1
    provider_mode: core_managed
    provider_class_ref: registry-entry:official-chrome-stable
    selection_reason: explicit_request
    selection_source: launch_envelope
    selection_evidence_refs:
      - ev-provider-contract
  version_evidence:
    provider_version: "0.1.0"
    browser_channel: Google Chrome stable
    browser_version: unknown
    extension_version: unknown
    native_host_version: unknown
    contract_version: v1
    version_evidence_refs:
      - ev-version-attestation
  launch_arguments:
    launch_envelope_ref: launch-envelope:example:v1
    launch_envelope_version: v1
    provider_launch_ref: launch-snapshot:example:redacted
    browser_mode:
      headed: true
      headless: false
      real_browser_required: true
      browser_channel: Google Chrome stable
    runtime_bindings:
      extension_binding_mode: persistent_profile_extension
      native_messaging_mode: required
      runtime_bootstrap_required: true
    network_regional_ref: ref:network-regional:redacted
    fingerprint_policy_ref: ref:fingerprint-policy:redacted
    launch_argument_evidence_refs:
      - ev-launch-snapshot
  profile_reference:
    profile_ref: profile-ref:redacted
    profile_binding_mode: required_existing
    profile_lock_status: locked_by_current_run
    login_state_evidence: not_required
    profile_persistence_status: persistent
    profile_evidence_refs:
      - ev-profile-binding
  extension_status:
    extension_required: true
    extension_binding_mode: persistent_profile_extension
    extension_id: abcdefghijklmnopabcdefghijklmnop
    extension_version: unknown
    extension_installation_status: installed_in_profile
    extension_runtime_status: ready
    extension_evidence_refs:
      - ev-extension-binding
  native_messaging_status:
    native_messaging_required: true
    native_host_name: com.webenvoy.native
    native_host_manifest_ref: native-manifest-ref:redacted
    allowed_origin_ref: allowed-origin-ref:redacted
    native_host_version: unknown
    native_messaging_runtime_status: ready
    native_messaging_evidence_refs:
      - ev-native-binding
  evidence_refs:
    - evidence_ref_id: ev-provider-contract
      kind: provider_contract_ref
      ref: provider-contract:official-chrome-stable:v1
      source: provider_contract
      status: available
      collected_at: null
      freshness: current_record
      sensitivity: public
      redaction_state: not_required
      artifact_identity: null
    - evidence_ref_id: ev-version-attestation
      kind: version_attestation
      ref: version-attestation:redacted
      source: runtime_admission
      status: partial
      collected_at: null
      freshness: current_record
      sensitivity: internal
      redaction_state: redacted
      artifact_identity: null
    - evidence_ref_id: ev-launch-snapshot
      kind: launch_config_snapshot
      ref: launch-snapshot:example:redacted
      source: launch_envelope
      status: available
      collected_at: null
      freshness: current_launch
      sensitivity: sensitive
      redaction_state: redacted
      artifact_identity: artifact:launch-snapshot-example
    - evidence_ref_id: ev-profile-binding
      kind: profile_binding_ref
      ref: profile-ref:redacted
      source: runtime_admission
      status: available
      collected_at: null
      freshness: current_launch
      sensitivity: sensitive
      redaction_state: redacted
      artifact_identity: null
    - evidence_ref_id: ev-extension-binding
      kind: extension_binding_ref
      ref: extension-binding:profile-installed:redacted
      source: runtime_admission
      status: available
      collected_at: null
      freshness: current_launch
      sensitivity: internal
      redaction_state: redacted
      artifact_identity: null
    - evidence_ref_id: ev-native-binding
      kind: native_messaging_binding_ref
      ref: native-binding:redacted
      source: runtime_admission
      status: available
      collected_at: null
      freshness: current_launch
      sensitivity: internal
      redaction_state: redacted
      artifact_identity: null
  closeout_plan:
    required_evidence_kinds:
      - provider_contract_ref
      - launch_config_snapshot
      - profile_binding_ref
      - extension_binding_ref
      - native_messaging_binding_ref
    required_freshness: current_launch
    minimum_attestation_level: runtime_attested
    coverage_status: partial
    blocking_reasons:
      - version_evidence_missing
    missing_evidence:
      - browser_version
    redaction_gaps: []
    next_required_gates:
      - browser_version_attestation
    closeout_decision: deny
```

## Invalid examples

- A record whose `profile_ref` contains raw Cookie, token, account id, or unredacted private path.
- A record that uses `runtime_bootstrap_ref` as proof of `live_evidence_attested`.
- A record with `extension_runtime_status=disconnected` and `closeout_decision=allow` for an extension-required capability.
- A record with required `current_pr_head` evidence satisfied only by `historical_background`.
- A record whose `selected_provider.provider_id` differs from the referenced provider contract.
