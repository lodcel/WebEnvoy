# FR-0052 Data Model

## 1. `cloakbrowser_capability_matrix`

`cloakbrowser_capability_matrix` 是 #1149 的 formal matrix carrier。它只承载 CloakBrowser provider variants 的 capability support rows，不承载 descriptor shape、health result、runtime state、limitation gate result、launch evidence、live evidence 或 fixture payload。

核心字段：

- `matrix_id`: `cloakbrowser.capability-matrix.v1`
- `matrix_owner`: `#1149` / `FR-0052`
- `descriptor_inputs`: `FR-0049`, `FR-0050`, `FR-0051`
- `verification_model_input`: `FR-0035`
- `health_and_evidence_inputs`: `FR-0053`, `FR-0054`, `FR-0057`, `FR-0058`, `FR-0059`, `FR-0060`
- `rows`: `CloakBrowserCapabilityRow[]`

## 2. `CloakBrowserCapabilityRow`

Each row expresses one provider variant's static support conclusion for one capability.

字段：

- `provider_id`
- `capability_id`
- `capability_kind`
- `supported_actions`
- `supported_execution_layers`
- `required_runtime_requirements`
- `support_level`
- `minimum_support_state`
- `evidence_policy_requirements`
- `variant_inputs`
- `limitations`
- `verification_sources`
- `evidence_ref_strategy`
- `fail_closed_policy`
- `downstream_owner`

约束：

- `provider_id` 只能来自 `FR-0049`、`FR-0050` 或 `FR-0051`。
- `spec.md` 的 per-variant matrix table、required-field expansion table 与 `variant_inputs` materialization table 共同组成完整 row；consumer 读取 row 时必须同时消费三者。
- `support_level` 消费 `FR-0035.support_state`，不创建新枚举。
- `minimum_support_state` 消费 `FR-0035.support_state`，且只能是机器枚举，不得混入 prose、policy refs 或 `N/A`。
- `evidence_policy_requirements` 承载 runtime、health、FR-0058、FR-0059、Docker / Xvfb、limitation gate、artifact 等额外策略要求，不是 support-state enum；row cell 只能是逗号分隔 token 或 unsupported row 的 `none`。
- `verification_sources` 消费 `FR-0035.verification_source`，不创建 health schema。
- `evidence_ref_strategy` 是 locator strategy，不是 evidence record。
- `downstream_owner` 只能指向后续 owner，不表示对应输出已存在。

## 3. Variant input model

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

Provider-level minimum interpretation:

- `cloakbrowser.direct`: `profile=ephemeral_provider_profile`, `extension=locator_only`, `native_messaging=unsupported`.
- `cloakbrowser.persistent`: `profile=persistent_profile_required`, `extension=persistent_extension_required`, `native_messaging=required_descriptor_input`.
- `cloakbrowser.cloakserve`: `profile=unknown_fail_closed`, `extension=unsupported_by_default`, `native_messaging=unsupported`.

Provider-level defaults are insufficient to materialize a row. `spec.md` must still define row-specific `variant_inputs` for every capability so final args, fingerprint seed, environment and limitation dispositions are deterministic per row.

Final args and fingerprint seed inputs remain evidence strategies until #1155/#1156 or a later accepted evidence owner supplies current, redacted and scoped artifacts.

## 4. Evidence policy requirements model

`evidence_policy_requirements` is a structured set of refs/policies required before a row can satisfy its `minimum_support_state`.

Allowed values:

- `none`
- `runtime_attestation_ref`
- `runtime_observation_ref`
- `target_tab_binding_ref`
- `risk_gate_ref`
- `live_evidence_ref`
- `direct_launch_health_ref`
- `persistent_profile_health_ref`
- `extension_identity_ref`
- `extension_runtime_ref`
- `native_bridge_doctor_ref`
- `native_messaging_round_trip_ref`
- `final_args_evidence_ref`
- `fingerprint_seed_policy_ref`
- `docker_xvfb_doctor_ref`
- `limitation_gate_ref`
- `artifact_policy_ref`
- `download_artifact_ref`
- `launch_evidence_ref`
- `redaction_record_ref`
- `artifact_identity_ref`

