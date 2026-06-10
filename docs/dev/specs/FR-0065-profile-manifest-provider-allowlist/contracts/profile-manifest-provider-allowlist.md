# Profile Manifest Provider Allowlist Contract

## Contract owner

- Owner: `#1175` / `FR-0065`
- Contract id: `profile-manifest-provider-allowlist.v1`
- Scope: profile-owned allowed providers, workflow/capability scope, secret refs and fail-closed admission evaluation

This contract only defines the profile manifest allowlist lane. It does not define runtime implementation, profile storage, secret store behavior, provider requirement pass, default lock release, operator unlock, live evidence record shape, publish behavior or release closeout.

## Profile manifest

```ts
interface ProfileManifestProviderAllowlistV1 {
  schema_version: "profile-manifest-provider-allowlist.v1";
  manifest_id: string;
  canonical_issue_ref: "#1175";
  profile_ref: string;
  profile_scope_ref: string;
  manifest_version: string;
  owner_ref: string;
  head_sha: string;
  allowed_providers: AllowedProfileProviderEntryV1[];
  secret_refs: ProfileManifestSecretRefV1[];
  evidence_refs: ProfileManifestEvidenceRefsV1;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}
```

Rules:

- `profile_ref` and `profile_scope_ref` must be logical / opaque refs. They must not contain raw private paths, account identifiers, cookies, tokens or storage contents.
- `allowed_providers` must be non-empty before `write_admit` or higher can be evaluated for that profile.
- `secret_refs` are locators only and must follow FR-0041 / #1181 redaction semantics.
- `revoked_at !== null` invalidates the manifest.
- `expires_at` must be later than evaluation time.

## Allowed provider entry

```ts
interface AllowedProfileProviderEntryV1 {
  provider_id: string;
  provider_contract_ref: string;
  provider_family:
    | "official_chrome"
    | "chromium_compatible"
    | "managed_browser_provider"
    | "custom_provider";
  provider_mode:
    | "core_managed"
    | "external_managed"
    | "adapter_only"
    | "diagnostic_only";
  allowed_workflow_refs: string[];
  maximum_capability_level:
    | "read_only"
    | "write_admit"
    | "write_prepare"
    | "live_write_commit";
  allowed_target_domains: string[];
  allowed_target_pages: string[];
  required_secret_kinds: ProfileManifestSecretKindV1[];
  required_provider_requirement_ref: string;
  minimum_verification_level:
    | "declared_only"
    | "static_checked"
    | "doctor_checked"
    | "runtime_attested"
    | "live_evidence_attested";
  risk_constraints: string[];
  evidence_refs: string[];
}
```

Rules:

- Provider identity, family, mode and verification terms consume FR-0033.
- Capability levels consume FR-0062; unknown or alias levels must fail closed.
- `diagnostic_only` provider entries cannot satisfy business write admission.
- `required_provider_requirement_ref` is a locator. It does not prove #1179 or an equivalent downstream provider requirement passed.
- `maximum_capability_level=live_write_commit` does not unlock commit. It only declares the maximum manifest scope that downstream gates may consider.

## Secret refs

```ts
type ProfileManifestSecretKindV1 =
  | "profile_storage_secret"
  | "provider_auth_secret"
  | "proxy_credential"
  | "fingerprint_seed"
  | "native_messaging_secret"
  | "extension_private_payload"
  | "account_auth_material";

interface ProfileManifestSecretRefV1 {
  secret_kind: ProfileManifestSecretKindV1;
  secret_ref: string;
  locator_kind: "secret_handle" | "private_locator" | "public_locator";
  redaction_state:
    | "redacted"
    | "redaction_required"
    | "not_required"
    | "policy_missing"
    | "invalid";
  scope_ref: string;
  owner_ref: string;
  expires_at: string;
}
```

Rules:

- Credentials, cookies, tokens, storage secrets, proxy secrets, fingerprint seeds and provider private payloads must use `secret_handle` or a redacted/private locator.
- `redaction_required`, `policy_missing` and `invalid` cannot satisfy required admission evidence.
- `not_required` is invalid for secret-bearing kinds unless a later policy explicitly allows it.
- Secret refs must match the requested profile, provider, workflow and target scope.

## Evidence refs

```ts
interface ProfileManifestEvidenceRefsV1 {
  manifest_source_ref: string;
  provider_contract_refs: string[];
  secret_policy_ref: string;
  redaction_policy_ref: string;
  owner_attestation_ref: string;
}
```

