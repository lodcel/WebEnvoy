# FR-0070 TODO

## Review 阶段

- [ ] 确认 `FR-0070` 只定义 WebEnvoy-owned risk evidence boundary、gate inputs、closeout/audit ownership and fail-closed semantics。
- [ ] 确认 provider-owned stealth remains owned by `FR-0069` / #1182 and provider private internals are not redefined。
- [ ] 确认 accepted evidence classes are refs/locators and do not inline provider private patch, raw fingerprint seed, account secret, profile path or page content。
- [ ] 确认 every accepted evidence class has owner / producer, allowed effect, admission constraints and fail-closed stance; undefined owner/effect/admission lanes must block spec review。
- [ ] 确认 `manual_risk_disposition_ref` has producer owner、consumer refs、scope/freshness/redaction/artifact binding、allowed effect and fail-closed blockers。
- [ ] 确认 provider declaration、doctor pass、health pass、descriptor pass、runtime ping、bootstrap ack、fingerprint seed ref or private patch ref are non-proofs。
- [ ] 确认 freshness/scope/head/run/profile/page/provider binding rules are explicit and fail closed on drift。
- [ ] 确认 closeout/audit boundary distinguishes provider declaration, WebEnvoy-owned risk evidence, #1188 gate result, live evidence, account safety and fallback product value。
- [ ] 确认 FR-0066 / #1176 account safety gate remains base contract, #1187 account safety signal integration remains sibling input, and neither is redefined。
- [ ] 确认 #1188 owns risk hint consumer gate behavior and does not bypass #1183。
- [ ] 确认 this PR does not implement provider adapter、runtime selection、risk hint consumer gate、read/write gate、account safety、live evidence、XHS driver、JSON-RPC or Syvert normalized result。
- [ ] 确认 PR metadata uses `Refs #1183` and does not auto-close #1183/#1188/#1118。

## 实现前待办

- [ ] #1188 consumes `RiskEvidenceGateInputV1` / `RiskEvidenceGateResultV1` or later compatible formal contract.
- [ ] #1188 defines read/write gate enforcement matrix without directly consuming provider stealth presence.
- [ ] Future parser rejects unknown risk evidence class, unknown state and unknown blocker.
- [ ] Future parser rejects provider private patch disclosure, raw seed disclosure, stale refs and scope mismatch.
- [ ] Future gate consumers reject provider declaration / doctor pass / runtime ping / bootstrap ack as risk accepted.
- [ ] Future closeout tooling records latest head/current main, run/evaluation context, artifact identity and blocker split.
- [ ] Future tests cover account safety clear as necessary but insufficient input for write_prepare / live_write_commit.
- [ ] Future tests cover manual_risk_disposition_ref as context/blocker explanation/accepted-supporting input only, including manual-only and stale/scope mismatch denial paths.

## Current PR scope

- [ ] Formal spec suite only.
- [ ] Sync-map mapping to #1183 only.
- [ ] No runtime implementation.
- [ ] No provider adapter implementation.
- [ ] No browser patch / fingerprint generation / stealth parameter implementation.
- [ ] No risk hint consumer gate / read-write gate / live evidence / account safety behavior.
- [ ] No XHS driver、JSON-RPC or Syvert normalized result.
- [ ] Scheduler owns guardian / formal review / merge gate / issue closeout.
