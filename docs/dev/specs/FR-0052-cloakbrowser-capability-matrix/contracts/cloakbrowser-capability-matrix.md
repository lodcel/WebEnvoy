# CloakBrowser Capability Matrix Contract

## Contract owner

- Owner: `#1149` / `FR-0052`
- Matrix id: `cloakbrowser.capability-matrix.v1`
- Input descriptors: `FR-0049`, `FR-0050`, `FR-0051`
- Verification model: `FR-0035`

This contract defines only CloakBrowser capability matrix rows. It does not define descriptor shape, health result schema, runtime status, limitation gate result, launch evidence record, live evidence record or fixture payload.

## Row contract

Each `CloakBrowserCapabilityRow` must contain:

- `provider_id`
- `capability_id`
- `capability_kind`
- `supported_actions`
- `supported_execution_layers`
- `required_runtime_requirements`
- `support_level`
- `verification_threshold`
- `variant_inputs`
- `limitations`
- `verification_sources`
- `evidence_ref_strategy`
- `fail_closed_policy`
- `downstream_owner`

The variant matrices in `spec.md` instantiate these fields by combining the visible matrix table with each provider-specific required-field expansion table. Consumers must treat the combined row as the contract input; no required field may be inferred from descriptor presence alone.

## Provider ids

Allowed values:

- `cloakbrowser.direct`
- `cloakbrowser.persistent`
- `cloakbrowser.cloakserve`

No other provider id is introduced by this contract.

## Capability ids

Allowed values:

- `browser-runtime.launch`
- `page-automation.read`
- `page-automation.write`
- `page-automation.download`
- `provider.diagnose`
- `extension-runtime.bridge`
- `native-bridge.messaging`
- `artifact-passthrough.launch-evidence`
- `artifact-passthrough.final-args-evidence`
- `fingerprint.seed-reproducibility`

Unknown requested capability ids must be handled through `FR-0035` unsupported / fail-closed behavior.

## Variant inputs

Every row must classify these inputs:

```ts
interface CloakBrowserVariantInputs {
  profile:
    | "none"
    | "ephemeral_provider_profile"
    | "persistent_profile_required"
    | "unknown_fail_closed"
  extension:
    | "locator_only"
    | "persistent_extension_required"
    | "unsupported_by_default"
    | "future_owner_required"
  native_messaging:
    | "unsupported"
    | "required_descriptor_input"
    | "future_runtime_attestation_required"
  final_args_evidence:
    | "not_required"
    | "future_fr0058_required"
    | "current_run_fr0058_required"
  fingerprint_seed_evidence:
    | "not_required"
    | "future_fr0059_required"
    | "caller_supplied_fr0059_required"
  environment:
    | "not_required"
    | "future_fr0060_required"
    | "docker_xvfb_doctor_input_allowed"
}
```

Rules:

- `profile=unknown_fail_closed` blocks profile-bound capabilities until a later owner supplies narrower evidence and policy.
- `extension=locator_only` does not prove stable extension identity or runtime bridge readiness.
- `native_messaging=required_descriptor_input` does not prove Native Messaging round trip.
- final args evidence proves input shape only; it does not prove browser honored args.
- fingerprint seed evidence must never expose raw seed, seed hash value or private patch payload.
- Docker / Xvfb doctor input does not prove runtime ready, target tab ready or capability allowed.

## Support levels

Allowed support levels are consumed from `FR-0035.support_state`.

This PR can emit only:

- `unsupported`
- `declared`
- `statically_verified`

Concrete consumer/admission evaluation may derive `blocked` from these rows when required evidence is missing or limitations conflict with the requested capability.

This contract does not emit:

- `health_checked`
- `runtime_attested`
- `runtime_observed`
- `live_evidence_attested`

## Verification threshold

`verification_threshold` is the minimum support state needed before the row may be used for the requested target.

Allowed threshold values consume `FR-0035.support_state` and may include:

- `health_checked` for diagnostic admission only
- `runtime_attested` for runtime/profile/extension/native requirements
- `runtime_observed` for observed page behavior or artifact production
- `live_evidence_attested` when an applicable live evidence gate is in scope

The threshold is a requirement, not current evidence. A row whose `support_level` is lower than its threshold must deny/defer or blocked/deny when admitted.

## Verification sources

Allowed current sources:

- `provider_declaration`
- `static_contract_check`
- `manual_review_attestation`

Future health/runtime/live owners may add accepted sources through their scoped outputs, but those outputs are not defined here.

## Evidence ref strategy

Allowed strategy keys:

- `static_descriptor_ref`
- `capability_matrix_ref`
- `direct_launch_health_ref`
- `persistent_profile_health_ref`
- `native_bridge_doctor_ref`
- `final_args_evidence_ref`
- `fingerprint_seed_policy_ref`
- `docker_xvfb_doctor_ref`
- `limitation_gate_ref`
- `runtime_attestation_ref`
- `runtime_observation_ref`
- `live_evidence_ref`
- `fixture_ref`

Strategy keys are locators for future or current evidence carriers. A strategy key is not evidence availability and must not be treated as pass/fail result by itself.

## Fail-closed requirements

All rows inherit `FR-0035` decision policy. In particular:

- business `read/write/download` must not be allowed from `declared` alone.
- consumer minimum support state higher than the row support level must deny/defer; if already in admission, it must blocked/deny.
- direct Native Messaging must remain `unsupported`.
- cloakserve extension bridge and Native Messaging must remain `unsupported` by default.
- persistent profile, extension and Native Messaging refs must not be treated as health pass or runtime ready.
- final args evidence must fail closed when missing, stale, unredacted or reconstruction unknown.
- fingerprint seed reproducibility must fail closed unless `FR-0059` proves caller-supplied seed policy with redacted refs.
- missing, stale or invalid evidence refs must not be substituted with descriptor presence, runtime ping, bootstrap ack, stub/fake host success or old artifacts.

## Downstream owners

- #1152 owns CloakBrowser limitation gate.
- #1153 owns runtime/evidence convergence.
- #1150 / `FR-0053` owns direct launch health input.
- #1151 / `FR-0054` owns persistent profile health input.
- #1154 / `FR-0057` owns Native Messaging bridge doctor handoff.
- #1155 / `FR-0058` owns final args evidence.
- #1156 / `FR-0059` owns fingerprint seed evidence policy.
- #1157 / `FR-0060` owns Docker / Xvfb doctor input.

This contract gives downstream owners a matrix input; it does not produce their evidence, gates or payloads.
