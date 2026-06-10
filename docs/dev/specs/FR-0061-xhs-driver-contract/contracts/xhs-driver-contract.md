# XHS Driver Contract

## Contract version

- `xhs_driver_contract.version = v1`
- Canonical suite: `FR-0061-xhs-driver-contract`
- Canonical issue: `#1158`

## Schema

```yaml
xhs_driver_contract:
  identity:
    driver_contract_id: string
    driver_contract_version: "v1"
    platform: "xhs"
    driver_namespace: "webenvoy.xhs.driver"
    supported_abilities:
      - "xhs.search" | "xhs.detail" | "xhs.user_home"
    contract_ref: "FR-0061.xhs_driver_contract.v1"
    canonical_issue_ref: "#1158"
  output_envelope:
    raw:
      raw_payload_ref: string | null
      raw_payload_kind: "api_response" | "page_state" | "dom_state" | "request_template_observation" | "unknown"
      source_route: "search" | "detail" | "user_home" | "unknown"
      source_capture_kind: "browser_in_page_fetch" | "page_state_read" | "passive_observation" | "diagnostic_only" | "unknown"
      source_freshness: "current_run" | "current_pr_head" | "historical_background" | "unknown" | "not_applicable"
      redaction_state: "redacted" | "redaction_required" | "not_required" | "policy_missing" | "invalid"
      raw_parse_status: "parsed" | "partial" | "blocked" | "failed" | "not_implemented" | "unknown"
    operational:
      ability_id: "xhs.search" | "xhs.detail" | "xhs.user_home"
      operation_id: string
      run_id: string
      request_shape_ref: string | null
      route_bucket: "search" | "detail" | "user_home" | "unknown"
      runtime_binding_ref: string | null
      provider_requirement_refs:
        - string
      status: "success" | "partial" | "blocked" | "failed" | "not_implemented" | "unknown"
      error_boundary:
        error_class: string | null
        error_contract_ref: string | null
      downstream_slice_ref: string | null
    evidence:
      evidence_refs:
        - kind: "raw_payload_ref" | "runtime_binding_ref" | "provider_evidence_ref" | "route_evidence_ref" | "redaction_ref" | "diagnostic_ref"
          ref: string
          status: "available" | "partial" | "unavailable" | "not_applicable"
          freshness: "current_run" | "current_pr_head" | "historical_background" | "unknown" | "not_applicable"
          sensitivity: "public" | "internal" | "sensitive" | "secret"
          redaction_state: "redacted" | "redaction_required" | "not_required" | "policy_missing" | "invalid"
      provider_evidence_ref: string | null
      runtime_binding_evidence_ref: string | null
      raw_payload_evidence_ref: string | null
      redaction_summary:
        status: "pass" | "blocked" | "unknown" | "not_applicable"
        blockers:
          - string
      freshness_scope: "current_run" | "current_pr_head" | "historical_background" | "unknown" | "not_applicable"
      non_proofs:
        - "runtime_ready"
        - "target_tab_ready"
        - "live_evidence_accepted"
        - "provider_capability_allowed"
        - "syvert_normalized_result_complete"
        - "write_enabled"
      blocking_reasons:
        - string
      next_required_gates:
        - "provider_capability_verification" | "runtime_attestation" | "route_evidence_evaluator" | "live_evidence_gate" | "syvert_normalization" | "manual_review"
  runtime_binding:
    target_domain: "www.xiaohongshu.com"
    target_page: "search_tab" | "explore_detail_tab" | "profile_tab" | "unknown"
    target_tab_ref: string | null
    execution_mode: "read" | "diagnose" | "unknown"
    page_context_namespace_ref: string | null
    runtime_provider_ref: string | null
    binding_freshness: "current_run" | "historical_background" | "unknown" | "not_applicable"
    binding_status: "declared" | "ready" | "blocked" | "unknown" | "not_applicable"
  provider_requirements:
    required_runtime_requirements:
      - "profile_binding" | "extension_binding" | "native_messaging" | "target_tab" | "real_browser" | "headless_forbidden" | "runtime_bootstrap_ready" | "provider_doctor_passed"
    required_actions:
      - "read" | "diagnose"
    required_execution_layers:
      - "L3" | "L2" | "L1"
    minimum_support_state: "statically_verified" | "health_checked" | "runtime_attested" | "runtime_observed" | "live_evidence_attested"
    provider_contract_refs:
      - string
    capability_verification_ref: string | null
    evidence_policy_refs:
      - "FR-0040.provider_evidence_record.v1" | "FR-0041.evidence_redaction_policy.v1"
  downstream_slicing_inputs:
    driver_contract_ref: "FR-0061.xhs_driver_contract.v1"
    ability_scope:
      - "xhs.search" | "xhs.detail" | "xhs.user_home"
    allowed_output_sections:
      - "raw" | "operational" | "evidence"
    runtime_binding_ref: string | null
    provider_requirement_refs:
      - string
    raw_payload_boundary_ref: string | null
    evidence_boundary_ref: string | null
    non_goal_refs:
      - "syvert_normalized_result"
      - "syvert_resource_taxonomy"
      - "syvert_error_taxonomy"
      - "read_path_implementation"
      - "live_write_enablement"
      - "json_rpc_extension"
      - "browser_profile_account_live_actions"
```

## Normative rules

1. `output_envelope` must expose only `raw`, `operational` and `evidence` as driver output sections.
2. `raw` must not be treated as Syvert normalized result, Syvert resource taxonomy or Syvert error taxonomy.
3. `operational.route_bucket` is a WebEnvoy driver route grouping, not a Syvert resource type.
4. `operational.error_boundary` is a WebEnvoy driver-local error boundary or contract ref, not a Syvert error taxonomy.
5. `runtime_binding` is a locator and requested binding shape. It must not prove runtime readiness, target tab readiness, page interaction success or live evidence acceptance.
6. `provider_requirements` must consume `FR-0033` / `FR-0035` / `FR-0040` / `FR-0041`; this contract must not redefine provider requirement enums, capability verification policy, provider evidence refs or redaction policy.
7. `required_actions` must not include write actions in v1.
8. Any evidence ref with `status=partial|unavailable`, stale freshness or `redaction_state=redaction_required|policy_missing|invalid` must fail closed when required by the consumer.
9. `non_proofs` is mandatory and must include every v1 enum listed above.
10. `downstream_slicing_inputs.non_goal_refs` must preserve the listed exclusions so later slices cannot infer hidden implementation authorization from this contract.

## Forbidden fields

The following fields must not appear in v1 XHS driver output:

- `normalized`
- `syvert_resource_type`
- `syvert_error_code`
- `live_write_commit`
- `publish_result`
- `jsonrpc_method`
- raw Cookie, token, account identifier, private absolute path, credential-bearing header, full page content or browser profile path

Presence of a forbidden field is a contract violation and must block the affected consumer.
