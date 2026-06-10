# FR-0061 Research Notes

## 证据输入

本 FR 只基于仓库内已冻结 formal inputs、#1158 issue scope 与 scheduler delegation 起草：

- `#1158 XHS Driver Contract`
- `#1115 XHS Driver Boundary`
- `FR-0024 XHS Request-Shape Truth`
- `FR-0025 XHS Detail / User Home Command Surface`
- `FR-0030 XHS Closeout Route Evidence`
- `FR-0033 Browser Provider Contract`
- `FR-0035 Provider Capability Verification Model`
- `FR-0040 Provider Evidence Kernel`
- `FR-0041 Evidence Redaction Policy`
- `FR-0048` 到 `FR-0060` formal suite carrier patterns

未执行 XHS 页面、browser、profile、account、provider adapter、runtime、live read/write、external-visible 或 Syvert probe。

## 判断

XHS driver contract 应当先冻结为 WebEnvoy-local output/evidence contract，而不是实现或跨仓 product normalized result。

原因：

- `raw`、`operational`、`evidence` 是 WebEnvoy driver 和后续 implementation slices 都需要的稳定边界。
- Syvert normalized result、resource taxonomy 与 error taxonomy 属于 Syvert consuming layer，不应在 WebEnvoy driver contract 中抢占 ownership。
- Runtime binding 是定位输入和 evidence ref，不等于 runtime ready 或 target tab ready。
- Provider requirement 是 WebEnvoy driver 的需求声明，不等于 provider capability support；support 必须由 provider/capability/evidence owners 判定。
- Live write、JSON-RPC 扩展和 browser/account/live 操作都会显著扩大风险，不属于 #1158 narrow contract。

## Integration 判断

#1158 issue label 为 `integration:local-only`，本 FR 只冻结 WebEnvoy-local XHS driver contract。虽然合同明确 Syvert boundary，但不定义 Syvert-owned normalized result，不改跨仓共享契约，不要求 joint acceptance。

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

- `contracts/`：本 FR 定义 stable machine-consumable XHS driver output / binding / provider requirement / slicing input surface。
- `data-model.md`：本 FR 引入 output envelope、runtime binding、provider requirement 与 slicing lifecycle。
- `research.md`：XHS driver、Syvert normalized result、provider runtime 与 live evidence ownership 容易混淆，需要冻结判断来源。
- `risks.md`：该 scope 涉及 downstream ownership、evidence redaction、provider gate bypass、live-write/JSON-RPC scope creep 与 Syvert boundary 风险。

## 当前未决项

无需要外部 probe 才能冻结的 formal scope 未决项。

后续 implementation / downstream issue 仍需独立决定：

- XHS read path implementation。
- CLI / JSON-RPC / Native Messaging exposure。
- Runtime binding resolver。
- Provider capability selection。
- Evidence artifact writer。
- Parser / validator tests。
- Syvert-owned normalization and taxonomy mapping。