Rules:

- These values are evidence/policy requirements, not proof that evidence exists.
- Row cells must contain only comma-separated tokens from the allowed list. `none` is allowed only when the row is unsupported and must deny.
- They must not be encoded in `minimum_support_state`.
- A missing, stale, invalid or redaction-invalid required policy ref must fail closed when the row enters admission.

## 5. Support level lifecycle

This suite's lifecycle stops at static matrix freeze:

- `unsupported`: descriptor explicitly lacks the required capability, such as direct Native Messaging or cloakserve extension bridge.
- `declared`: capability only exists as future evidence slot, provider declaration or experimental route.
- `statically_verified`: descriptor fields, refs, limitations and matrix rows are statically consistent.
- `blocked`: concrete consumer/admission hits `FR-0035` fail-closed conditions.

This suite does not produce:

- `health_checked`
- `runtime_attested`
- `runtime_observed`
- `live_evidence_attested`

Future owner outputs may provide those sources, but they must enter the consuming flow through their own issue / PR.

## 6. Evidence ref strategy

Allowed evidence strategy keys:

- `static_descriptor_ref`: points to `FR-0049`, `FR-0050` or `FR-0051`.
- `capability_matrix_ref`: points to this `FR-0052`.
- `direct_launch_health_ref`: future or accepted `FR-0053` output.
- `persistent_profile_health_ref`: future or accepted `FR-0054` output.
- `native_bridge_doctor_ref`: future or accepted `FR-0057` output.
- `final_args_evidence_ref`: future or accepted `FR-0058` output.
- `fingerprint_seed_policy_ref`: future or accepted `FR-0059` output.
- `docker_xvfb_doctor_ref`: future or accepted `FR-0060` output.
- `limitation_gate_ref`: future #1152 output.
- `runtime_attestation_ref`, `runtime_observation_ref`, `live_evidence_ref`: future #1153 or scoped runtime/live owner output.
- `fixture_ref`: future fixture owner output.

禁止：

- 内联完整日志、页面内容、Cookie、Token、账号凭据、native host secret、provider broker credential、raw local path、raw argv、raw seed、seed hash value、private patch payload 或 sensitive path。
- 用 `N/A`、old artifact、runtime ping、bootstrap ack、stub/fake host 或 descriptor presence 代替 required evidence。
- 把 future ref slot 解释为 evidence passed。

## 7. Fail-closed policy

All matrix rows inherit `FR-0035` default decision policy:

- `allow_declared_only_for_business=false`
- `allow_defer_for_business=false`
- `fail_closed_on_blocking_reasons=true`
- `fail_closed_on_unknown_limitation=true`
- `fail_closed_on_invalid_or_stale_evidence_ref=true`
- `degraded_state_policy=explicit_only`
- `manual_review_policy=confirm_existing_evidence_only`

Business `read/write/download` default admission must not accept `declared`. When the consumer minimum support state is higher than this matrix's current support level, it must deny/defer; if the record has entered admission, it must blocked/deny.

## 8. Ownership boundaries

| Data | Owner | Defined by this FR |
|---|---|---|
| direct descriptor | FR-0049 / #1146 | No, consumed only |
| persistent descriptor | FR-0050 / #1147 | No, consumed only |
| cloakserve descriptor | FR-0051 / #1148 | No, consumed only |
| support state and decision policy | FR-0035 / #1124 | No, consumed only |
| CloakBrowser capability rows | FR-0052 / #1149 | Yes |
| direct launch health | FR-0053 / #1150 | No |
| persistent profile health | FR-0054 / #1151 | No |
| limitation gate | #1152 | No |
| runtime/evidence convergence | #1153 | No |
| Native Messaging bridge doctor handoff | FR-0057 / #1154 | No |
| final args evidence | FR-0058 / #1155 | No |
| fingerprint seed evidence policy | FR-0059 / #1156 | No |
| Docker / Xvfb doctor | FR-0060 / #1157 | No |
