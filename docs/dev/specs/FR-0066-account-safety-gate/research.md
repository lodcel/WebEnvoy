# FR-0066 Research

## Issue readback

#1176 scope:

- Require account safety state before `write_prepare` or `live_write_commit` admission.
- Depends on #835 completed baseline.
- Boundary excludes Syvert normalized result, CloakBrowser-as-core, browser patching, default live_write commit and unrelated #835 recovery.
- Labels: `kind:fr`, `area:live-write`, `risk:high`, `integration:local-only`.
- Close semantics: `fr-complete`.

## Consumed baselines

### FR-0062 / #1174 Live-Write Capability Taxonomy

Consumed facts:

- Capability levels are `read_only`, `write_admit`, `write_prepare`, `live_write_commit`.
- `write_prepare` is not `live_write_commit`.
- `live_write_commit` is locked by default and requires account safety among other gates.
- `account_safety_unknown` is already a frozen taxonomy blocking reason.

FR-0066 implication:

- Account safety becomes an explicit lane with its own state record and gate result.
- `write_prepare` and `live_write_commit` cannot be reached from `write_admit` without current `state=clear`.

### FR-0064 / #1178 Operator Unlock

Consumed facts:

- Operator unlock only clears operator lane.
- Unlock evidence refs include `account_safety_ref` as required locator.
- Accepted unlock does not release default lock or prove account safety.

FR-0066 implication:

- Operator unlock can reference account safety, but cannot create or imply it.
- Account safety unknown remains blocking even when operator unlock exists.

### FR-0032 / #835 Controlled Live Write Success

Consumed facts:

- FR-0032 entry gate requires `account_safety_state=clear`.
- #835 is closed and represents completed controlled-success baseline context.
- FR-0032 still requires fresh latest-head entry gate before any true live write action.

FR-0066 implication:

- #835 is historical baseline only. It cannot satisfy current account safety for #1176 or downstream gates.
- Account safety clear must be current, scoped and redacted.

### FR-0041 / #1181 Evidence Redaction

Consumed facts:

- FR-0041 requires redaction for account identifiers, profile locators, secrets and private paths.
- #1181 closed the live-write redaction work item for account/profile/proxy/seed/secret-bearing paths.

FR-0066 implication:

- Account safety evidence must use locators, not inline sensitive values.
- Redaction invalid required evidence fails closed and cannot be reported as `clear`.

## Boundary decisions

1. Account safety is a gate result, not a runtime implementation in this PR.
2. Account safety clear is a necessary condition for `write_prepare` and `live_write_commit`, not a sufficient condition for either.
3. Operator unlock and account safety remain separate lanes.
4. Redaction compliance is necessary for safety evidence consumption but is not safety clear.
5. Historical #835 evidence remains background, not current safety evidence.
6. Any real account or browser action belongs to future implementation/live owner and requires explicit authorization.

## Downstream consumers

- #1179 must consume `account_safety_gate_result` before provider requirements can support write preparation.
- #1180 must consume current `clear` before default commit lock release can be considered.
- #1211 must include account safety states and blockers in the live-write gate matrix.
- Runtime/live owner must produce current scoped safety state before any `write_prepare` or `live_write_commit` request.

## Open implementation questions for later owners

- Exact runtime command or evaluator name that will emit `AccountSafetyStateRecordV1`.
- Freshness TTL per workflow and target risk lane.
- Whether `requires_operator_attention` maps to a user-visible workflow, a blocked closeout, or a manual recovery issue.
- Storage location and artifact identity format for redacted account safety refs.

These questions do not block the formal contract because the required state shape, fail-closed behavior and downstream ownership are frozen here.
