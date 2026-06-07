# FR-0035 risks

## 风险 1：把声明当作验证结果

- 风险：provider 自报 capability 后，后续 selection 直接把 `declared` 当作业务可用。
- 影响：未验证执行面被用于业务 read/write/download，导致运行时失败或证据虚假放行。
- 缓解：本 FR 明确默认业务 capability 不接受 `declared`；minimum requirement 与 source aggregation 必须 fail-closed。
- 回滚：如后续实现误用，回退实现 PR，并保留本 formal model 作为阻断依据。

## 风险 2：doctor / health check 被误当作 live evidence

- 风险：provider health check 通过后，被描述为真实页面交互或 latest-head live evidence 完成。
- 影响：绕过 FR-0016 live evidence gate，污染 closeout / merge-ready 证据。
- 缓解：本 FR 将 `health_checked`、`runtime_observed`、`live_evidence_attested` 分开，并要求 live evidence 必须引用适用 gate。
- 回滚：撤回错误 PR metadata 或实现逻辑，重新补 latest-head live evidence。

## 风险 3：verification record 演变成 registry 或 doctor schema

- 风险：为了方便后续实现，把 registry lifecycle、doctor command/report schema 或 runtime persistence 写进本 FR。
- 影响：#1124 scope 扩张，阻塞后续 issue ownership，增加 review 风险。
- 缓解：本 FR 明确只冻结共享判定对象与 source 语义；registry、doctor、evidence kernel 由后续事项承接。
- 回滚：拆出超出范围字段到对应 downstream issue / PR。

## 风险 4：Syvert normalized result 污染 provider verification model

- 风险：因为 Syvert 未来可能消费 provider verdict，把 normalized result、业务 schema 或 product workflow 写入 WebEnvoy core formal model。
- 影响：违反 M1 boundary，制造跨仓耦合。
- 缓解：本 FR 只保留 provider/runtime capability verification 语义；PR metadata 使用 provider/shared-contract gate，但 `external_dependency=none`、`joint_acceptance_needed=no`。
- 回滚：移除 Syvert-specific 字段，恢复 WebEnvoy core provider boundary。

## 风险 5：provider 私有 patch 细节进入 core contract

- 风险：managed browser provider 为证明 capability 暴露 stealth patch、driver state 或 browser patch 参数。
- 影响：把 provider 私有实现提升成 WebEnvoy core contract，破坏自主边界和可替换性。
- 缓解：本 FR 只允许 limitation、requirement 或 evidence ref locator 表达，不内联私有 patch schema。
- 回滚：删除私有字段，并以 `provider_private_patch_required` 或后续 provider-specific adapter contract 承接。

## 风险 6：证据 freshness / provenance 不足

- 风险：旧 head、旧 run、历史 artifact 或同 head 历史产物被复用为当前 latest-head gate 证据。
- 影响：merge-ready / closeout 证据失效。
- 缓解：本 FR 要求 evidence ref 记录 source、collected_at、head_sha、run_id、scope；live evidence gate 必须追溯 latest-head fresh rerun。
- 回滚：将 decision 降级为 `defer` 或 `deny`，补 fresh evidence 后再进入 gate。
