# official Chrome Capability Matrix Contract

## Contract owner

- Owner: `#1139` / `FR-0044`
- Matrix id: `official-chrome.capability-matrix.v1`
- Input descriptors: `FR-0042`, `FR-0043`
- Verification model: `FR-0035`

This contract defines only the official Chrome capability matrix rows. It does not define descriptor shape, health result schema, runtime status, launch evidence record, live evidence record or fixture payload.

## Row contract

Each `OfficialChromeCapabilityRow` must contain:

- `provider_id`
- `capability_id`
- `capability_kind`
- `supported_actions`
- `supported_execution_layers`
- `required_runtime_requirements`
- `support_level`
- `limitations`
- `verification_sources`
- `evidence_ref_strategy`
- `fail_closed_policy`
- `downstream_owner`

The direct and persistent matrices in `spec.md` instantiate these fields by combining the visible matrix row (`provider_id`, `capability_id`, `support_level`, `limitations`, `verification_sources`, `evidence_ref_strategy`) with the provider-specific required-field expansion table. Consumers must treat the combined row as the contract input; no required field may be inferred from descriptor presence alone.

## Provider ids

Allowed values:

- `official-chrome.direct`
- `official-chrome.persistent`

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

Unknown requested capability ids must be handled through `FR-0035` unsupported / fail-closed behavior.

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

## Verification sources

Allowed current sources:

- `provider_declaration`
- `static_contract_check`
- `manual_review_attestation`

Future health/runtime/live owners may add their own accepted sources through their scoped outputs, but those outputs are not defined here.

## Evidence ref strategy

Allowed strategy keys:

- `static_descriptor_ref`
- `capability_matrix_ref`
- `health_result_ref`
- `launch_evidence_ref`
- `fixture_ref`

Strategy keys are locators for future or current evidence carriers. A strategy key is not evidence availability and must not be treated as pass/fail result by itself.

## Fail-closed requirements

All rows inherit `FR-0035` decision policy. In particular:

- business `read/write/download` must not be allowed from `declared` alone.
- consumer minimum support state higher than the row support level must deny/defer; if already in admission, it must blocked/deny.
- direct `extension-runtime.bridge` and `native-bridge.messaging` must remain `unsupported`.
- persistent profile, extension and native messaging refs must not be treated as health pass or runtime ready.
- missing, stale or invalid evidence refs must not be substituted with descriptor presence, runtime ping, bootstrap ack, stub/fake host success or old artifacts.

## Downstream owners

- #1140/#1141/#1142 own health checks and consume `FR-0038`.
- #1143 owns launch evidence and consumes `FR-0040` / `FR-0041`.
- #1144 owns official Chrome fixtures.

This contract gives downstream owners a matrix input; it does not produce their evidence or payloads.
