# FR-0043 Data Model

## 1. Persistent descriptor delta

`official-chrome.persistent` is a persistent-specific delta on top of the `FR-0042.official_chrome_descriptor` common shape.

Core identity fields:

- `descriptor_id`: fixed to `official-chrome.persistent`.
- `descriptor_version`: fixed to `v1`.
- `common_shape_owner`: fixed to `#1137` / `FR-0042`.
- `variant_kind`: fixed to `persistent`.

These fields define a static descriptor carrier. They do not define runtime state, doctor result, profile lock state, extension runtime state, native messaging session state, launch evidence or fixture data.

## 2. Persistent identity lifecycle

`official-chrome.persistent` identity lifecycle covers descriptor stability only:

- `provider_id=official-chrome.persistent` is stable and distinct from `official-chrome.direct`.
- `provider_family=official_chrome` keeps the descriptor in the official Chrome provider family.
- `provider_version=v1` is the provider descriptor version, not the Google Chrome version.
- `contract_version=v1` aligns with `FR-0033.browser_provider_contract.v1`.

Identity existence does not mean:

- Google Chrome stable is installed.
- A named profile exists.
- The profile is locked.
- The WebEnvoy extension is installed or running.
- Native messaging is registered or reachable.
- A doctor, runtime attestation or live evidence gate has passed.

## 3. Persistent profile model

The persistent profile data model is reference-based:

- `profile_kind=persistent_profile`
- `profile_persistence=required`
- `login_state_reuse=expected_when_profile_ready`
- `profile_locking=required`
- `cleanup_expectation=preserve_profile_state`
- `profile_reference`
- `profile_identity_constraints`

`profile_reference` must be a non-secret logical locator. It may identify a named profile or a profile locator reference, but it must not inline cookies, tokens, credentials or sensitive local paths.

`profile_identity_constraints` protect the boundary between descriptor and runtime:

- The referenced profile must match the selected named profile.
- Credentials and cookies must not be inlined.
- Sensitive absolute paths must not be inlined.
- Exclusive profile lock is required before runtime use.
- Persistent profile state must not be cleaned up like an ephemeral direct profile.

## 4. Extension binding model

`extension_binding` is a set of references:

- `extension_identity_ref`
- `extension_installation_ref`
- `extension_runtime_ref`
- `service_worker_readiness_ref`

The references are static inputs for downstream runtime / health / evidence owners. They are not extension installation proof, service worker freshness proof or runtime-ready evidence.

This FR does not choose or freeze the extension distribution mechanism. Chrome Web Store, external extension installation, unpacked developer mode and other installation strategies remain outside this descriptor delta unless a later owner freezes them.

## 5. Native messaging readiness model

`native_messaging_readiness_refs` is a set of required references:

- `native_host_identity_ref`
- `native_host_manifest_ref`
- `allowed_origins_ref`
- `host_registration_ref`
- `bridge_readiness_ref`

The refs identify readiness dependencies. They do not define:

- Native host manifest schema.
- Host registration implementation.
- Native messaging message envelope.
- Health / doctor result payload.
- Runtime readiness state.

Native messaging remains a browser-extension bridge. It cannot become an external HTTP egress path for target-site requests.

## 6. Limitation refs lifecycle

Persistent limitation refs are stable descriptor boundary ids:

- `persistent_requires_profile_binding`
- `persistent_requires_extension_binding`
- `persistent_requires_native_messaging`
- `persistent_requires_profile_identity_match`
- `persistent_no_descriptor_level_runtime_readiness`
- `persistent_no_latest_head_live_evidence`

These limitations inform downstream fail-closed checks, but they do not define the full capability matrix. #1139 owns capability semantics and must consume this descriptor as input.

## 7. Evidence reference lifecycle

Evidence slots are inherited from `FR-0042`:

- `static_descriptor_ref`
- `registry_entry_ref`
- `capability_matrix_ref`
- `health_result_ref`
- `launch_evidence_ref`
- `fixture_ref`

This suite only provides `static_descriptor_ref`. All other slots remain future references and must be filled by their owning issues. Slot existence is not evidence availability.

## 8. Registry alignment lifecycle

If a later registry consumer registers `official-chrome.persistent`, it must:

- Keep `provider_id` equal to `contract_snapshot.provider_identity.provider_id`.
- Keep `contract_snapshot` compliant with `FR-0033.browser_provider_contract.v1`.
- Use `FR-0036.provider_class=official_chrome` only as registry classification.
- Keep persistent-specific descriptor fields in this provider-specific descriptor carrier.

The registry row must not copy profile, extension or native messaging details into private registry fields that redefine this delta.
