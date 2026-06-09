# FR-0053 Contract: CloakBrowser Direct Launch Health v1

Canonical Issue: #1150

## Ownership

This contract defines WebEnvoy-local CloakBrowser direct launch health/admission evidence semantics.

It specializes consumption of `FR-0038.provider_doctor_report` for `FR-0049.cloakbrowser.direct`, and consumes `FR-0058.cloakbrowser_final_args_evidence` plus `FR-0059.cloakbrowser_fingerprint_seed_evidence_policy`.

It does not define runtime launch behavior, capability matrix rows, limitation gate results, native messaging bridge, browser patching, target tab readiness, page automation success, anti-detection pass, or live evidence records.

## Schema

```yaml
cloakbrowser_direct_launch_health_report:
  identity:
    direct_launch_health_report_id: string
    direct_launch_health_version: "v1"
    provider_id: "cloakbrowser.direct"
    variant_kind: "direct"
    provider_contract_ref: "FR-0033.browser_provider_contract.v1"
    descriptor_ref: "FR-0049.cloakbrowser.direct.v1"
    doctor_contract_ref: "FR-0038.provider_doctor_report.v1"
    generated_at: rfc3339-utc
    scope: "static_probe" | "local_launch_admission" | "transport_preflight" | "extension_optional_check"
    run_ref: string
    artifact_identity: string
  input_refs:
    expected_binary_source:
      source_id: string
      source_kind: "browser_executable" | "provider_launcher" | "adapter_binary"
      locator_ref: string
      locator_sensitivity: "internal" | "sensitive" | "secret"
      expected_access: "exists" | "executable" | "launchable"
    expected_version_policy:
      policy_ref: string
      provider_managed_version_required: boolean
      accepted_evidence_refs:
        - string
    expected_launch_args_evidence_ref:
      final_args_evidence_ref: string
      required_freshness: "current_run"
      required_redaction_state: "redacted"
    expected_environment_probe_policy:
      require_headful_display: boolean
      forbid_raw_environment_dump: true
      accepted_environment_facts:
        - "display_available"
        - "headless_not_used"
        - "workspace_artifact_reachable"
        - "launcher_environment_explained"
    expected_transport_policy:
      transport_kind: "hybrid"
      accepted_transport_facts:
        - "provider_control_surface_explained"
        - "cdp_attach_precondition_observed"
        - "playwright_attach_precondition_observed"
        - "diagnostic_artifact_passthrough_available"
      does_not_include:
        - "target_tab_ready"
        - "page_automation_success"
        - "live_evidence_attested"
    optional_extension_policy:
      extension_required_for_admission: boolean
      accepted_locator_kinds:
        - "extension_asset_ref"
        - "workspace_artifact_ref"
      stable_extension_identity: "not_promised"
      native_messaging_support: "not_applicable"
    fingerprint_seed_policy_ref: "FR-0059.cloakbrowser_fingerprint_seed_evidence_policy.v1"
  checks:
    - check_id: string
      category: "binary_probe" | "version_probe" | "launch_args_probe" | "environment_probe" | "transport_probe" | "optional_extension_probe" | "admission_summary"
      status: "pass" | "warn" | "fail" | "not_applicable" | "unknown"
      severity: "info" | "warning" | "error" | "fatal"
      blocking: "none" | "admission_blocking" | "provider_blocking"
      summary: string
      diagnostics:
        code: string
        observed: string | null
        expected: string | null
        remediation_hint: string | null
        proves:
          - string
        does_not_prove:
          - string
      evidence_refs:
        - kind: "binary_locator_ref" | "version_output_ref" | "final_args_evidence_ref" | "environment_probe_ref" | "transport_probe_ref" | "extension_state_ref" | "health_artifact_ref"
          ref: string
          status: "available" | "partial" | "unavailable" | "not_applicable" | "unknown"
          collected_at: rfc3339-utc
          sensitivity: "public" | "internal" | "sensitive" | "secret"
          redaction_state: "redacted" | "not_required" | "redaction_required" | "invalid"
  outcome:
    overall_status: "pass" | "warn" | "fail" | "unknown"
    provider_blocked: boolean
    admission_blocked: boolean
    doctor_verification_projection: "declared_only" | "static_checked" | "doctor_checked"
    direct_launch_health_level: "declared_only" | "static_checked" | "health_checked" | "admission_ready"
    blocked_checks:
      - string
    warnings:
      - string
    next_required_gates:
      - "runtime_attestation"
      - "launch_evidence_validation"
      - "capability_matrix_selection"
      - "live_evidence"
    semantic_conclusion:
      proves:
        - "health_admission_evidence"
      does_not_prove:
        - "browser_honored_args"
        - "runtime_ready"
        - "capability_allowed"
        - "target_tab_ready"
        - "anti_detection_pass"
        - "live_evidence_attested"
```

## Normative rules

1. `provider_id` must be `cloakbrowser.direct`, and `variant_kind` must be `direct`.
2. The report may specialize `FR-0038.provider_doctor_report`, but it must not redefine FR-0038 status, severity, blocking, evidence, or fail-closed semantics.
3. `native_messaging_support` is not applicable for `cloakbrowser.direct` and must not be converted into a required pass condition.
4. `launch_args_probe` must consume `FR-0058` and must never claim browser honored args.
5. `transport_probe` may only prove direct launch transport preflight facts. It must not prove target tab readiness, runtime bootstrap, page automation, or live evidence.
6. `optional_extension_probe` must not prove stable extension id, service worker freshness, persistent extension installation, or Native Messaging readiness.
7. `doctor_verification_projection` must use FR-0038 `doctor_verification_level` values and must never exceed `doctor_checked`.
8. `direct_launch_health_level=admission_ready` means the provider may enter a later runtime gate. It does not mean runtime is ready.
9. When this report is projected back into `FR-0038.provider_doctor_report`, `admission_summary` must map to a `capability_readiness` check, and later verification levels may appear only as `minimum_next_verification_level`, not as satisfied requirements.
10. Any required check with `status=fail|unknown`, invalid enum, missing required evidence, or invalid redaction must fail closed.
11. Raw local paths, raw argv, raw environment dump, cookies, tokens, proxy credentials, fingerprint seed values, seed hash values, private patch payloads, account identifiers, and page content must never appear in public surfaces.

