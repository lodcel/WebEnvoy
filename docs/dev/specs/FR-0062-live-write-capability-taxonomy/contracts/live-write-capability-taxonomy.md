# Live-Write Capability Taxonomy Contract

## Contract owner

- Owner: `#1174` / `FR-0062`
- Contract id: `live-write-capability-taxonomy.v1`
- Scope: capability levels, gate vocabulary, downstream ownership and fail-closed behavior

This contract defines only taxonomy terms. It does not define runtime implementation, provider selection, operator unlock storage, account safety storage, live evidence record shape, publish behavior or release closeout.

## Capability levels

Allowed values:

- `read_only`
- `write_admit`
- `write_prepare`
- `live_write_commit`

Ordering:

```text
read_only < write_admit < write_prepare < live_write_commit
```

Rules:

- Consumers must not introduce aliases such as `write_ready`, `write_allowed`, `publish_ready`, `commit_ready` or `live_write`.
- Unknown values must return `decision=deny` with `blocking_reasons=["unknown_capability_level"]`.
- `live_write_commit` is locked by default and cannot be inferred from lower levels.

## Gate input

```ts
interface LiveWriteCapabilityGateInputV1 {
  taxonomy_version: "v1";
  requested_capability_level:
    | "read_only"
    | "write_admit"
    | "write_prepare"
    | "live_write_commit";
  maximum_capability_level:
    | "read_only"
    | "write_admit"
    | "write_prepare"
    | "live_write_commit";
  minimum_required_level:
    | "read_only"
    | "write_admit"
    | "write_prepare"
    | "live_write_commit";
  capability_owner:
    | "#1174"
    | "#1178"
    | "#1179"
    | "#1180"
    | "#1211"
    | "downstream_owner";
  workflow_ref: string;
  target_scope_ref: string;
  provider_requirement_ref: string | null;
  operator_unlock_ref: string | null;
  default_commit_lock_ref: string | null;
  account_safety_ref: string | null;
  runtime_target_binding_ref: string | null;
  anti_detection_gate_ref: string | null;
  live_evidence_gate_ref: string | null;
  evidence_refs: string[];
}
```

Rules:

- `workflow_ref` and `target_scope_ref` must be non-empty for `write_admit`, `write_prepare` and `live_write_commit`.
- `provider_requirement_ref` is required for `write_admit` or higher.
- `operator_unlock_ref`, `default_commit_lock_ref`, `account_safety_ref`, `runtime_target_binding_ref`, `anti_detection_gate_ref` and `live_evidence_gate_ref` are required before `live_write_commit` can be allowed by a downstream gate.
- `evidence_refs` are locators only; they must not inline secrets, account identifiers, private paths, page content or live artifact payloads.

## Gate output

```ts
interface LiveWriteCapabilityGateResultV1 {
  taxonomy_version: "v1";
  requested_capability_level:
    | "read_only"
    | "write_admit"
    | "write_prepare"
    | "live_write_commit";
  effective_capability_level:
    | "read_only"
    | "write_admit"
    | "write_prepare"
    | "live_write_commit";
  gate_status:
    | "not_applicable"
    | "eligible"
    | "deferred"
    | "blocked"
    | "locked"
    | "ready_for_downstream_gate";
  decision: "allow" | "deny" | "defer";
  blocking_reasons: LiveWriteCapabilityBlockingReasonV1[];
  downstream_owner:
    | "#1178"
    | "#1179"
    | "#1180"
    | "#1211"
    | "runtime_owner"
    | "live_evidence_owner"
    | "release_gate_owner"
    | "none";
  evidence_refs_consumed: string[];
  verified_at: string | "N/A";
}
```

Rules:

- `effective_capability_level` must not exceed `maximum_capability_level`.
- If `blocking_reasons` is non-empty, `decision` must be `deny` or `defer`.
- If `requested_capability_level=live_write_commit` and a commit lock blocker exists, `gate_status` must be `locked` or `blocked`.
- `verified_at=N/A` is allowed in formal spec samples only. Real gate outputs must use a concrete timestamp owned by the downstream evaluator.

## Blocking reasons

Allowed values:

- `unknown_capability_level`
- `capability_level_escalation_not_allowed`
- `owner_missing`
- `provider_requirement_missing`
- `operator_unlock_missing`
- `default_commit_lock_active`
- `account_safety_unknown`
- `runtime_target_binding_missing`
- `anti_detection_gate_missing`
- `live_evidence_missing`
- `stub_or_fake_host_evidence`
- `control_plane_only_signal`
- `historical_or_stale_evidence`
- `scope_mismatch`
- `downstream_owner_required`

Rules:

- `stub_or_fake_host_evidence`, `control_plane_only_signal` and `historical_or_stale_evidence` cannot satisfy `live_write_commit`.
- `default_commit_lock_active` always takes precedence over non-blocking readiness signals.
- `downstream_owner_required` means FR-0062 has finished taxonomy classification and another owner must decide the next gate.

## Downstream owner map

| Level / gate concern | Owning issue | Required disposition |
|---|---|---|
| Taxonomy terms | #1174 | Frozen by this contract |
| Operator unlock | #1178 | Required for `live_write_commit` |
| Provider requirements for `xhs.creator_publish.admit` | #1179 | Required for `write_admit` and higher |
| Default commit lock | #1180 | Active by default until explicitly released |
| Release gate matrix | #1211 | Consumes all levels and blocking reasons |

Consumers must not report `live_write_commit` as available unless every required downstream owner has produced accepted current evidence for the exact scope.
