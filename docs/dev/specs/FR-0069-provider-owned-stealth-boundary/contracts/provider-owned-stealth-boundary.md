# Provider-Owned Stealth Boundary Contract

## 1. `ProviderOwnedStealthBoundaryV1`

```ts
interface ProviderOwnedStealthBoundaryV1 {
  boundary_id: "provider_owned_stealth_boundary"
  boundary_version: "v1"
  owner_ref: "#1182" | "FR-0069"
  provider_contract_ref: string
  provider_id: string
  provider_mode: ProviderModeRef
  owned_domains: ProviderOwnedStealthDomain[]
  not_owned_by_webenvoy: WebEnvoyNonOwnedStealthDomain[]
  disclosure_boundary: ProviderStealthDisclosureBoundary
  allowed_webenvoy_consumption: ProviderStealthConsumptionRef[]
  non_proofs: ProviderStealthNonProof[]
  blocking_reasons: ProviderStealthBlockingReason[]
  handoff_refs: ProviderStealthHandoffRefs
}
```

约束：

- `boundary_version` 当前只允许 `v1`。
- `provider_contract_ref` 必须指向 `FR-0033.browser_provider_contract` 或后续正式 provider contract ref。
- 该对象是 boundary declaration，不是 provider registry row、doctor result、runtime status、live evidence record、risk hint record 或 read/write gate decision。
- Consumer 遇到 unknown required field、unknown enum 或影响目标 capability 的 unknown state 时，必须 fail-closed。

## 2. Provider mode ref

```ts
type ProviderModeRef =
  | "core_managed"
  | "external_managed"
  | "adapter_only"
  | "diagnostic_only"
```

约束：

- 枚举复用 `FR-0033.ProviderMode`。
- `diagnostic_only` 不得被选择为业务执行 provider。
- `provider_mode` 只表达 provider lifecycle / adapter relation，不证明 stealth pass、risk pass 或 live evidence accepted。

## 3. Provider-owned stealth domains

```ts
type ProviderOwnedStealthDomain =
  | "browser_binary_patch"
  | "engine_or_kernel_fingerprint_patch"
  | "js_fingerprint_surface_patch"
  | "worker_fingerprint_patch"
  | "canvas_audio_webgl_font_patch"
  | "stealth_parameter_generation"
  | "fingerprint_seed_application"
  | "provider_private_patch_validation"
  | "managed_browser_runtime_cloak"
  | "provider_network_stack_shape_when_provider_managed"
  | "provider_behavior_masking_when_declared"
```

约束：

- 这些 domain 的实现细节属于 provider/provider adapter。
- WebEnvoy core 可以消费 domain presence、verification level、limitations 与 redacted evidence refs。
- Domain presence 不证明风险门禁通过，不证明真实平台风控通过，不证明 live evidence accepted。
- Unknown domain 在影响目标 capability 时必须 fail-closed 或通过后续 formal spec 扩展。

## 4. WebEnvoy non-owned stealth domains

```ts
type WebEnvoyNonOwnedStealthDomain =
  | "browser_patch_implementation"
  | "fingerprint_patch_implementation"
  | "stealth_parameter_raw_values"
  | "fingerprint_seed_derivation"
  | "private_patch_correctness"
  | "driver_internal_state"
  | "managed_browser_internals"
  | "target_platform_bypass_success"
```

约束：

- WebEnvoy core 不实现、不持久化、不公开这些 domain 的私有内容。
- `target_platform_bypass_success` 不是 provider-owned declaration 可自证的结论；后续 #1183/#1188 必须用 WebEnvoy-owned risk/evidence gate 消费。

## 5. Disclosure boundary

