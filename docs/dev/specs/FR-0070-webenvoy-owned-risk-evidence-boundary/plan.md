# FR-0070 实施计划

## 实施目标

冻结 `#1183 WebEnvoy-Owned Risk Evidence Boundary` 的 formal spec suite，明确 WebEnvoy 拥有的 risk evidence classes、non-proof signals、freshness/scope/head/run/profile/page/provider binding、fail-closed blockers、closeout/audit responsibility，以及对 `FR-0069` provider-owned stealth boundary 的消费限制。

本 PR 是 formal boundary/spec carrier。合入后只冻结 `FR-0070` suite 与 #1183 sync-map；不实现 risk hint consumer gate、read/write gate、runtime/provider/account safety/live evidence 行为、XHS driver、JSON-RPC 或 Syvert normalized result。

## 分阶段拆分

### 阶段 1：risk evidence boundary 冻结

- 产出：`spec.md`
- 重点：冻结 owner、目标、非目标、accepted evidence classes、classification states、binding/freshness rules、non-proof signals、fail-closed blockers、closeout/audit responsibility、provider stealth consumption boundary 与 #1188 handoff。

### 阶段 2：contract 与 logical data model

- 产出：`contracts/webenvoy-owned-risk-evidence-boundary.md`、`data-model.md`
- 重点：冻结 `WebEnvoyRiskEvidenceBoundaryV1`、`RiskEvidenceGateInputV1`、`RiskEvidenceGateResultV1`、evidence ref、scope、blocking reasons、provider consumption boundary 与 handoff refs；说明这些是 logical contract，不引入 persistence、runtime schema 或 command output change。

### 阶段 3：research / risks / review checklist

- 产出：`research.md`、`risks.md`、`TODO.md`
- 重点：记录 `FR-0069` / `FR-0040` / `FR-0041` / `FR-0066` / `FR-0067` / `FR-0068` 与 issue #1183/#1188 的输入事实，明确本 FR 不承接 #1188 read/write gate consumer implementation。

### 阶段 4：PR 与验证准备

