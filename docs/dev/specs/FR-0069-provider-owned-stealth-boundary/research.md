# FR-0069 Research Notes

## 研究问题

1. 当前仓库已冻结哪些 provider/private patch 边界，可以作为 #1182 的上游输入？
2. 哪些 stealth / fingerprint / browser patch 责任应明确留在 external browser provider，而不是 WebEnvoy core？
3. #1182 如何给 #1183/#1188 留出 WebEnvoy-owned risk/evidence 与 gate 消费空间？

## 输入事实

### Issue facts

- #1182 `Provider-Owned Stealth Boundary` 当前 OPEN，labels 包含 `kind:fr`、`area:risk-evidence`、`risk:high`、`provider:generic`、`integration:local-only`。
- #1182 body scope 是 “Document which stealth and fingerprint responsibilities belong to external browser providers rather than WebEnvoy.”
- #1182 comment 声明 `ready_now=yes`、`next_pr_shape=formal boundary/spec PR`、`does_not_wait_for: #1142, #1241`。
- #1183 `WebEnvoy-Owned Risk Evidence Boundary` 当前 OPEN，scope 是 “Define WebEnvoy-owned risk evidence, gates and closeout responsibilities independent of provider stealth internals.” 它依赖 #1182。
- #1188 `Risk Hint Consumer Gate` 当前 OPEN，scope 是 “Define how runtime risk hints are consumed by read/write gates and closeout evidence.” 它依赖 #1183。
- #1118 的 phase scope 是把旧 Layer 1-4 anti-detection planning 重新组织为 provider-owned stealth capabilities plus WebEnvoy-owned risk/evidence gates。

### Repo formal inputs

- `FR-0033 Browser Provider Contract` 已明确 provider private patch 不得提升为 WebEnvoy core contract，并把 `provider_private_patch_required` 定义为 limitation。
- `FR-0040 Provider Evidence Kernel` 已定义 provider evidence record 只能消费 evidence refs、redaction/sensitivity、freshness、scope 与 blocking reasons。
- `FR-0041 Evidence Redaction Policy` 已冻结 sensitive/secret evidence 的 redaction 约束。
- `FR-0049 cloakbrowser.direct Descriptor` 已把 CloakBrowser fingerprint seed boundary 定义为 provider-managed redacted boundary，不暴露 private patch schema。
- `FR-0059 CloakBrowser Fingerprint Seed Evidence Policy` 已明确 raw seed、private patch、fingerprint internals 不进入 WebEnvoy core contract 或 public surfaces。
- `docs/dev/architecture/system-design/boundary.md` 已规定 Provider 可承载执行能力、runtime 能力声明、健康诊断、证据产物或浏览器适配；provider 私有 stealth/patch 细节不能扩写成 WebEnvoy 默认主路径。

## 结论

### 1. Provider-owned stealth 是责任边界，不是 gate pass

Provider-owned stealth 可以被声明、诊断、引用和 fail-closed 消费，但它不是 WebEnvoy-owned risk pass。Provider declaration、doctor pass、descriptor pass、fingerprint seed ref 或 private patch ref 都只能说明 provider-owned lane 的输入状态，不能替代 #1183/#1188。

### 2. WebEnvoy core 应消费 refs 与 blockers，不消费 private payload

WebEnvoy 需要知道某个 provider 是否声称拥有 browser patch/fingerprint patch/stealth capabilities，以及该声明是否缺失、未知、stale、scope mismatch 或 redaction invalid。WebEnvoy 不需要也不应保存 patch body、hook body、seed raw value、browser binary diff 或 driver internal state。

### 3. #1182 应冻结 negative boundary and handoff

本 FR 的核心价值是“哪些不属于 WebEnvoy core”和“哪些必须交给 #1183/#1188”。因此它应冻结 non-proof rules、blocking reasons 与 handoff refs，而不是提前设计 risk evidence object 或 read/write gate matrix。

## 未解决问题

- #1183 需要定义 WebEnvoy-owned risk evidence object、accepted/blocked/unclassified semantics、closeout/audit owner 和 fail-closed matrix。
- #1188 需要定义 risk hint consumer gate 对 read/write gate、closeout evidence 和 command result 的消费规则。
- Future provider-specific suites 可以补充某个 provider 的 descriptor/capability/doctor/evidence details，但不得要求 WebEnvoy core 公开 provider internals。

## 失效条件

本 FR 的结论在以下情况下需要修订：

- 后续 formal spec 决定 WebEnvoy core 自己实现某类 browser/fingerprint patch，并通过 review 改变产品边界。
- Provider contract shape 扩展出新的 stable machine-readable stealth boundary，需要同步扩展 enum。
- Evidence redaction policy 改变 raw seed、private patch 或 driver internal state 的披露等级。
- #1183/#1188 冻结的 WebEnvoy-owned risk/evidence/gate semantics 需要新增 handoff blocker 或 consumption ref。
