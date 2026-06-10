# FR-0062 Research

## Input baseline

Reviewed inputs:

- `AGENTS.md`: formal spec and high-risk write/liveness governance.
- `vision.md`: WebEnvoy is a web execution tool, not an Agent brain; CLI-first and browser-internal execution remain core boundaries.
- `docs/dev/AGENTS.md`: formal specs use refs-only semantics before implementation completion; live evidence gate applies only when claimed.
- `docs/dev/architecture/system-design.md`: browser process remains the only HTTP outlet.
- `docs/dev/architecture/system-design/boundary.md`: WebEnvoy-local work stays local-only unless shared contract / provider adapter / joint acceptance is explicitly changed.
- `FR-0009`: high-risk live experiments default disabled unless formal gates and approval/audit exist.
- `FR-0016`: latest-head live evidence gate cannot be satisfied by stub/fake host, runtime ping or bootstrap ack.
- `FR-0031`: creator live write admission is non-write readiness and does not execute upload/submit/publish.
- `FR-0032 / #835`: controlled live write success owns upload -> submit -> publish -> cleanup evidence, but #835 closed state is not current #1174 evidence.
- `FR-0033` / `FR-0035`: provider capability declarations and support states are not runtime/live proof.
- `FR-0040` / `FR-0041`: evidence refs and redaction must remain locators and cannot leak secrets or private paths.
- `FR-0048..FR-0060`: recent formal suites use refs-only metadata, narrow owner maps, fail-closed semantics and sync-map entries.

## Issue readback

- #1174: `OPEN`, scope is freezing `read_only`, `write_admit`, `write_prepare` and `live_write_commit` capability levels; depends on #835 completed baseline.
- #1178: `OPEN`, scope is explicit operator unlock requirements and audit evidence for `live_write_commit`; depends on Live-Write Capability Taxonomy.
- #1179: `OPEN`, scope is aligning `xhs.creator_publish.admit` with provider requirements and fail-closed live-write gates; depends on taxonomy and XHS provider requirement declaration.
- #1180: `OPEN`, scope is keeping `live_write_commit` locked by default unless all risk gate and operator conditions are satisfied; depends on Operator Unlock.
- #1211: `OPEN`, scope is release gate for capability levels, profile allowlist, account safety, operator unlock and default commit lock.
- #835: `CLOSED`, canonical FR-0032 controlled live write success carrier. It remains related baseline, not current live evidence for #1174.

## Option analysis

### Option A: Define only prose in `spec.md`

Rejected.

Reason: downstream gates need stable terms, result fields and blocking reasons. Prose-only taxonomy would invite #1178/#1179/#1180/#1211 to invent incompatible aliases.

### Option B: Define taxonomy plus contract / logical data model

Accepted.

Reason: this freezes machine-consumable enums and handoff fields while staying out of runtime/source code. It matches FR-0052 / FR-0056 style: formal contract first, implementation later.

### Option C: Fold operator unlock and default lock into #1174

Rejected.

Reason: issue scopes already assign #1178 to operator unlock and #1180 to default lock. #1174 only defines terms and owner boundaries.

### Option D: Treat #835 CLOSED as sufficient baseline for commit

Rejected.

Reason: FR-0016 and FR-0032 require current gate/evidence for live write. A closed historical issue cannot satisfy current `live_write_commit` admission or release gate.

## Scope conclusion

FR-0062 should be a narrow formal taxonomy/spec PR with:

- `spec.md`
- `plan.md`
- `TODO.md`
- `contracts/live-write-capability-taxonomy.md`
- `data-model.md`
- `research.md`
- `risks.md`
- `.github/spec-issue-sync-map.yml` mapping #1174 to FR-0062

It should not create runtime code, tests, fixtures, scripts, live evidence, browser/account actions, issue closeout, Syvert normalized result or #835 recovery work.
