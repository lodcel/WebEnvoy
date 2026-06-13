# Integration Check Metadata Contract

This contract freezes the logical PR metadata shape for `integration_check`. It is not a runtime schema, persistence model, CLI output, JSON-RPC payload, Syvert normalized result, provider adapter contract, live evidence record, or joint acceptance implementation.

## Type sketch

```ts
type YesNo = "yes" | "no";

type IntegrationTouchpointV1 =
  | "none"
  | "check_required"
  | "active"
  | "blocked"
  | "resolved";

type ExternalDependencyV1 = "none" | "syvert" | "webenvoy" | "both";

type MergeGateV1 = "local_only" | "integration_check_required";

type ContractSurfaceV1 =
  | "none"
  | "execution_provider"
  | "ids_trace"
  | "errors"
  | "raw_normalized"
  | "diagnostics_observability"
  | "runtime_modes"
  | "integration_governance";

interface IntegrationCheckMetadataV1 {
  integration_applicable: YesNo;
  integration_touchpoint: IntegrationTouchpointV1;
  integration_ref: "none" | string;
  shared_contract_changed: YesNo;
  external_dependency: ExternalDependencyV1;
  merge_gate: MergeGateV1;
  contract_surface: ContractSurfaceV1;
  joint_acceptance_needed: YesNo;
  integration_status_checked_before_pr: YesNo;
  integration_status_checked_before_merge: YesNo;
}
```

## Valid local-only metadata

```yaml
integration_check:
  integration_applicable: no
  integration_touchpoint: none
  integration_ref: none
  shared_contract_changed: no
  external_dependency: none
  merge_gate: local_only
  contract_surface: none
  joint_acceptance_needed: no
  integration_status_checked_before_pr: yes
  integration_status_checked_before_merge: yes
```

Allowed use:

- WebEnvoy-local docs, specs, governance wording or implementation.
- WebEnvoy-owned hints / refs / evidence locators that do not freeze shared output or downstream-owned schema.
- PRs that mention Syvert as a future optional consumer but do not require Syvert action, shared contract acceptance or joint validation.

## Valid integration-gated metadata

```yaml
integration_check:
  integration_applicable: yes
  integration_touchpoint: check_required
  integration_ref: "#1234"
  shared_contract_changed: yes
  external_dependency: none
  merge_gate: integration_check_required
  contract_surface: diagnostics_observability
  joint_acceptance_needed: no
  integration_status_checked_before_pr: yes
  integration_status_checked_before_merge: yes
```

Allowed use:

- Provider/shared-contract changes.
- Shared output, error, id, diagnostics, observability or runtime mode changes.
- Integration gate / review semantics changes, with `contract_surface=integration_governance`.
- Work whose completion depends on another repo or joint acceptance.

## Normative rules

1. The `integration_check` block is required for PR review / merge gate.
2. Every field in `IntegrationCheckMetadataV1` is required.
3. Unknown enum values fail closed.
4. `integration_applicable=no` requires:
   - `integration_touchpoint=none`
   - `integration_ref=none`
   - `shared_contract_changed=no`
   - `external_dependency=none`
   - `merge_gate=local_only`
   - `contract_surface=none`
   - `joint_acceptance_needed=no`
5. `integration_applicable=yes` requires:
   - `integration_touchpoint=check_required|active|blocked|resolved`
   - concrete `integration_ref`
   - `merge_gate=integration_check_required`
   - `contract_surface != none`
   - `integration_status_checked_before_pr=yes`
   - `integration_status_checked_before_merge=yes` before merge-ready.
6. `shared_contract_changed=yes` requires integration-gated metadata.
7. `external_dependency=syvert|webenvoy|both` requires integration-gated metadata.
8. `joint_acceptance_needed=yes` requires integration-gated metadata.
9. Integration gate / review semantics changes require `contract_surface=integration_governance` when integration-gated.
10. Local-only metadata must not be inferred from PR title, path, labels or issue type when the block is missing.

## Invalid combinations

```yaml
# Invalid: shared contract changed but local-only.
integration_applicable: no
shared_contract_changed: yes
merge_gate: local_only
```

```yaml
# Invalid: integration applicable without concrete ref.
integration_applicable: yes
integration_touchpoint: check_required
integration_ref: none
merge_gate: integration_check_required
```

```yaml
# Invalid: integration-gated trigger without merge gate.
external_dependency: syvert
merge_gate: local_only
```

```yaml
# Invalid: joint acceptance requires integration ref and gate.
joint_acceptance_needed: yes
integration_applicable: no
integration_ref: none
```

```yaml
# Invalid: integration governance change mislabeled as no surface.
integration_applicable: yes
merge_gate: integration_check_required
contract_surface: none
```

## Parser expectations

Parser / merge gate consumers should:

- locate a top-level `integration_check` block or equivalent structured PR metadata;
- require all fields;
- normalize only surrounding whitespace, not unknown values;
- report missing or inconsistent fields as blocking errors;
- validate the relationship matrix before merge-ready;
- re-read PR body on latest head after metadata-only updates.

Parser / merge gate consumers should not:

- infer missing `integration_check` from issue labels;
- treat `integration:local-only` labels as a substitute for PR metadata;
- silently default missing fields;
- treat project-root links as concrete `integration_ref`;
- downgrade invalid integration metadata to warnings.
