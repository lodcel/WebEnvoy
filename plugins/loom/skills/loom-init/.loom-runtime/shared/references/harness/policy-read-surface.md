# Approval And Sandbox Policy Read Surface

This contract defines the stable read surface for approval and sandbox policy evidence during Loom execution.

Policy evidence is runtime/control-plane evidence. It is not an approval system, not a sandbox implementation, not authored progress, and not a second execution truth.

## Boundary

`policy_locators` in `.loom/companion/repo-interface.json` remains declaration-time only. It declares:

- `id`
- `summary`
- `policy`
- `locator`
- `owner`
- `requirement`
- `surface`
- `fallback_to`

`policy` must be either `approval` or `sandbox`.

The locator may point at a readable policy declaration. Loom reads that declaration but does not request approval, change sandbox settings, elevate permissions, or write host results.

Host-specific policy names stay behind the host adapter. Loom consumes only the abstract read result and the declared severity.

## Vocabulary

`policy_readiness.declared_policies[*].status` uses exactly:

- `declared`: the policy read surface is present and no risk is reported.
- `missing`: the policy read surface is unavailable for this runtime/profile.
- `conflict`: the policy declaration conflicts with the requested execution surface.
- `unsafe`: the policy declaration reports an unsafe execution boundary.

`risk` uses exactly:

- `none`
- `unknown`
- `conflict`
- `unsafe`

These values are never top-level command results. Top-level `result` remains `pass | block | fallback`.

## Severity

- Status read: missing policy evidence is advisory unless the current surface declares that policy as `required`.
- Flow execution: missing required policy, conflicting policy, or unsafe policy blocks the owning surface and uses `fallback_to`.
- Merge-ready: unsafe or conflicting required policy blocks; optional/advisory policy risk remains review input.
- Live profile: policy mismatch defaults to profile-local failure unless an explicit blocking profile declares owner, fallback, override path, authority-of-truth, and live evidence.
- Optional or advisory policy `missing`, `conflict`, or `unsafe` exposes risk evidence without blocking core status.

## Output

`policy_readiness` uses schema `loom-policy-readiness/v1` and includes:

- `result`
- `summary`
- `declared_policies`
- `approval_policy`
- `sandbox_policy`
- `risk_summary.blocking`
- `risk_summary.advisory`
- `risk_summary.by_status`
- `risk_summary.by_policy`
- `missing_inputs`
- `fallback_to`

`loom_status` exposes the latest derived `policy_readiness` from `governance_surface.repo_interface`.
`flow review`, `flow merge-ready`, and `closeout` expose the applicable policy evidence under `repo_specific_requirements.policy_readiness`.
