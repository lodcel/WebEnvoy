# CloakBrowser Docker / Xvfb Doctor Contract

## Contract version

- `cloakbrowser_docker_xvfb_doctor.version = v1`

## Schema

```yaml
cloakbrowser_docker_xvfb_doctor:
  identity:
    docker_xvfb_doctor_id: string
    docker_xvfb_doctor_version: "v1"
    provider_id: "cloakbrowser.direct" | "cloakbrowser.persistent" | "cloakbrowser.cloakserve"
    variant_kind: "direct" | "persistent" | "cloakserve"
    run_id: string
    environment_kind: "docker_xvfb" | "docker_headless_only" | "host_x11" | "unknown"
    generated_at: rfc3339-utc
    provider_doctor_report_ref: string
    artifact_identity: string
  environment_inputs:
    container_ref: string
    binary_source_ref: string
    x_server_ref: string
    display_ref: string
    launch_mode_request: "headed_required" | "headless_requested" | "headless_forbidden" | "diagnostic_only"
    font_catalog_ref: string
    diagnostic_command_refs:
      - string
  checks:
    - check_id: string
      category: "binary" | "x_server" | "display" | "headed_launch_admission" | "headless_policy" | "font_readiness" | "diagnostic_output"
      status: "pass" | "warn" | "fail" | "not_applicable" | "unknown"
      severity: "info" | "warning" | "error" | "fatal"
      blocking: "none" | "environment_blocking" | "provider_blocking"
      summary: string
      diagnostics:
        code: string
        observed: string | null
        expected: string | null
        remediation_hint: string | null
        next_required_gate:
          - "runtime_attestation" | "launch_evidence" | "target_tab_binding" | "live_evidence" | "manual_environment_fix"
      evidence_refs:
        - kind: "command_output_ref" | "environment_probe_ref" | "x_server_probe_ref" | "font_probe_ref" | "doctor_artifact_ref"
          ref: string
          status: "available" | "partial" | "unavailable" | "not_applicable"
          collected_at: rfc3339-utc
          sensitivity: "public" | "internal" | "sensitive" | "secret"
          redaction_state: "redacted" | "partial" | "invalid" | "not_applicable"
          machine_readable: boolean
          contains_required_fields: boolean
  outcome:
    overall_status: "pass" | "warn" | "fail" | "unknown"
    environment_blocked: boolean
    provider_blocked: boolean
    admission_verification_level: "declared_only" | "environment_checked" | "docker_xvfb_doctor_checked"
    blocked_reasons:
      - string
    next_required_gates:
      - "runtime_attestation" | "launch_evidence" | "target_tab_binding" | "live_evidence" | "capability_matrix" | "manual_environment_fix"
```

## Normative rules

1. `provider_id` and `variant_kind` must match the same CloakBrowser variant.
2. `provider_doctor_report_ref` must point to the same run or admission attempt as the Docker / Xvfb doctor report.
3. `artifact_identity`, `container_ref`, `binary_source_ref`, `x_server_ref`, `display_ref`, `font_catalog_ref` and diagnostic refs must be redacted locators, artifact refs, hashes or opaque handles.
4. Unknown check category, unknown status, unknown environment kind in required admission, or invalid redaction state must fail closed.
5. `headless_policy` must fail closed when a CloakBrowser descriptor requires headed / real-browser route and only headless evidence is available.
6. `display` must fail closed when `DISPLAY` is missing, malformed, unreachable or inconsistent with `x_server_ref`.
7. `font_readiness` must not be used as proof of visual correctness, screenshot validity, anti-detection pass or live interaction success.
8. `diagnostic_output` must not pass on free-text-only or redaction-invalid artifacts when it is a required check.
9. `admission_verification_level` must never exceed `docker_xvfb_doctor_checked`.
10. `next_required_gates` expresses gates still required; it never means those gates passed.

## Required check mapping

| Required source | Required Docker / Xvfb check |
|---|---|
| `FR-0038.input_contract_ref.expected_binary_source` | `binary` |
| Docker / Xvfb environment requested | `x_server` |
| headed route requested | `display`, `x_server`, `headed_launch_admission` |
| CloakBrowser `headless_policy=forbidden` | `headless_policy` |
| headed rendering or visual diagnostic required | `font_readiness` |
| any required environment check | `diagnostic_output` |

Required check missing, failing, unknown or redaction-invalid blocks the affected environment/provider admission.
