# Target Binding State Machine Contract

## Contract version

- `target_binding_state_machine.version = v1`
- Canonical suite: `FR-0063-target-binding-state-machine`
- Canonical issue: `#1161`
- Consumes: `FR-0061.xhs_driver_contract.v1`

## State enum

Allowed values:

- `unbound`
- `candidate_found`
- `url_matched`
- `dom_ready`
- `runtime_state_detected`
- `extension_bridge_confirmed`
- `bound`
- `stale`
- `lost`

Unknown values must fail closed with `blocking_reasons=["unknown_state"]`.

## Schema

```ts
type TargetBindingStateV1 =
  | "unbound"
  | "candidate_found"
  | "url_matched"
  | "dom_ready"
  | "runtime_state_detected"
  | "extension_bridge_confirmed"
  | "bound"
  | "stale"
  | "lost";

type TargetBindingBlockingReasonV1 =
  | "unknown_state"
  | "invalid_transition"
  | "missing_candidate"
  | "url_scope_mismatch"
  | "dom_observation_missing"
  | "runtime_state_missing"
  | "extension_bridge_missing"
  | "candidate_identity_conflict"
  | "source_owner_mismatch"
  | "redaction_invalid"
  | "freshness_unknown"
  | "historical_or_stale_evidence"
  | "bridge_owner_mismatch"
  | "forbidden_write_scope"
  | "syvert_boundary_violation"
  | "live_evidence_required_downstream"
  | "signed_continuity_required_downstream"
  | "page_runtime_ready_required_downstream";

interface TargetBindingStateMachineIdentityV1 {
  state_machine_id: "target_binding_state_machine";
  state_machine_version: "v1";
  platform: "xhs";
  owner_ref: "FR-0063.target_binding_state_machine.v1";
  consumes_contract_ref: "FR-0061.xhs_driver_contract.v1";
  canonical_issue_ref: "#1161";
}

interface TargetBindingObservationInputV1 {
  target_candidate_ref: string | null;
  target_domain: "www.xiaohongshu.com" | "unknown";
  target_page_class:
    | "search_tab"
    | "explore_detail_tab"
    | "profile_tab"
    | "unknown";
  normalized_url_ref: string | null;
  route_bucket: "search" | "detail" | "user_home" | "unknown";
  dom_observation_ref: string | null;
  runtime_state_ref: string | null;
  extension_bridge_ref: string | null;
  provider_runtime_ref: string | null;
  run_id: string;
  operation_id: string;
  freshness_scope:
    | "current_run"
    | "current_pr_head"
    | "historical_background"
    | "unknown"
    | "not_applicable";
  redaction_state:
    | "redacted"
    | "redaction_required"
    | "not_required"
    | "policy_missing"
    | "invalid";
}

interface TargetBindingTransitionEvidenceV1 {
  transition_id: string;
  from_state: TargetBindingStateV1;
  to_state: TargetBindingStateV1;
  transition_reason:
    | "candidate_discovered"
    | "url_scope_matched"
    | "dom_observed"
    | "runtime_state_observed"
    | "extension_bridge_observed"
    | "evidence_converged"
    | "freshness_expired"
    | "navigation_changed"
    | "candidate_lost"
    | "source_owner_mismatch"
    | "identity_conflict"
    | "reset";
  observed_at: string | "N/A";
  run_id: string;
  target_candidate_ref: string | null;
  evidence_refs: string[];
  freshness_scope: "current_run" | "historical_background" | "unknown";
  redaction_state:
    | "redacted"
    | "redaction_required"
    | "not_required"
    | "policy_missing"
    | "invalid";
  source_owner:
    | "target_binding_state_machine"
    | "runtime_owner"
    | "provider_owner"
    | "manual_review"
    | "downstream_owner";
}

interface TargetBindingSnapshotV1 {
  snapshot_version: "v1";
  state: TargetBindingStateV1;
  state_entered_at: string | "N/A";
  target_candidate_ref: string | null;
  target_scope: {
    target_domain: "www.xiaohongshu.com" | "unknown";
    target_page_class:
      | "search_tab"
      | "explore_detail_tab"
      | "profile_tab"
      | "unknown";
  };
  route_bucket: "search" | "detail" | "user_home" | "unknown";
  run_id: string;
  operation_id: string;
  evidence_refs: {
    candidate_ref: string | null;
    url_match_ref: string | null;
    dom_observation_ref: string | null;
    runtime_state_ref: string | null;
    extension_bridge_ref: string | null;
    transition_refs: string[];
  };
  freshness_scope:
    | "current_run"
    | "current_pr_head"
    | "historical_background"
    | "unknown"
    | "not_applicable";
  blocking_reasons: TargetBindingBlockingReasonV1[];
  non_proofs: Array<
    | "page_ready"
    | "runtime_ready"
    | "signed_continuity"
    | "read_success"
    | "live_evidence_accepted"
    | "provider_capability_allowed"
    | "write_enabled"
  >;
  downstream_handoff: {
    page_runtime_ready_required: boolean;
    signed_continuity_required: boolean;
    live_evidence_required: boolean;
    owner_refs: Array<"#1162" | "#1171" | "downstream_owner">;
  };
}
```

## Normative rules

1. `bound` requires current-run evidence for candidate, URL, DOM, runtime state and extension bridge refs.
2. `bound` is only target binding pass input. It does not prove page ready, runtime ready, signed continuity, read success, provider capability, live evidence or write enablement.
3. Non-bound states must include at least one blocking reason when consumed by a required target binding consumer.
4. `stale` and `lost` must not be promoted to `bound`; consumers must restart discovery and collect fresh evidence.
5. Historical evidence, same-head old artifact, old run bridge ack or old DOM observation cannot satisfy current-run `bound`.
6. Unknown state, invalid transition, source owner mismatch, redaction invalid or unsupported enum must fail closed.
7. #1162 owns page/runtime ready semantics. This contract only hands off target binding snapshot and diagnostic refs.
8. #1171 owns signed continuity semantics. This contract only hands off unsigned snapshot and transition evidence.
9. FR-0062 live-write capability remains locked by default; `bound` must not enable `live_write_commit`.

## Allowed transition table

| from | to |
|---|---|
| `unbound` | `candidate_found` |
| `candidate_found` | `url_matched`, `stale`, `lost` |
| `url_matched` | `dom_ready`, `stale`, `lost` |
| `dom_ready` | `runtime_state_detected`, `stale`, `lost` |
| `runtime_state_detected` | `extension_bridge_confirmed`, `stale`, `lost` |
| `extension_bridge_confirmed` | `bound`, `stale`, `lost` |
| `bound` | `stale`, `lost` |
| `stale` | `candidate_found`, `unbound` |
| `lost` | `unbound` |

Any transition not listed is invalid unless a later formal owner extends this contract.

## Forbidden fields and claims

The following fields or claims must not appear in v1 target binding payloads:

- `normalized`
- `syvert_resource_type`
- `syvert_error_code`
- `live_write_commit`
- `publish_result`
- `jsonrpc_method`
- `page_ready=true`
- `runtime_ready=true`
- `signed_continuity=true`
- `live_evidence_accepted=true`
- raw Cookie, token, account identifier, browser profile path, credential-bearing header, private URL, private absolute path, full page content or secret-bearing artifact payload

Presence of a forbidden field or claim is a contract violation and must block the affected consumer.