Rules:

- Evidence refs are locators only. They must not inline secrets, account identifiers, cookies, tokens, private profile paths, page content, media content or live artifact payloads.
- `redaction_policy_ref` should point to FR-0041 / #1181-compatible policy or downstream implementation evidence.
- Missing required evidence refs return `evidence_ref_missing`.

## Evaluation input

```ts
interface ProfileManifestAllowlistEvaluationInputV1 {
  schema_version: "profile-manifest-provider-allowlist.v1";
  requested_profile_ref: string;
  requested_provider_id: string;
  requested_provider_contract_ref: string;
  requested_workflow_ref: string;
  requested_capability_level:
    | "read_only"
    | "write_admit"
    | "write_prepare"
    | "live_write_commit";
  requested_target_domain: string;
  requested_target_page: string;
  requested_required_secret_kinds: ProfileManifestSecretKindV1[];
  requested_provider_requirement_ref: string;
  requested_head_sha: string;
  profile_manifest_provider_allowlist: ProfileManifestProviderAllowlistV1 | null;
  evaluated_at: string;
}
```

Rules:

- Missing `profile_manifest_provider_allowlist` returns `status=missing_manifest`, `decision=deny`.
- Requested workflow, capability level, provider contract, target domain and target page must match one allowed provider entry.
- Required secret kinds must all have valid matching secret refs.
- Real evaluations must use concrete `evaluated_at`. Formal examples may use `N/A` only outside real gate outputs.

## Evaluation result

```ts
interface ProfileManifestAllowlistEvaluationResultV1 {
  schema_version: "profile-manifest-provider-allowlist.v1";
  status:
    | "not_requested"
    | "missing_manifest"
    | "provider_not_allowed"
    | "workflow_not_allowed"
    | "target_scope_mismatch"
    | "capability_not_allowed"
    | "provider_contract_mismatch"
    | "secret_ref_missing"
    | "secret_ref_invalid"
    | "redaction_invalid"
    | "manifest_expired"
    | "manifest_revoked"
    | "head_mismatch"
    | "accepted";
  decision: "allow" | "deny" | "defer";
  blocking_reasons: ProfileManifestAllowlistBlockingReasonV1[];
  profile_manifest_ref: string | null;
  provider_entry_ref: string | null;
  secret_refs_consumed: string[];
  evidence_refs_consumed: string[];
  evaluated_at: string;
  downstream_owner:
    | "#1179"
    | "#1180"
    | "#1211"
    | "runtime_owner"
    | "live_evidence_owner"
    | "none";
}
```

Rules:

- `decision=allow` is valid only when `status=accepted` and `blocking_reasons=[]`.
- `decision=allow` clears only the profile manifest allowlist blocker.
- If `blocking_reasons` is non-empty, `decision` must be `deny` or `defer`.
- Downstream owners must still evaluate provider requirements, default lock, operator unlock, account safety, runtime target binding, anti-detection gate and live evidence before any commit.

## Blocking reasons

```ts
type ProfileManifestAllowlistBlockingReasonV1 =
  | "profile_manifest_missing"
  | "profile_ref_mismatch"
  | "provider_not_allowed"
  | "provider_contract_ref_missing"
  | "provider_contract_ref_mismatch"
  | "provider_requirement_ref_missing"
  | "workflow_not_allowed"
  | "target_scope_mismatch"
  | "capability_level_unknown"
  | "capability_not_allowed"
  | "secret_ref_missing"
  | "secret_ref_scope_mismatch"
  | "secret_ref_expired"
  | "secret_redaction_invalid"
  | "raw_secret_present"
  | "manifest_expired"
  | "manifest_revoked"
  | "manifest_head_mismatch"
  | "evidence_ref_missing"
  | "downstream_owner_required";
```

Rules:

- `raw_secret_present` is always blocking.
- Unknown capability levels and provider ids are blocking.
- `downstream_owner_required` means FR-0065 finished profile manifest evaluation and another owner must decide the next gate.

## Minimum consumable examples

These examples are synthetic and redacted. They are not live evidence, do not identify a real account or profile, and do not enable `live_write_commit`.

### Accepted manifest example

