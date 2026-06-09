# CloakBrowser Final Args Evidence Contract

## Contract version

- `cloakbrowser_final_args_evidence.version = v1`

## Schema

```yaml
cloakbrowser_final_args_evidence:
  identity:
    final_args_evidence_id: string
    final_args_evidence_version: "v1"
    provider_id: "cloakbrowser.direct" | "cloakbrowser.persistent" | "cloakbrowser.cloakserve"
    variant_kind: "direct" | "persistent" | "cloakserve"
    run_id: string
    capture_stage: "launch_assembly" | "attach_reconstruction" | "diagnostic_reconstruction"
    capture_mode: "build_time_assembled" | "reconstructed_from_provider_signal" | "reconstructed_from_artifact"
    created_at: rfc3339-utc
    artifact_identity: string
  provenance:
    source_kind: "launch_envelope_input" | "provider_launch_snapshot" | "provider_attach_snapshot" | "diagnostic_artifact"
    source_ref: string
    source_owner: "launch_admission" | "provider_adapter" | "provider_broker" | "diagnostic_owner"
    reconstruction_status: "authoritative_input_shape" | "reconstructed_partial" | "reconstructed_complete_unverified" | "unknown"
    reconstruction_method: "assembled_before_launch" | "provider_reported" | "artifact_replay" | "derived_from_logs"
    attestation_boundary: "input_shape_only" | "provider_report_only" | "diagnostic_only"
    freshness_scope: "current_run" | "historical_background" | "unknown"
  args_summary:
    - arg_key: string
      value_shape: "boolean_presence" | "redacted_scalar" | "locator_only" | "path_hash_only" | "opaque_ref_only"
      disclosure_class: "public_key_only" | "redacted_value" | "sensitive_locator" | "secret_forbidden"
      presence_state: "present" | "explicit_absent" | "unknown"
      locator_ref: string | null
      path_hash: string | null
      value_excerpt_ref: string | null
      source_entry_ref: string | null
  semantic_conclusion:
    proves:
      - "launch_input_shape_recorded"
      - "arg_presence_or_locator_recorded"
      - "variant_specific_input_boundary_known"
    does_not_prove:
      - "browser_honored_args"
      - "runtime_ready"
      - "health_pass"
      - "capability_allowed"
      - "anti_detection_pass"
      - "target_tab_ready"
      - "live_evidence_attested"
    consumer_warnings:
      - string
    blocking_conditions:
      - "required_evidence_missing"
      - "redaction_invalid"
      - "secret_leak_detected"
      - "freshness_not_current"
      - "reconstruction_unknown"
```

## Normative rules

1. `provider_id` and `variant_kind` must match the same CloakBrowser variant.
2. `artifact_identity`, `source_ref`, `locator_ref` and `value_excerpt_ref` must be redacted locators, artifact refs, hashes or opaque handles. They must never be raw private absolute paths.
3. `args_summary` must not encode a raw argv token stream, raw environment dump, Cookie, token, proxy credential, fingerprint seed value, private patch payload, account identifier or page content.
4. `attestation_boundary` must never claim browser honored args, runtime readiness, health pass, capability allow or live evidence attestation.
5. `freshness_scope=historical_background|unknown` must fail closed when the consumer requires current-run final args evidence.
6. `reconstruction_status=unknown` must fail closed when the consumer requires accepted final args evidence.
7. `secret_forbidden` values must never appear as cleartext in spec samples, PR body, stdout summary or public artifacts.
8. `does_not_prove` is mandatory and must include every v1 enum listed above.

## Variant consumption rules

- `cloakbrowser.direct`
  - May consume `launch_envelope_input` or `provider_launch_snapshot`.
  - Must not infer persistent profile, stable extension identity or native messaging readiness.

- `cloakbrowser.persistent`
  - May consume `provider_attach_snapshot`.
  - Must not infer profile lock, login state reuse, extension workflow ready or broker attach success.

- `cloakbrowser.cloakserve`
  - Typically consumes reconstructed or diagnostic sources only.
  - Must not infer extension bridge ready, Native Messaging support, headed route, endpoint security or live attach success.
