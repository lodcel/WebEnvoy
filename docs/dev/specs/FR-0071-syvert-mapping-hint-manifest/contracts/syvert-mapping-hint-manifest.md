# Syvert Mapping Hint Manifest Contract

## Contract version

- `syvert_mapping_hint_manifest.version = v1`
- Canonical suite: `FR-0071-syvert-mapping-hint-manifest`
- Canonical issue: `#1199`

## Schema

```ts
type MappingHintClassV1 =
  | "ability_hint"
  | "route_hint"
  | "raw_payload_hint"
  | "operational_hint"
  | "evidence_hint"
  | "risk_hint"
  | "provider_hint"
  | "mapping_gap_hint"
  | "consumer_action_hint";

type MappingHintFreshnessV1 =
  | "current_run"
  | "current_pr_head"
  | "historical_background"
  | "unknown"
  | "not_applicable";

type MappingHintRedactionStateV1 =
  | "redacted"
  | "redaction_required"
  | "not_required"
  | "policy_missing"
  | "invalid";

type MappingHintConsumerActionV1 =
  | "syvert_normalization_required"
  | "resource_taxonomy_required"
  | "error_taxonomy_required"
  | "product_workflow_mapping_required"
  | "manual_mapping_review_required"
  | "no_downstream_action_required";

type MappingHintNonProofV1 =
  | "not_syvert_normalized_result"
  | "not_syvert_resource_taxonomy"
  | "not_syvert_error_taxonomy"
  | "not_provider_adapter"
  | "not_cli_jsonrpc_wrapper"
  | "not_live_evidence"
  | "not_read_write_gate_allow"
  | "not_integration_gate";

type MappingHintBlockerV1 =
  | "unknown_manifest_version"
  | "unknown_hint_class"
  | "missing_source_ref"
  | "source_scope_mismatch"
  | "historical_or_stale_source"
  | "redaction_invalid"
  | "forbidden_field_present"
  | "syvert_boundary_violation"
  | "provider_adapter_scope_drift"
  | "integration_gate_required_outside_fr0071"
  | "downstream_mapping_owner_required";

interface SyvertMappingHintManifestV1 {
  identity: {
    manifest_id: "syvert_mapping_hint_manifest";
    manifest_version: "v1";
    owner_ref: "FR-0071.syvert_mapping_hint_manifest.v1";
    canonical_issue_ref: "#1199";
    manifest_ref: string;
    integration_mode: "local_only";
    producer_boundary: "webenvoy_core_hint_manifest";
    consumer_boundary:
      | "syvert_optional_consumer"
      | "generic_downstream_consumer";
  };
  source_contract_refs: string[];
  hints: MappingHintItemV1[];
  mapping_gaps: MappingGapHintV1[];
  consumer_actions: MappingHintConsumerActionV1[];
  non_proofs: MappingHintNonProofV1[];
  blockers: MappingHintBlockerV1[];
}

type MappingHintItemV1 =
  | ConsumableMappingHintItemV1
  | BlockerOnlyMappingHintItemV1;

interface MappingHintItemBaseV1 {
  hint_id: string;
  hint_class: MappingHintClassV1;
  hint_value_ref: string | null;
  mapping_intent:
    | "identify_source"
    | "classify_route"
    | "link_evidence"
    | "explain_gap"
    | "suggest_downstream_action"
    | "diagnostic_context";
  forbidden_effects: Array<
    | "syvert_normalized_result_complete"
    | "resource_taxonomy_complete"
    | "error_taxonomy_complete"
    | "provider_adapter_ready"
    | "jsonrpc_wrapper_ready"
    | "live_evidence_accepted"
    | "integration_gate_active"
  >;
}

interface ConsumableMappingHintItemV1 extends MappingHintItemBaseV1 {
  source_binding_state: "bound";
  source_binding: MappingHintConsumableSourceBindingV1;
  allowed_effect:
    | "downstream_context_only"
    | "downstream_mapping_input"
    | "manual_review_input";
}

interface BlockerOnlyMappingHintItemV1 extends MappingHintItemBaseV1 {
  source_binding_state: "untraceable";
  source_binding: MappingHintBlockerOnlySourceBindingV1;
  allowed_effect: "blocker_explanation";
  blockers: MappingHintBlockerV1[];
}

interface MappingHintConsumableSourceBindingV1 {
  source_contract_ref: string;
  source_section:
    | "raw"
    | "operational"
    | "evidence"
    | "runtime_binding"
    | "risk_evidence"
    | "provider_boundary";
  source_ref: string;
  source_owner:
    | "webenvoy_core"
    | "webenvoy_formal_contract"
    | "provider_owned_boundary";
  scope: {
    ability_id: string | null;
    route_bucket: string | null;
    target_domain: string | null;
    target_page: string | null;
    run_id: string | null;
    head_sha: string | null;
  };
  freshness: MappingHintFreshnessV1;
  redaction_state: MappingHintRedactionStateV1;
}

interface MappingHintBlockerOnlySourceBindingV1 {
  source_contract_ref: string | null;
  source_section: "unknown" | null;
  source_ref: null;
  source_owner: "downstream_owner_required" | "unknown";
  blocker_reason:
    | "missing_source_ref"
    | "unknown_hint_class"
    | "source_scope_mismatch"
    | "historical_or_stale_source"
    | "redaction_invalid"
    | "downstream_mapping_owner_required";
}

interface MappingGapHintV1 {
  gap_id: string;
  gap_class:
    | "normalized_result_required"
    | "resource_taxonomy_required"
    | "error_taxonomy_required"
    | "product_workflow_mapping_required"
    | "consumer_validation_required";
  owner: "syvert_owned_contract" | "downstream_consumer_owned_contract";
  webenvoy_default_allowed: false;
  required_action: MappingHintConsumerActionV1;
}
```

