# FR-0040 risks

## 风险等级

High。

理由：本 FR 冻结 provider/runtime evidence shared contract，影响后续 provider admission、capability verification、closeout evidence、diagnostics / observability 与 integration gate 判断。虽然本 PR 不实现 runtime 行为，但 contract 一旦合入会成为后续实现和 review 的正式输入。

## 主要风险

### 1. Evidence contract 越权为 live evidence gate

风险：后续实现或 PR metadata 可能把 `provider_evidence_record` 误写成 `FR-0016.live_evidence_record`，或把 bootstrap ack、runtime ping、doctor pass 当作真实页面闭环证据。

缓解：

- spec 明确 `live_evidence_ref` 只能引用已被适用 gate 接受的 live evidence。
- closeout plan 的 `allow` 只表示 provider evidence record 层满足当前 coverage，不代表 guardian / GitHub checks / live evidence gate / merge gate 通过。
- fail-closed blocking reasons 包含 `live_evidence_required` 与 `runtime_attestation_required`。

### 2. Secret / profile / provider private payload 泄露

风险：evidence record 若直接保存 profile path、Cookie、token、proxy credential、fingerprint seed、Native Host secret 或 provider private patch payload，会扩大账号与安全风险。

缓解：

- spec 与 contract 要求 profile、network、fingerprint、Native Host、allowed origin 均使用 redacted locator。
- `sensitivity=secret` 不得进入 PR body、stdout summary 或 unredacted artifact。
- `redaction_state=policy_missing|invalid` 命中 required evidence 时必须阻断。

### 3. Freshness 漂移

风险：历史 artifact、旧 head run 或 same-head 历史产物被误用为当前 launch / current PR head proof。

缓解：

- evidence ref 冻结 `freshness` enum。
- `historical_background` 不得满足 `current_launch` 或 `current_pr_head`。
- closeout plan 必须显式记录 `required_freshness` 与 `evidence_freshness_stale` blocker。

### 4. #1127 / #1129 scope 污染

风险：本 FR 为了完整性顺手定义 provider doctor schema 或完整 redaction policy，导致与 #1127 / #1129 冲突。

缓解：

- 本 FR 只保留可选 `provider_health_ref` locator，不定义 doctor report。
- 本 FR 只冻结最小 redaction hooks，不冻结完整 policy。
- plan 明确不触碰 #1127 / PR #1224 和后续 redaction policy implementation。

### 5. Integration metadata 误判

风险：Issue label 为 local-only，但 PR 实际冻结 provider/shared evidence contract；若 metadata 申报 local_only，会绕过 provider/shared-contract gate。

缓解：

- research 记录 integration 判断。
- PR metadata 使用 `integration_applicable=yes`、`integration_ref=#1111`、`merge_gate=integration_check_required`。
- 不引入 Syvert external dependency 或 joint acceptance，避免过度升级。

## 回滚

如 suite 被判定边界错误，使用 revert PR 移除 `FR-0040-provider-evidence-kernel` suite 与 `.github/spec-issue-sync-map.yml` 中 #1128 映射。由于本 PR 不实现 runtime 行为，无需数据迁移、profile 清理或 external runtime rollback。