```ts
interface ProviderStealthDisclosureBoundary {
  default_policy: "provider_private"
  allowed_public_fields: ProviderStealthAllowedDisclosure[]
  forbidden_fields: ProviderStealthForbiddenDisclosure[]
  redaction_policy_refs: string[]
}

type ProviderStealthAllowedDisclosure =
  | "provider_id"
  | "provider_contract_ref"
  | "provider_mode"
  | "owned_domain_enum"
  | "verification_level"
  | "limitation_ref"
  | "redacted_evidence_ref"
  | "blocking_reason"
  | "handoff_owner"

type ProviderStealthForbiddenDisclosure =
  | "raw_fingerprint_seed"
  | "seed_preview_or_reversible_mask"
  | "private_patch_payload"
  | "private_patch_manifest_body"
  | "stealth_parameter_raw_values"
  | "browser_binary_diff"
  | "hook_implementation_body"
  | "driver_internal_state"
  | "fingerprint_internals_snapshot"
  | "worker_or_kernel_patch_details"
  | "account_or_profile_secret"
  | "cookie_token_proxy_or_page_content"
```

约束：

- `redaction_policy_refs` 必须至少能引用 `FR-0040` / `FR-0041`；CloakBrowser seed-specific 消费应引用 `FR-0059`。
- Any forbidden disclosure invalidates the evidence and must emit blocking reason.

## 6. Allowed WebEnvoy consumption

```ts
interface ProviderStealthConsumptionRef {
  ref_kind:
    | "provider_contract_ref"
    | "provider_identity"
    | "provider_mode"
    | "owned_domain"
    | "limitation_ref"
    | "verification_level"
    | "redacted_evidence_ref"
    | "freshness_ref"
    | "scope_binding"
    | "blocking_reason"
  ref: string
  sensitivity: "public" | "internal" | "sensitive" | "secret"
  redaction_state: "not_required" | "redacted" | "opaque_ref" | "invalid" | "unknown"
}
```

约束：

- `sensitivity=secret` 不得出现在 public surfaces as raw value；只能通过 opaque/ref 形式出现。
- `redaction_state=invalid|unknown` 命中 required evidence 时必须 fail-closed。
- `verification_level` 复用 `FR-0033`，且 `declared_only|doctor_checked` 不能替代 WebEnvoy-owned risk evidence。

## 7. Non-proofs

```ts
type ProviderStealthNonProof =
  | "provider_stealth_declared"
  | "provider_contract_present"
  | "provider_descriptor_present"
  | "provider_capability_matrix_present"
  | "provider_registry_row_present"
  | "provider_doctor_pass"
  | "provider_health_pass"
  | "runtime_ping"
  | "runtime_bootstrap_ack"
  | "fingerprint_seed_ref_present"
  | "private_patch_ref_present"
  | "final_args_ref_present"
  | "managed_browser_present"
  | "headless_forbidden"
  | "cdp_or_playwright_supported"
  | "os_input_supported"
  | "historical_artifact"
  | "stub_or_fake_host"
  | "control_plane_only_signal"
```

约束：

- Non-proof may be logged as context but cannot produce risk allow, anti-detection pass, live evidence accepted or read/write gate allow.

## 8. Blocking reasons

```ts
type ProviderStealthBlockingReason =
  | "provider_stealth_boundary_missing"
  | "provider_stealth_boundary_unknown"
  | "provider_stealth_scope_mismatch"
  | "provider_stealth_evidence_missing"
  | "provider_stealth_evidence_stale"
  | "provider_stealth_evidence_redaction_invalid"
  | "provider_private_patch_disclosed"
  | "provider_private_patch_required_but_unverified"
  | "provider_fingerprint_seed_policy_missing"
  | "provider_fingerprint_seed_disclosed"
  | "provider_stealth_doctor_only"
  | "provider_stealth_declared_only"
  | "provider_stealth_non_proof"
  | "webenvoy_risk_evidence_required"
  | "risk_hint_consumer_required"
  | "unsupported_provider_stealth_domain"
```

约束：

- `webenvoy_risk_evidence_required` is a handoff blocker to #1183, not a #1182-defined risk evidence result.
- `risk_hint_consumer_required` is a handoff blocker to #1188, not a #1182-defined read/write gate result.

## 9. Handoff refs

```ts
interface ProviderStealthHandoffRefs {
  provider_stealth_owner: "#1182" | "FR-0069"
  webenvoy_risk_evidence_owner: "#1183"
  risk_hint_consumer_owner: "#1188"
  parent_phase_ref: "#1118"
}
```

约束：

- #1183 may consume this boundary but must not redefine provider private patch schema.
- #1188 must consume #1183 risk hints and must not infer gate allow from provider stealth presence.