## Normative rules

1. `identity.integration_mode` must be `local_only` in v1.
2. `non_proofs` is mandatory and must include every `MappingHintNonProofV1` value.
3. `MappingHintItemV1.allowed_effect` must never imply Syvert normalized result, resource taxonomy, error taxonomy, provider adapter readiness, JSON-RPC wrapper readiness, live evidence acceptance or active integration gate.
4. `MappingGapHintV1.webenvoy_default_allowed` must be `false`.
5. `allowed_effect=downstream_mapping_input` is valid only for `source_binding_state=bound` with `MappingHintConsumableSourceBindingV1`.
6. `MappingHintConsumableSourceBindingV1` must provide non-null `source_ref`, machine-checkable `source_contract_ref`, explicit WebEnvoy-owned `source_section`, and source owner `webenvoy_core|webenvoy_formal_contract|provider_owned_boundary`.
7. Unknown, null or untraceable source cases must use `BlockerOnlyMappingHintItemV1`, `source_binding_state=untraceable`, `allowed_effect=blocker_explanation`, and a concrete blocker. They must not be consumed as downstream mapping input.
8. Unknown `manifest_version`, unknown `hint_class`, missing required `source_ref`, stale source, scope mismatch or redaction invalid must fail closed for required downstream mapping input.
9. Source refs must be opaque refs, contract refs, redacted locators, checksums or synthetic examples. Sensitive raw payloads and private implementation details must not be inlined.
10. Future Syvert-owned normalization, taxonomy, wrapper, provider adapter or joint acceptance contracts must be created outside #1199.

## Synthetic example

```yaml
syvert_mapping_hint_manifest:
  identity:
    manifest_id: syvert_mapping_hint_manifest
    manifest_version: v1
    owner_ref: FR-0071.syvert_mapping_hint_manifest.v1
    canonical_issue_ref: "#1199"
    manifest_ref: synthetic://fr-0071/example/local-only
    integration_mode: local_only
    producer_boundary: webenvoy_core_hint_manifest
    consumer_boundary: syvert_optional_consumer
  source_contract_refs:
    - FR-0061.xhs_driver_contract.v1
  hints:
    - hint_id: hint.synthetic.route.search
      hint_class: route_hint
      hint_value_ref: ref://redacted/route/search
      source_binding:
        source_contract_ref: FR-0061.xhs_driver_contract.v1
        source_section: operational
        source_ref: ref://redacted/operation/route-bucket
        source_owner: webenvoy_formal_contract
        scope:
          ability_id: xhs.search
          route_bucket: search
          target_domain: www.xiaohongshu.com
          target_page: search_tab
          run_id: null
          head_sha: null
        freshness: not_applicable
        redaction_state: redacted
      source_binding_state: bound
      mapping_intent: classify_route
      allowed_effect: downstream_mapping_input
      forbidden_effects:
        - syvert_normalized_result_complete
        - resource_taxonomy_complete
        - error_taxonomy_complete
        - provider_adapter_ready
        - jsonrpc_wrapper_ready
        - live_evidence_accepted
        - integration_gate_active
    - hint_id: hint.synthetic.untraceable-source
      hint_class: mapping_gap_hint
      hint_value_ref: null
      source_binding:
        source_contract_ref: null
        source_section: null
        source_ref: null
        source_owner: downstream_owner_required
        blocker_reason: missing_source_ref
      source_binding_state: untraceable
      mapping_intent: explain_gap
      allowed_effect: blocker_explanation
      blockers:
        - missing_source_ref
        - downstream_mapping_owner_required
      forbidden_effects:
        - syvert_normalized_result_complete
        - resource_taxonomy_complete
        - error_taxonomy_complete
        - provider_adapter_ready
        - jsonrpc_wrapper_ready
        - live_evidence_accepted
        - integration_gate_active
  mapping_gaps:
    - gap_id: gap.synthetic.resource-taxonomy
      gap_class: resource_taxonomy_required
      owner: syvert_owned_contract
      webenvoy_default_allowed: false
      required_action: resource_taxonomy_required
  consumer_actions:
    - syvert_normalization_required
    - resource_taxonomy_required
  non_proofs:
    - not_syvert_normalized_result
    - not_syvert_resource_taxonomy
    - not_syvert_error_taxonomy
    - not_provider_adapter
    - not_cli_jsonrpc_wrapper
    - not_live_evidence
    - not_read_write_gate_allow
    - not_integration_gate
  blockers: []
```

## Forbidden fields

The following fields must not appear in v1:

- `normalized`
- `syvert_normalized_result`
- `syvert_resource_type`
- `syvert_error_code`
- `syvert_workflow_state`
- `syvert_project_state`
- `jsonrpc_method`
- `provider_adapter`
- `live_write_commit`
- raw Cookie, token, account identifier, private absolute path, credential-bearing header, full page content, browser profile path or provider private patch payload