- 产出：`.github/spec-issue-sync-map.yml` 中 #1183 映射、parser-ready PR metadata、验证记录、纯度预检结果。
- 重点：确保 PR 只包含 FR-0070 suite 与单条 sync-map mapping；PR metadata 使用 `Refs #1183`，等待 scheduler-owned spec review/gate。

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0070-webenvoy-owned-risk-evidence-boundary/**`
  - `.github/spec-issue-sync-map.yml` 中 #1183 对应映射
- 不修改 runtime/source code、tests、fixtures、scripts、workflows、githooks、`AGENTS.md`、`docs/dev/AGENTS.md`、`code_review.md`、repo Loom carriers 或 unrelated spec suites。
- 不修改 `FR-0033`、`FR-0040`、`FR-0041`、`FR-0066`、`FR-0067`、`FR-0068`、`FR-0069` 的 field shape。
- 不实现 provider registry、provider selection、doctor、health behavior、launch evidence、browser patching、fingerprint generation、stealth parameter generation、risk scorer、risk hint consumer gate、read/write gate、account safety、live evidence 或 closeout behavior。
- 不触碰 #1187 account safety signal integration、#1188 risk hint consumer gate implementation、#1184/#1185/#1186 behavior baseline work、#238、M10/M11 completed scope、XHS driver、JSON-RPC 或 Syvert normalized result。
- 不执行 browser/profile/extension/Native Messaging/account/live/external-visible/read/write actions。
- 不运行 guardian、formal review、controlled merge 或 issue closeout；gate owner remains scheduler。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity、non-closing reference semantics 与 hosted checks：

- `bash scripts/docs-guard.sh`
- `SPEC_GUARD_BASE_REF=origin/main bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0070-webenvoy-owned-risk-evidence-boundary/spec.md`
- `bash scripts/check-pr-purity.sh docs/1183-webenvoy-owned-risk-evidence-boundary main`
- `git diff --check origin/main...HEAD`
- same-class closing scan for auto-closing patterns against #1183/#1188/#1118
- same-class scope audit for browser patch implementation、fingerprint generation、provider adapter、runtime selection、risk hint consumer gate implementation、read/write gate implementation、account safety implementation、XHS driver、JSON-RPC、Syvert normalized result and live/browser action claims
- contract JSON examples parse check
- hosted GitHub checks after Draft PR push

语义自检：

- 对照 `FR-0069`，确认 provider-owned stealth remains upstream and provider private internals are not redefined here。
- 对照 #1183，确认 scope covers WebEnvoy-owned risk evidence boundary, gates input and closeout/audit ownership。
- 对照 #1188，确认 risk hint consumer gate remains downstream owner and is not implemented or fully defined here。
- 对照 `FR-0066` / #1176 与 #1187，确认 account safety gate remains base contract, account safety signal integration remains sibling input, and neither is redefined here。
- 对照 `FR-0040` / `FR-0041`，确认 evidence refs, sensitivity, redaction and fail-closed semantics remain compatible。

## TDD 范围

当前 PR 只冻结 formal boundary contract，不进入实现代码 TDD。

后续 #1188 implementation / parser / gate issue 应优先补以下测试：

- Missing WebEnvoy-owned risk evidence fails closed when downstream read/write gate requires risk hints.
- Provider declaration / doctor pass / private patch ref does not produce risk accepted.
- Unknown risk evidence class or state fails closed.
- Evidence bound to old head/run/profile/page/provider is rejected.
- Redaction invalid or provider private patch disclosure blocks evaluation.
- Account safety clear is necessary for write-prep/commit risk input but does not alone produce gate allow.
- `allow_input_to_1188` does not bypass #1188 read/write gate enforcement matrix.
- Historical, same-head historical, stub/fake host, control-plane-only and dry-run-only outputs remain non-proofs.

## 并行 / 串行关系

可并行：

- 不触碰 FR-0070 suite 的普通本仓库文档整理。
- #1188 可以做 prep-only readback，但 final consumer gate freeze / implementation 必须消费本 FR，并不得绕过 #1183 risk evidence semantics。
- #1187 account safety signal integration 可作为 sibling input 独立推进；本 PR 不修改其实现或 FR-0066 / #1176 semantics。

串行 / 依赖：

- FR-0070 consumes merged `FR-0069 Provider-Owned Stealth Boundary` / #1182。
- FR-0070 consumes merged `FR-0040 Provider Evidence Kernel` and `FR-0041 Evidence Redaction Policy` for refs/redaction/fail-closed semantics。
- FR-0070 references `FR-0066` / #1176 as the account safety gate contract and #1187 as account safety signal integration sibling input; it does not change either scope。
- #1188 must consume FR-0070 before freezing read/write gate risk hint consumer behavior。
- Any future provider adapter、browser patch、risk hint consumer gate、read/write gate、account safety implementation、live evidence or closeout implementation must use separate issue/PR and applicable formal suite。

## 进入实现前条件

- FR-0070 spec review 通过。
- Reviewer 确认 WebEnvoy-owned accepted evidence classes、non-proof signals、binding/freshness rules、fail-closed blockers and closeout/audit responsibility are frozen。
- Reviewer 确认 provider-owned stealth is consumed only through FR-0069 allowed declarations、limitations、redacted refs、freshness/scope and blockers。
- Reviewer 确认 provider declaration/doctor/pass/presence/fingerprint seed refs/private patch refs are non-proofs for WebEnvoy-owned risk evidence and read/write gate allow。
- Reviewer 确认 #1188 handoff remains explicit and unimplemented in this PR。
- Reviewer 确认 FR-0066 / #1176 account safety gate remains base contract, #1187 account safety signal integration remains sibling input, and neither is redefined。
- Reviewer 确认 PR metadata uses `Refs #1183` and does not auto-close #1183/#1188/#1118。
- Reviewer 确认本 suite 未混入 runtime/source code、tests、fixtures、scripts、workflows、browser/extension/native messaging/account/live/write action、Syvert normalized result、provider adapter implementation、XHS driver、JSON-RPC、guardian/formal review/merge/closeout。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0070-webenvoy-owned-risk-evidence-boundary/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1183 的映射。由于本 PR 不实现 runtime 行为，不需要 provider cleanup、profile cleanup、account cleanup、artifact cleanup、secret rotation、external rollback 或 live evidence invalidation。