```json
{
  "schema_version": "profile-manifest-provider-allowlist.v1",
  "manifest_id": "profile-manifest/redacted-20260611-001",
  "canonical_issue_ref": "#1175",
  "profile_ref": "profile:redacted-live-write-admission-demo",
  "profile_scope_ref": "profile-scope:redacted-xhs-admission",
  "manifest_version": "v1",
  "owner_ref": "owner:redacted-profile-admin",
  "head_sha": "eb3d023ba00124c6ca0cb7e4688bf1f5604f7dea",
  "allowed_providers": [
    {
      "provider_id": "official-chrome-stable",
      "provider_contract_ref": "FR-0033/browser-provider-contract/official-chrome-stable",
      "provider_family": "official_chrome",
      "provider_mode": "core_managed",
      "allowed_workflow_refs": ["xhs.creator_publish.admit"],
      "maximum_capability_level": "write_admit",
      "allowed_target_domains": ["creator.xiaohongshu.com"],
      "allowed_target_pages": ["creator_publish_tab"],
      "required_secret_kinds": ["profile_storage_secret", "provider_auth_secret", "fingerprint_seed"],
      "required_provider_requirement_ref": "downstream/#1179/provider-requirement/redacted",
      "minimum_verification_level": "static_checked",
      "risk_constraints": ["no_commit_without_downstream_gates"],
      "evidence_refs": ["FR-0033/browser-provider-contract/official-chrome-stable"]
    }
  ],
  "secret_refs": [
    {
      "secret_kind": "profile_storage_secret",
      "secret_ref": "secret-handle:profile-storage/redacted",
      "locator_kind": "secret_handle",
      "redaction_state": "redacted",
      "scope_ref": "profile-scope:redacted-xhs-admission",
      "owner_ref": "owner:redacted-profile-admin",
      "expires_at": "2026-06-12T00:00:00Z"
    },
    {
      "secret_kind": "provider_auth_secret",
      "secret_ref": "secret-handle:provider-auth/redacted",
      "locator_kind": "secret_handle",
      "redaction_state": "redacted",
      "scope_ref": "provider-scope:official-chrome-stable/redacted",
      "owner_ref": "owner:redacted-profile-admin",
      "expires_at": "2026-06-12T00:00:00Z"
    },
    {
      "secret_kind": "fingerprint_seed",
      "secret_ref": "secret-handle:fingerprint-seed/redacted",
      "locator_kind": "secret_handle",
      "redaction_state": "redacted",
      "scope_ref": "profile-scope:redacted-xhs-admission",
      "owner_ref": "owner:redacted-profile-admin",
      "expires_at": "2026-06-12T00:00:00Z"
    }
  ],
  "evidence_refs": {
    "manifest_source_ref": "artifact:profile-manifest/redacted",
    "provider_contract_refs": ["FR-0033/browser-provider-contract/official-chrome-stable"],
    "secret_policy_ref": "FR-0041/secret-handling",
    "redaction_policy_ref": "#1181/live-write-evidence-redaction",
    "owner_attestation_ref": "attestation:redacted-profile-admin"
  },
  "created_at": "2026-06-11T00:00:00Z",
  "expires_at": "2026-06-12T00:00:00Z",
  "revoked_at": null
}
```

### Accepted evaluation example

```json
{
  "schema_version": "profile-manifest-provider-allowlist.v1",
  "status": "accepted",
  "decision": "allow",
  "blocking_reasons": [],
  "profile_manifest_ref": "profile-manifest/redacted-20260611-001",
  "provider_entry_ref": "profile-manifest/redacted-20260611-001/providers/official-chrome-stable",
  "secret_refs_consumed": [
    "secret-handle:profile-storage/redacted",
    "secret-handle:provider-auth/redacted",
    "secret-handle:fingerprint-seed/redacted"
  ],
  "evidence_refs_consumed": [
    "FR-0033/browser-provider-contract/official-chrome-stable",
    "FR-0041/secret-handling",
    "#1181/live-write-evidence-redaction"
  ],
  "evaluated_at": "2026-06-11T00:05:00Z",
  "downstream_owner": "#1179"
}
```

This result does not prove provider requirements, account safety, target binding, operator unlock, default lock release or live evidence.

### Missing secret result example

```json
{
  "schema_version": "profile-manifest-provider-allowlist.v1",
  "status": "secret_ref_missing",
  "decision": "deny",
  "blocking_reasons": ["secret_ref_missing"],
  "profile_manifest_ref": "profile-manifest/redacted-20260611-001",
  "provider_entry_ref": "profile-manifest/redacted-20260611-001/providers/official-chrome-stable",
  "secret_refs_consumed": [],
  "evidence_refs_consumed": [],
  "evaluated_at": "2026-06-11T00:05:00Z",
  "downstream_owner": "none"
}
```
