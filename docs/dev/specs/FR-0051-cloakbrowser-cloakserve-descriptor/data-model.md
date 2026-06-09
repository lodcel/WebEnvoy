# FR-0051 Data Model

## 1. Descriptor lifecycle

`cloakbrowser.cloakserve` identity lifecycle covers descriptor stability only:

- `descriptor_id=cloakbrowser.cloakserve`
- `descriptor_version=v1`
- `descriptor_owner=#1148 / FR-0051`
- `provider_id=cloakbrowser.cloakserve`
- `contract_version=v1`

The descriptor does not prove:

- CloakBrowser is installed.
- The binary version is safe or patched.
- `cloakserve` is running.
- The CDP endpoint is reachable, authenticated or isolated.
- A profile is persistent or account-safe.
- WebEnvoy extension / Native Messaging is available.
- Runtime, health, launch evidence or live evidence has passed.

## 2. External managed lifecycle

`provider_mode=external_managed` means WebEnvoy does not own the provider lifecycle in this descriptor.

Downstream lifecycle consumers must supply their own evidence for:

- package or image version;
- process owner and lifecycle;
- listening host and port;
- CDP endpoint access controls;
- fingerprint seed routing;
- profile directory creation and cleanup;
- network exposure and reverse proxy behavior.

If these facts are missing, #1149/#1152 or later runtime admission must keep affected capabilities blocked.

## 3. Engine and profile model

The engine model is intentionally conservative:

- `engine_family=chromium`
- `browser_channel=CloakBrowser Chromium`
- `browser_version_range=provider_managed`
- `headless_policy=unknown`
- `profile_binding_support=unknown`

`headless_policy=unknown` and `profile_binding_support=unknown` are not neutral values. They are fail-closed inputs for capabilities that require headed real-browser behavior, persistent identity, account state or profile lock.

## 4. Default extension disabling model

The extension model is explicit:

- `default_extension_binding=disabled`
- `webenvoy_extension_bridge=unsupported_by_default`
- `native_messaging_bridge=unsupported`
- `extension_paths_input=experimental_reference_only`
- `extension_runtime_evidence=not_provided_by_descriptor`

The lifecycle boundary is:

1. #1148 freezes that WebEnvoy extension workflow is disabled by default for `cloakbrowser.cloakserve`.
2. #1149 may use the limitation to mark extension-related capabilities unsupported or blocked.
3. #1152 may turn the limitation into a gate rule.
4. A future owner may propose an opt-in extension workflow, but it must provide extension identity, install mode, service worker readiness, Native Messaging policy, profile binding and evidence freshness.

## 5. Limitation refs lifecycle

The limitation refs are stable descriptor boundary ids:

- `cloakserve_external_lifecycle`
- `cloakserve_distribution_experimental`
- `cloakserve_headless_policy_unknown`
- `cloakserve_profile_binding_unknown`
- `cloakserve_default_extension_disabled`
- `cloakserve_extension_workflow_experimental_only`
- `cloakserve_no_webenvoy_extension_binding`
- `cloakserve_no_native_messaging`
- `cloakserve_no_descriptor_level_runtime_readiness`
- `cloakserve_no_latest_head_live_evidence`
- `cloakserve_cdp_endpoint_security_not_attested`
- `cloakserve_provider_private_patch_required`

These refs are intended for downstream fail-closed consumption. They do not define a full capability matrix and do not prove any health/evidence state.

## 6. Evidence reference lifecycle

Evidence slots are named references:

- `static_descriptor_ref`
- `provider_contract_ref`
- `registry_entry_ref`
- `capability_matrix_ref`
- `limitation_gate_ref`
- `health_result_ref`
- `launch_evidence_ref`
- `fixture_ref`

This suite only provides `static_descriptor_ref` and descriptor-level `provider_contract_ref`. Every other slot remains empty until its owner supplies evidence.

Slot existence does not mean evidence availability. It also does not satisfy latest-head, runtime, real-browser, account-safety or live-evidence requirements.

## 7. Registry alignment lifecycle

If a later registry consumer registers this descriptor, it must:

- keep `provider_id` equal to `contract_snapshot.provider_identity.provider_id`;
- keep `contract_snapshot` compliant with `FR-0033.browser_provider_contract.v1`;
- preserve `distribution_channel=experimental`;
- preserve all #1148 limitation refs;
- keep `default_eligibility` controlled by #1149/#1152/health/evidence owners.

The registry row must not copy extension workflow or CDP endpoint state into private fields that redefine this descriptor.

## 8. Sensitive data boundary

The descriptor must not contain:

- cookies, tokens, credentials or account identifiers;
- full local filesystem paths;
- CDP authentication secrets;
- proxy credentials;
- private browser patch details;
- raw logs or page content.

Evidence refs may point to future artifacts, but the artifacts must be redacted under `FR-0041` before they are used for review or gate decisions.
