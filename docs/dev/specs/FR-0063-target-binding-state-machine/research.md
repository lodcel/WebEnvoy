# FR-0063 Research Notes

## 证据输入

本 FR 只基于仓库内已冻结 formal inputs、#1161 issue scope 与 scheduler delegation 起草：

- `#1161 Target Binding State Machine`
- `#1115 XHS Driver Boundary`
- `#1162 Page Ready / Runtime Ready Contract`
- `#1171 Signed Continuity Binding`
- `FR-0061 XHS Driver Contract`
- `FR-0062 Live-Write Capability Taxonomy`
- `docs/dev/architecture/system-design.md`
- `docs/dev/architecture/system-design/execution.md`
- `docs/dev/architecture/system-design/read-write.md`
- `docs/dev/architecture/system-design/boundary.md`
- `docs/dev/architecture/system-design/adapter.md`

未执行 XHS 页面、browser、profile、account、provider adapter、runtime、live read/write、external-visible 或 Syvert probe。

## 判断

Target Binding State Machine 应当冻结为 WebEnvoy-local runtime binding lifecycle contract，而不是实现或 readiness proof。

原因：

- `FR-0061` 已把 runtime binding 限定为 locator / expected binding boundary，#1161 只应细化其状态生命周期。
- `bound` 需要成为 #1162/#1171 可消费的稳定输入，但不能替代 #1162 的 page/runtime ready 或 #1171 的 signed continuity。
- `stale` 与 `lost` 必须成为一等状态，否则下游容易复用旧 tab、旧 bridge ack、旧 DOM observation 或历史 artifact。
- live-write 能力已由 `FR-0062` 冻结为默认 locked；target binding 不应提高 write capability。
- Syvert normalized result、resource taxonomy 与 error taxonomy 属于 consuming layer，不应写入 WebEnvoy target binding contract。

## Integration 判断

#1161 issue label 为 `integration:local-only`，本 FR 只冻结 WebEnvoy-local Target Binding State Machine。虽然本 suite 明确 #1162/#1171 handoff 和 Syvert boundary，但不定义 Syvert-owned normalized result，不改跨仓共享契约，不要求 joint acceptance。

因此当前 PR metadata 应为：

- `integration_applicable=no`
- `integration_touchpoint=none`
- `integration_ref=none`
- `external_dependency=none`
- `merge_gate=local_only`
- `joint_acceptance_needed=no`

## Live evidence 判断

本 FR 不执行 real browser、profile、account、live page、read/write 或 external-visible 动作，也不把 live evidence 作为完成依据。

因此当前 PR metadata 应为：

- `gate_applicability.review_lane=formal_spec_review_pr`
- `gate_applicability.in_scope=false`
- `gate_applicability.n_a_allowed=true`
- `live_evidence_record=N/A`

## 触发补齐文件的理由

- `contracts/`：本 FR 定义 stable machine-consumable state enum、transition evidence、snapshot shape 和 forbidden fields。
- `data-model.md`：本 FR 引入 target binding lifecycle、snapshot、transition evidence 与 downstream handoff。
- `research.md`：FR-0061 runtime binding、#1162/#1171 downstream ownership、FR-0062 live-write boundary 与 Syvert boundary 容易混淆，需要冻结判断来源。
- `risks.md`：该 scope 涉及 stale evidence reuse、runtime/page ready proof confusion、signed continuity confusion、write/live scope creep、Syvert boundary 与 sensitive locator 泄露。

## 当前未决项

无需要外部 probe 才能冻结的 formal scope 未决项。

后续 implementation / downstream issue 仍需独立决定：

- Target candidate discovery implementation。
- CLI / JSON-RPC / Native Messaging exposure。
- Page Ready / Runtime Ready evaluator。
- Signed continuity algorithm and artifact writer。
- Evidence artifact writer。
- Parser / validator tests。
- XHS read path implementation。
- Syvert-owned normalization and taxonomy mapping。
