# FR-0069 TODO

## Review 阶段

- [ ] 确认 `FR-0069` 只定义 provider-owned stealth boundary and WebEnvoy non-ownership。
- [ ] 确认 browser binary patch、fingerprint patch、stealth parameter generation、provider private patch validation and managed browser stealth internals belong to provider/provider adapter。
- [ ] 确认 WebEnvoy allowed consumption only covers declaration、limitations、redacted refs、freshness/scope and blocking reasons。
- [ ] 确认 provider private patch payload、stealth raw parameters、browser binary diff、driver internals、fingerprint internals and raw fingerprint seed never enter WebEnvoy core contract or PR metadata。
- [ ] 确认 provider declaration、doctor pass、health pass、descriptor pass、runtime ping、bootstrap ack、fingerprint seed ref or private patch ref are non-proofs for WebEnvoy-owned risk evidence。
- [ ] 确认 #1183 owns WebEnvoy-owned risk evidence boundary, gate inputs and closeout/audit ownership。
- [ ] 确认 #1188 owns risk hint consumer gate behavior and does not bypass #1183。
- [ ] 确认 this PR does not implement provider adapter、browser patch、fingerprint generation、risk gate、read/write gate、account safety、live evidence、XHS driver、JSON-RPC or Syvert normalized result。
- [ ] 确认 PR metadata uses `Refs #1182` and does not auto-close #1182/#1183/#1188/#1118。

## 实现前待办

- [ ] #1183 consumes `provider_owned_stealth_boundary_ref` and defines WebEnvoy-owned risk evidence separately.
- [ ] #1183 defines accepted/blocked/unclassified risk evidence semantics without exposing provider private patch internals.
- [ ] #1188 consumes #1183 risk hint semantics in read/write gates.
- [ ] Future provider selection rejects `declared_only`/`doctor_checked` stealth as a replacement for WebEnvoy-owned risk evidence.
- [ ] Future evidence parser rejects private patch disclosure, raw seed disclosure, stale refs and scope mismatch.
- [ ] Future gate consumers record `webenvoy_risk_evidence_required` or `risk_hint_consumer_required` instead of inferring allow from provider stealth presence.

## Current PR scope

- [ ] Formal spec suite only.
- [ ] Sync-map mapping to #1182 only.
- [ ] No runtime implementation.
- [ ] No provider adapter implementation.
- [ ] No browser patch / fingerprint generation / stealth parameter implementation.
- [ ] No risk gate / read-write gate / live evidence / account safety behavior.
- [ ] No XHS driver、JSON-RPC or Syvert normalized result.
- [ ] Scheduler owns guardian / formal review / merge gate / issue closeout.