## Minimal valid example

```yaml
cloakbrowser_direct_launch_health_report:
  identity:
    direct_launch_health_report_id: "cloakbrowser-direct-health-run-123"
    direct_launch_health_version: "v1"
    provider_id: "cloakbrowser.direct"
    variant_kind: "direct"
    provider_contract_ref: "FR-0033.browser_provider_contract.v1"
    descriptor_ref: "FR-0049.cloakbrowser.direct.v1"
    doctor_contract_ref: "FR-0038.provider_doctor_report.v1"
    generated_at: "2026-06-09T13:30:00Z"
    scope: "local_launch_admission"
    run_ref: "run:123"
    artifact_identity: "artifact:cloakbrowser-direct-health:123"
  input_refs:
    expected_binary_source:
      source_id: "cloakbrowser-direct-binary"
      source_kind: "provider_launcher"
      locator_ref: "artifact:redacted-provider-launcher"
      locator_sensitivity: "sensitive"
      expected_access: "launchable"
    expected_version_policy:
      policy_ref: "policy:provider-managed-version"
      provider_managed_version_required: true
      accepted_evidence_refs:
        - "artifact:version-output:run-123"
    expected_launch_args_evidence_ref:
      final_args_evidence_ref: "artifact:final-args:run-123"
      required_freshness: "current_run"
      required_redaction_state: "redacted"
    expected_environment_probe_policy:
      require_headful_display: true
      forbid_raw_environment_dump: true
      accepted_environment_facts:
        - "display_available"
        - "headless_not_used"
        - "workspace_artifact_reachable"
        - "launcher_environment_explained"
    expected_transport_policy:
      transport_kind: "hybrid"
      accepted_transport_facts:
        - "provider_control_surface_explained"
        - "cdp_attach_precondition_observed"
        - "playwright_attach_precondition_observed"
        - "diagnostic_artifact_passthrough_available"
      does_not_include:
        - "target_tab_ready"
        - "page_automation_success"
        - "live_evidence_attested"
    optional_extension_policy:
      extension_required_for_admission: false
      accepted_locator_kinds:
        - "extension_asset_ref"
        - "workspace_artifact_ref"
      stable_extension_identity: "not_promised"
      native_messaging_support: "not_applicable"
    fingerprint_seed_policy_ref: "FR-0059.cloakbrowser_fingerprint_seed_evidence_policy.v1"
  checks:
    - check_id: "binary-probe"
      category: "binary_probe"
      status: "pass"
      severity: "info"
      blocking: "none"
      summary: "Provider launcher locator is available and launchable."
      diagnostics:
        code: "binary_probe_pass"
        observed: "launchable"
        expected: "launchable"
        remediation_hint: null
        proves:
          - "health_admission_evidence"
        does_not_prove:
          - "runtime_ready"
      evidence_refs:
        - kind: "binary_locator_ref"
          ref: "artifact:redacted-provider-launcher"
          status: "available"
          collected_at: "2026-06-09T13:30:00Z"
          sensitivity: "sensitive"
          redaction_state: "redacted"
    - check_id: "admission-summary"
      category: "admission_summary"
      status: "warn"
      severity: "warning"
      blocking: "none"
      summary: "Direct launch health is sufficient for later runtime gate entry."
      diagnostics:
        code: "admission_summary_warn"
        observed: "optional_extension_not_required"
        expected: "runtime_gate_still_required"
        remediation_hint: null
        proves:
          - "health_admission_evidence"
        does_not_prove:
          - "browser_honored_args"
          - "runtime_ready"
          - "capability_allowed"
          - "target_tab_ready"
          - "anti_detection_pass"
          - "live_evidence_attested"
      evidence_refs:
        - kind: "health_artifact_ref"
          ref: "artifact:cloakbrowser-direct-health:123"
          status: "available"
          collected_at: "2026-06-09T13:30:00Z"
          sensitivity: "internal"
          redaction_state: "not_required"
  outcome:
    overall_status: "warn"
    provider_blocked: false
    admission_blocked: false
    doctor_verification_projection: "doctor_checked"
    direct_launch_health_level: "health_checked"
    blocked_checks: []
    warnings:
      - "optional_extension_not_required"
    next_required_gates:
      - "runtime_attestation"
      - "launch_evidence_validation"
      - "capability_matrix_selection"
      - "live_evidence"
    semantic_conclusion:
      proves:
        - "health_admission_evidence"
      does_not_prove:
        - "browser_honored_args"
        - "runtime_ready"
        - "capability_allowed"
        - "target_tab_ready"
        - "anti_detection_pass"
        - "live_evidence_attested"
```

## Invalid examples

```yaml
outcome:
  direct_launch_health_level: "runtime_attested"
```

```yaml
checks:
  - category: "transport_probe"
    status: "pass"
    diagnostics:
      proves:
        - "target_tab_ready"
```

```yaml
evidence_refs:
  - kind: "environment_probe_ref"
    ref: "PATH=/Users/example/private/path TOKEN=secret"
    redaction_state: "invalid"
```
