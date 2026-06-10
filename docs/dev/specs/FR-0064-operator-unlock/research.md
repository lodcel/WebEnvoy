# FR-0064 Research

## Input baseline

Reviewed inputs:

- `AGENTS.md`: high-risk formal spec, PR, review and live-write governance; no direct main push; refs-only semantics for spec PR before implementation completion.
- `vision.md`: WebEnvoy is a web execution tool, not an Agent brain; CLI-first and browser-internal execution remain core boundaries.
- `docs/dev/AGENTS.md`: formal specs use refs-only semantics before implementation completion; live evidence gate applies only when claimed; high-risk live work must fail closed without current evidence.
- `docs/dev/architecture/system-design.md`: browser process remains the only HTTP outlet.
- `FR-0062`: freezes `read_only`, `write_admit`, `write_prepare`, `live_write_commit`; `live_write_commit` is locked by default and requires #1178 operator unlock.
- `FR-0031`: creator live write admission is non-write readiness and does not execute upload/submit/publish.
- `FR-0032 / #835`: controlled live write success owns upload -> submit -> publish -> cleanup evidence, but #835 closed state is not current #1178 evidence.
- `FR-0016`: latest-head live evidence gate cannot be satisfied by stub/fake host, runtime ping or bootstrap ack.
- `FR-0040` / `FR-0041`: evidence refs and redaction must remain locators and cannot leak secrets or private paths.

## Issue readback

- #1178: `OPEN`, scope is defining explicit operator unlock requirements and audit evidence for `live_write_commit`; labels include `kind:fr`, `area:live-write`, `risk:high`, `integration:local-only`.
- #1178 parent: #1117 `OPEN`.
- #1178 native dependency readback: active blocked-by count is 0; historical blockedBy includes #1174 `CLOSED` / FR-0062.
- #1178 blocking downstream: #1180 `OPEN` and #1211 `OPEN`.
- #1174: `CLOSED`; FR-0062 taxonomy has merged and is the direct input.
- #835: `CLOSED`; canonical FR-0032 controlled live write success carrier. It remains related historical baseline, not current operator unlock evidence.

## Option analysis

### Option A: Treat issue/PR approval as operator unlock

Rejected.

Reason: issue state, label, PR approval, guardian approval or hosted checks pass do not carry exact scope, expiry, revocation, risk acknowledgement or audit evidence refs.

### Option B: Define an explicit operator unlock record and evaluator result

Accepted.

Reason: downstream #1180 and #1211 need machine-consumable fields to distinguish missing, expired, revoked, mismatched and accepted unlock states. This preserves fail-closed semantics and keeps implementation out of this PR.

### Option C: Fold default commit lock release into operator unlock

Rejected.

Reason: FR-0062 assigns default lock ownership to #1180. Operator unlock can clear only the operator lane; it must not unlock commit by itself.

### Option D: Reuse #835 closed state as unlock evidence

Rejected.

Reason: #835 is historical controlled-success context. FR-0016 and FR-0032 require current latest-head evidence for live paths. A closed issue cannot prove current operator intent, scope matching or live evidence.

## Scope conclusion

FR-0064 should be a narrow formal operator unlock/spec PR with:

- `spec.md`
- `plan.md`
- `TODO.md`
- `contracts/operator-unlock.md`
- `data-model.md`
- `research.md`
- `risks.md`
- `.github/spec-issue-sync-map.yml` mapping #1178 to FR-0064

It should not create runtime code, tests, fixtures, scripts, live evidence, browser/account/live/write actions, issue closeout, Syvert normalized result, XHS publish implementation or #835 recovery work.
