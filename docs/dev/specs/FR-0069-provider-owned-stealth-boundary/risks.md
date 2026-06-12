# FR-0069 Risks

## 风险 1：把 provider stealth presence 误当成 risk pass

触发条件：

- Consumer 看到 provider 声明 stealth、doctor pass、fingerprint seed ref 或 private patch ref，就直接放行 read/write gate。

影响：

- WebEnvoy 会绕过 #1183/#1188 的 risk evidence 与 gate consumer，导致高风险 runtime 行为缺少 WebEnvoy-owned evidence。

缓解：

- 本 FR 冻结 non-proof rules。
- blocking reasons 包含 `webenvoy_risk_evidence_required` 与 `risk_hint_consumer_required`。
- #1188 必须消费 #1183 risk hints，不得直接消费 provider private patch presence。

剩余风险：

- 后续实现仍可能误用 provider doctor pass；需要在 #1183/#1188 parser/gate tests 中覆盖。

## 风险 2：provider private patch 或 fingerprint secret 泄露

触发条件：

- PR metadata、stdout summary、fixture、evidence artifact 或 spec sample 内联 raw seed、private patch payload、hook body、driver internal state、browser binary diff 或可逆 seed preview。

影响：

- 泄露 provider proprietary details、账号/环境隐私或可被滥用的反检测绕过信息。

缓解：

- 本 FR 固定 provider-private default disclosure boundary。
- Allowed public fields 限制为 provider id、contract ref、domain enum、limitation、redacted ref、blocking reason、handoff owner。
- Forbidden disclosure 命中时必须 `redaction_invalid` / blocker。

剩余风险：

- 实现或手工证据仍可能附带过宽日志；后续 evidence parser 和 PR metadata guard 需要专项检测。

## 风险 3：WebEnvoy core 被反向扩 scope 到 browser patch 实现

触发条件：

- 下游事项要求 WebEnvoy 维护 provider stealth 参数、JS/Worker patch、browser binary patch 或 seed derivation。

影响：

- WebEnvoy core 与 provider boundary 混杂，增加安全、维护、法律和审查风险。

缓解：

- 本 FR 明确 WebEnvoy non-owned domains。
- Provider-owned domains 只能通过 declaration、limitation、redacted refs 和 blockers 被消费。
- 任何 scope 改变必须另开 formal spec review。

剩余风险：

- Future provider-specific pressure 可能要求更细 interface；应在 provider suite 内保持 opaque/ref/fail-closed，而不是泄露实现。

## 风险 4：#1183/#1188 重新定义或绕过 #1182

触发条件：

- #1183 为了定义 risk evidence 而重新展开 provider patch schema。
- #1188 为了 gate 消费而直接从 provider stealth presence 推导 allow。

影响：

- 责任边界失效，risk/evidence gate 与 provider-owned private implementation 混为一体。

缓解：

- 本 FR 的 handoff refs 明确 owner：#1182 owns provider stealth boundary，#1183 owns WebEnvoy risk evidence，#1188 owns consumer gate。
- GWT 场景要求 #1183/#1188 不得重定义 provider internals 或绕过 #1183。

剩余风险：

- 后续 review 必须用本 FR 作为检查基线。

## 风险 5：scope drift 到实现或 live evidence

触发条件：

- 当前 PR 顺手修改 provider adapter、runtime selection、risk gate、read/write gate、account safety、live evidence、XHS driver、JSON-RPC 或 Syvert normalized result。

影响：

- Formal spec review PR 混入实现，破坏高风险事项分离和 scheduler gate ownership。

缓解：

- Allowed write paths 限定为 FR-0069 suite 与 sync-map mapping。
- PR purity、docs/spec guard、diff check 和 closing semantics scan 必须通过。
- Gate owner remains scheduler；worker 不运行 guardian/formal review/controlled merge/issue closeout。

剩余风险：

- Hosted checks 或 PR metadata 仍可能暴露 scope drift；进入 scheduler gate 前必须 read back PR diff/body。
