# FR-0069 实施计划

## 实施目标

冻结 `#1182 Provider-Owned Stealth Boundary` 的 formal spec suite，明确 external browser provider / provider adapter 拥有 browser patch、fingerprint patch、stealth 参数、private patch 与 managed browser stealth internals；WebEnvoy core 只消费 provider declaration、limitations、redacted evidence refs、freshness/scope 与 fail-closed blocking reasons。

本 PR 是 formal boundary/spec carrier。合入后只冻结 `FR-0069` suite 与 #1182 sync-map；不实现 provider adapter、browser patch、fingerprint generation、risk gate、read/write gate、live evidence、account safety、XHS driver、JSON-RPC 或 Syvert normalized result。

## 分阶段拆分

### 阶段 1：provider-owned boundary 冻结

- 产出：`spec.md`
- 重点：冻结 owner、目标、非目标、provider-owned responsibility domains、WebEnvoy non-ownership、allowed consumption、disclosure boundary、non-proof rules、blocking reasons、GWT 与 #1183/#1188 handoff。

### 阶段 2：contract 与 logical data model

- 产出：`contracts/provider-owned-stealth-boundary.md`、`data-model.md`
- 重点：冻结 `ProviderOwnedStealthBoundaryV1`、domain enum、consumption ref、disclosure policy、blocking reasons 与 handoff refs；说明这些是 logical contract，不引入 persistence 或 runtime schema。

### 阶段 3：research / risks / review checklist

- 产出：`research.md`、`risks.md`、`TODO.md`
- 重点：记录 `FR-0033` / `FR-0040` / `FR-0041` / `FR-0049` / `FR-0059` 与 issue #1182/#1183/#1188 的输入事实，明确本 FR 不承接 WebEnvoy-owned risk evidence gate。

### 阶段 4：PR 与验证准备

- 产出：`.github/spec-issue-sync-map.yml` 中 #1182 映射、parser-ready PR metadata、验证记录、纯度预检结果。
- 重点：确保 PR 只包含 FR-0069 suite 与单条 sync-map mapping；PR metadata 使用 `Refs #1182`，等待 scheduler-owned spec review/gate。

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0069-provider-owned-stealth-boundary/**`
  - `.github/spec-issue-sync-map.yml` 中 #1182 对应映射
- 不修改 runtime/source code、tests、fixtures、scripts、workflows、githooks、`AGENTS.md`、`docs/dev/AGENTS.md`、`code_review.md`、repo Loom carriers 或 unrelated spec suites。
- 不修改 `FR-0033`、`FR-0040`、`FR-0041`、`FR-0049`、`FR-0059`、`FR-0062`、`FR-0066`、`FR-0067`、`FR-0068` 的 field shape。
- 不实现 provider registry、provider selection、doctor、health behavior、launch evidence、browser patching、fingerprint generation、stealth parameter generation、risk evidence object、risk hint consumer gate、account safety、live evidence 或 closeout behavior。
- 不触碰 #1183/#1188 的 implementation or gate semantics；只给它们留下明确 handoff。
- 不执行 browser/profile/extension/Native Messaging/account/live/external-visible/read/write actions。
- 不运行 guardian、formal review、controlled merge 或 issue closeout；gate owner remains scheduler。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity、non-closing reference semantics 与 hosted checks：

- `bash scripts/setup-git-hooks.sh`
- `bash scripts/docs-guard.sh`
- `SPEC_GUARD_BASE_REF=origin/main bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0069-provider-owned-stealth-boundary/spec.md`
- `bash scripts/check-pr-purity.sh docs/1182-provider-owned-stealth-boundary main`
- `git diff --check origin/main...HEAD`
- same-class closing scan for auto-closing patterns against #1182/#1183/#1188/#1118
- same-class scope audit for browser patch implementation, fingerprint generation, provider adapter, runtime selection, risk gate implementation, read/write gate implementation, XHS driver, JSON-RPC, Syvert normalized result, account safety and live/browser action claims
- hosted GitHub checks after Draft PR push

语义自检：

- 对照 #1182，确认 scope 只覆盖 provider-owned stealth boundary and WebEnvoy non-ownership。
- 对照 #1183，确认 WebEnvoy-owned risk evidence boundary remains future owner and is not redefined here。
- 对照 #1188，确认 risk hint consumer gate remains future owner and is not implemented or specified here。
- 对照 `FR-0033`，确认 provider private patch remains limitation/ref, not WebEnvoy core contract。
- 对照 `FR-0040` / `FR-0041` / `FR-0059`，确认 private patch、fingerprint seed 和 fingerprint internals remain redacted/provider-private。

## TDD 范围

当前 PR 只冻结 formal boundary contract，不进入实现代码 TDD。

后续 implementation / parser / gate issue 应优先补以下测试：

- Missing provider-owned stealth boundary fails closed when capability requires stealth.
- Unknown provider-owned domain fails closed unless a later FR extends the enum.
- Provider private patch disclosure invalidates evidence.
- `declared_only` or `doctor_checked` cannot satisfy WebEnvoy-owned risk evidence.
- Redacted evidence ref with stale head/run/profile/target is rejected.
- Provider stealth presence does not produce read/write gate allow without #1183/#1188 consumption.
- #1183 risk evidence consumer rejects provider-private patch body as input.
- #1188 gate consumer requires #1183 risk hint semantics instead of direct provider stealth presence.

## 并行 / 串行关系

可并行：

- 不触碰 FR-0069 suite 的普通本仓库文档整理。
- #1183 可以做 prep-only 草案，但 final boundary freeze 必须消费本 FR，并不得重定义 provider-owned stealth。

串行 / 依赖：

- FR-0069 consumes merged `FR-0033 Browser Provider Contract` / #1123。
- FR-0069 consumes merged `FR-0040 Provider Evidence Kernel` and `FR-0041 Evidence Redaction Policy` for refs/redaction/fail-closed semantics。
- FR-0069 references `FR-0049` / `FR-0059` as CloakBrowser provider-private fingerprint boundary examples; it does not change those suites。
- #1183 must consume FR-0069 before freezing WebEnvoy-owned risk evidence and closeout/audit ownership。
- #1188 must consume #1183 rather than bypassing to provider stealth presence。
- Any future provider adapter, browser patch, risk gate, read/write gate, account safety or live evidence implementation must use separate issue/PR and applicable formal suite.

## 进入实现前条件

- FR-0069 spec review 通过。
- Reviewer 确认 provider-owned responsibility domains are provider/provider-adapter owned and not WebEnvoy core-owned。
- Reviewer 确认 WebEnvoy allowed consumption is limited to declaration、limitations、redacted refs、freshness/scope and blocking reasons。
- Reviewer 确认 provider doctor/pass/presence/fingerprint seed refs/private patch refs are non-proofs for WebEnvoy-owned risk evidence and read/write gate allow。
- Reviewer 确认 #1183 and #1188 handoff remains explicit and unimplemented in this PR。
- Reviewer 确认 PR metadata uses `Refs #1182` and does not auto-close #1182/#1183/#1188/#1118。
- Reviewer 确认本 suite 未混入 runtime/source code、tests、fixtures、scripts、workflows、browser/extension/native messaging/account/live/write action、Syvert normalized result、provider adapter implementation、XHS driver、JSON-RPC、guardian/formal review/merge/closeout。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0069-provider-owned-stealth-boundary/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1182 的映射。由于本 PR 不实现 runtime 行为，不需要 provider cleanup、profile cleanup、account cleanup、artifact cleanup、secret rotation、external rollback 或 live evidence invalidation。
