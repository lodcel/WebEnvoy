# FR-0070 Research

## 输入问题

1. `FR-0069` 已冻结哪些 provider-owned stealth 边界，#1183 不能重新定义什么？
2. WebEnvoy-owned risk evidence 应该接受哪些 evidence classes，哪些信号必须保持 non-proof？
3. #1183 与 #1188 的边界如何切分，才能避免 #1188 直接绕过 risk evidence？
4. FR-0066 / #1176 account safety gate 与 #1187 account safety signal integration 如何作为 sibling inputs，而不是被 #1183 重写？

## 输入事实

- #1183 `WebEnvoy-Owned Risk Evidence Boundary` 当前 OPEN，scope 是 “Define WebEnvoy-owned risk evidence, gates and closeout responsibilities independent of provider stealth internals.”
- #1183 depends on #1182, and #1182 / PR #1280 merged `FR-0069 Provider-Owned Stealth Boundary` at merge commit `a16bcdf8a7f5245fcda0ee587bbd2f0b9999377b`.
- #1188 `Risk Hint Consumer Gate` 当前 OPEN，scope 是 “Define how runtime risk hints are consumed by read/write gates and closeout evidence.” It depends on #1183.
- #1187 account safety signal integration is a sibling/consumer input. `FR-0066 Account Safety Gate` / #1176 defines account safety state, scope binding, freshness, redaction, evidence refs and fail-closed blockers.
- `FR-0069` says provider-owned stealth can be declared, diagnosed, referenced and fail-closed consumed, but provider declaration、doctor pass、fingerprint seed ref or private patch ref cannot replace WebEnvoy-owned risk evidence.
- `FR-0040` and `FR-0041` freeze evidence refs, sensitivity, redaction state, freshness/provenance and fail-closed redaction semantics.

## 结论 1：#1183 owns risk evidence, not provider private stealth

Provider private stealth internals must remain provider-owned. #1183 can consume provider-owned boundary refs, limitations, redacted refs, freshness/scope and blocking reasons. It cannot expand browser binary patches, fingerprint seeds, private patch manifests, stealth raw values or driver internals into a WebEnvoy-owned risk evidence object.

Design consequence:

- Provider-related evidence classes use refs only.
- Provider declaration / doctor pass / private patch presence stay non-proof.
- Provider private disclosure is a hard blocker, not a richer evidence source.

## 结论 2：risk accepted must be exact-scope and fresh

Risk evidence is meaningful only when bound to the exact workflow, capability, target, profile, provider, head, run/evaluation context and artifact identity. This matches the live evidence and closeout discipline already enforced by repo policy: old head, old run, historical artifact, same-head historical artifact, post-merge补证据, runtime ping, bootstrap ack, stub/fake host and control-plane-only signals are not current accepted evidence.

Design consequence:

- `RiskEvidenceGateInputV1` includes scope, evidence refs and non-proof observations.
- `RiskEvidenceGateResultV1` can only hand off to #1188 with `risk_state=accepted` and no blockers.
- Any binding drift becomes stale or scope mismatch.

## 结论 3：#1188 remains the consumer gate owner

#1183 should freeze the input language and fail-closed rules for risk evidence. It should not freeze the read/write gate enforcement matrix, command output changes or gate decision implementation. Those belong to #1188.

Design consequence:

- #1183 output uses `decision=allow_input_to_1188`, not `allow`.
- `risk_hint_consumer_required` remains a handoff blocker.
- #1188 must consume #1183 semantics instead of provider stealth presence.

## 结论 4：account safety is a required sibling input, not a replacement

Account safety clear can be necessary for write_prepare / live_write_commit risk input. It cannot alone prove provider stealth, runtime target binding, live evidence, closeout or #1188 gate allow.

Design consequence:

- `account_safety_ref` is an accepted evidence class and required binding for write_prepare / live_write_commit.
- `account_safety_not_clear` is a blocker.
- This FR does not change FR-0066 field shape or account safety state semantics.

## Future extension triggers

Open a new formal spec or #1188 implementation PR if any future work needs to:

- Add risk evidence classes beyond FR-0070 enum.
- Change `RiskEvidenceGateInputV1` / `RiskEvidenceGateResultV1` fields.
- Define read/write gate enforcement matrix or command output behavior.
- Persist risk evidence to SQLite or expose it in CLI stdout.
- Consume provider private patch payload or previously forbidden provider internals.
- Use live/account/browser evidence as closeout proof.
