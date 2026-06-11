# FR-0068 Research

## Inputs checked

- Issue #1180: `live_write_commit Default Lock`, `kind:fr`, `risk:high`, `integration:local-only`; current formal spec PR references #1180 as a spec/freeze carrier and does not auto-close it or run issue closeout.
- Issue #1174 / FR-0062: CLOSED. Freezes `read_only`, `write_admit`, `write_prepare`, `live_write_commit`, fail-closed vocabulary and downstream ownership.
- Issue #1175 / FR-0065: CLOSED. Freezes profile manifest provider allowlist; accepted manifest does not unlock commit.
- Issue #1176 / FR-0066: CLOSED. Freezes account safety gate; `clear` is necessary but not sufficient.
- Issue #1177 / FR-0067: CLOSED. Freezes extension/native bridge gate; `ready` is necessary but not sufficient.
- Issue #1178 / FR-0064: CLOSED. Freezes operator unlock; unlock only clears operator lane.
- Issue #1179: CLOSED work item. `xhs.creator_publish.admit` provider requirements are implemented for `write_admit`; tests and command surfaces preserve `default_live_write_commit_lock=locked`.
- Roadmap / architecture inputs: CLI-first, browser-in-process HTTP boundary, minimal identity/session boundary, account safety and real live evidence guardrails.

## Key findings

### 1. Default lock must remain separate from operator unlock

FR-0064 explicitly says operator unlock does not release default commit lock. FR-0068 therefore needs a separate `default_lock_result` with its own state and blocking reasons.

### 2. Provider admission is not commit readiness

#1179 and related tests show `xhs.creator_publish.admit` is admission-oriented and sets `requested_capability_level=write_admit`, `maximum_capability_level=write_admit`, `operator_unlock_ref=null`, `default_commit_lock_ref=null` and `default_live_write_commit_lock=locked`. FR-0068 must preserve this as an input, not reinterpret it as `live_write_commit`.

### 3. Current exact-scope evidence is the core invariant

FR-0065, FR-0066 and FR-0067 all bind results to exact profile/provider/target/head/run scope. FR-0068 should not weaken that. A release disposition is invalid after drift or expiry.

### 4. Non-proofs need to be explicit

Prior specs repeatedly reject #835 closed state, runtime ping, bootstrap ack, stub/fake host and historical artifacts. FR-0068 adds issue closed state, spec text, PR merge, hosted checks and guardian approval to the same non-proof class for default lock release.

### 5. Downstream re-consumption is mandatory

Default lock release is not final commit authorization. It only creates a necessary input for #1211 / runtime owner / release gate owner. Downstream must reconsume current refs because evidence can become stale or revoked after FR-0068 evaluates.

## Options considered

### Option A: Fold default lock into operator unlock

Rejected. FR-0064 explicitly scopes operator unlock to the operator lane. Folding default lock into it would make an operator record too powerful and would bypass provider/runtime/account/evidence owners.

### Option B: Treat #1179 provider requirement pass as lock release

Rejected. #1179 is `write_admit` and includes `default_live_write_commit_lock=locked`. It cannot satisfy `live_write_commit` without downstream commit-scope evidence.

### Option C: Add a formal default lock FR with downstream re-consumption

Accepted. This matches issue #1180, preserves lane ownership, and keeps future runtime/release gates fail-closed.

## Open handoff

- #1211 or equivalent release gate matrix must consume FR-0068 states, blockers and non-proofs.
- Future runtime parser/evaluator must implement current exact-scope matching, redaction validation, expiry/revocation handling and downstream re-consumption.
- Future live-write implementation must provide fresh real-browser evidence and all lane refs before any commit request can pass.
