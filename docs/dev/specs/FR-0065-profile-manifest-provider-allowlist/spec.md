# FR-0065 Profile Manifest Provider Allowlist

Canonical Issue: #1175

## 背景

`#1175 Profile Manifest Provider Allowlist` 属于 `#1117 Live Write Gate Alignment`。上游已经冻结并合入：

- `FR-0033 Browser Provider Contract` / #1123：provider identity、capability declaration、verification level 和 limitation 的通用表达。
- `FR-0062 Live-Write Capability Taxonomy` / #1174：`read_only`、`write_admit`、`write_prepare`、`live_write_commit` 的 capability vocabulary 和 fail-closed 语义。
- `FR-0064 Operator Unlock` / #1178：`live_write_commit` 必须有显式 operator unlock，且 unlock 只清除 operator lane。
- #1181 `Live-Write Evidence Redaction`：live-write evidence 中 account、profile、proxy、seed 和 secret-bearing paths 默认脱敏。

当前缺口是：live-write admission 在消费 provider contract、operator unlock、redaction policy 或后续 provider requirements 之前，缺少一份 profile-owned manifest，明确某个 profile 允许哪些 provider 被用于哪些 workflow / capability scope，以及这些 provider 所需的 secret references 是否以可审计、可脱敏的 locator 形式存在。

本 FR 只冻结 profile manifest provider allowlist 的 formal contract。它定义 admission 前必须消费的 profile manifest、allowed provider entries、secret refs、evaluation input/result 和 fail-closed rules。它不启用 `live_write_commit`，不实现 XHS publish，不执行 browser / profile / account / live / write action，也不扩大到 #1176/#1177/#1179/#1180 或 #835 recovery。

`#1175` issue meta 声明 `Close Semantics: fr-complete`。因此本 suite 合入后只完成 #1175 的 FR/spec freeze；runtime parser、profile storage、account safety、provider requirements、default lock、release gate 和 live evidence closeout 仍由后续 owner 承接。

## 目标

1. 冻结 `profile_manifest_provider_allowlist` 的最小契约，使 live-write admission 能在进入 provider / runtime / write gate 前确认 profile 是否声明允许目标 provider。
2. 冻结 allowed provider entry 的 provider identity、provider contract ref、workflow scope、capability level、target scope 和 verification expectation。
3. 冻结 secret references 的最小表达，要求 account / profile / provider / proxy / fingerprint seed 等敏感输入只能以 `secret_handle`、redacted locator 或等价 opaque ref 出现。
4. 冻结 evaluation result、blocking reasons 和 fail-closed 规则，使缺失 manifest、provider 不在 allowlist、secret ref 缺失或 raw secret 泄露时阻断 admission。
5. 明确本 FR 只清除 profile manifest allowlist blocker；不得替代 #1179 provider requirements、#1180 default lock、#1178 operator unlock、account safety、runtime target binding、anti-detection gate 或 live evidence gate。

## 非目标

- 不实现 runtime code、CLI、driver、adapter、provider selection、profile storage、secret store、tests、fixtures、scripts、workflows、guardian、formal review、controlled merge 或 issue closeout。
- 不执行 browser、profile、account、live、external-visible、upload、submit、publish、file picker、DataTransfer、editor text write、cleanup 或 rollback 操作。
- 不启用 `live_write_commit`，不解除 default commit lock，不声明 provider requirements pass、account safety clear、runtime target binding pass、anti-detection gate pass 或 live evidence accepted。
- 不实现 XHS publish，不定义 Syvert normalized result，不引入 CloakBrowser-as-core、browser patching、provider private patch schema 或跨仓 shared contract。
- 不修改 `FR-0033`、`FR-0041`、`FR-0062`、`FR-0064` 或 #1181 的字段 shape；只消费其已冻结的 provider、taxonomy、unlock 和 redaction 边界。
- 不扩大到 #1176、#1177、#1179、#1180、#1211 或 #835 recovery；这些 downstream owner 仍需提供自己的 evidence refs 和 gate disposition。

## 功能需求

### 1. Profile manifest ownership

系统必须把 profile manifest provider allowlist 的 formal owner 固定为 `#1175` / `FR-0065`。

约束：

- Profile manifest 只回答“这个 profile 是否声明允许某个 provider 在指定 workflow / capability / target scope 下参与 admission”。
- Profile manifest 不是 provider registry、provider requirement pass、operator unlock record、default lock release、account safety record、runtime readiness record、live evidence record 或 publish success。
- Downstream gate 必须消费本 FR 的 evaluation result，而不是从 profile 名称、branch、issue label、PR approval、merged spec 或 hosted checks pass 推断 provider allowlist。

### 2. Manifest identity and profile binding

`profile_manifest_provider_allowlist` 必须至少包含：

- `schema_version`
- `manifest_id`
- `canonical_issue_ref`
- `profile_ref`
- `profile_scope_ref`
- `manifest_version`
- `owner_ref`
- `head_sha`
- `created_at`
- `expires_at`
- `revoked_at`
- `allowed_providers`
- `secret_refs`
- `evidence_refs`

约束：

- `profile_ref` 必须是 logical / opaque profile ref，不得是 raw user data dir、private absolute path、account id、email、phone、cookie、token 或 storage dump。
- `profile_scope_ref` 必须能表达该 manifest 适用的 profile namespace / environment boundary，但不得泄露 private path。
- `canonical_issue_ref` 必须为 `#1175`。
- `schema_version` 当前冻结为 `profile-manifest-provider-allowlist.v1`。
- `expires_at` 必须存在；过期 manifest 必须 fail closed。
- `revoked_at` 非空时，该 manifest 必须失效。

### 3. Allowed provider entries

每个 allowed provider entry 必须至少包含：

- `provider_id`
- `provider_contract_ref`
- `provider_family`
- `provider_mode`
- `allowed_workflow_refs`
- `maximum_capability_level`
- `allowed_target_domains`
- `allowed_target_pages`
- `required_secret_kinds`
- `required_provider_requirement_ref`
- `minimum_verification_level`
- `risk_constraints`
- `evidence_refs`

约束：

- `provider_id`、`provider_family`、`provider_mode` 和 verification vocabulary 必须消费 `FR-0033`，不得发明 provider 私有别名。
- `maximum_capability_level` 必须消费 `FR-0062` 四个 level；未知 level 必须 fail closed。
- `maximum_capability_level=live_write_commit` 只表示 manifest 声明该 provider 可被纳入后续 exact-scope gate 评估，不表示 commit 可用。
- `allowed_workflow_refs`、`allowed_target_domains`、`allowed_target_pages` 必须精确匹配 admission request；缺失、通配过宽或 scope mismatch 必须阻断。
- `required_provider_requirement_ref` 是 locator。它可以指向 #1179 或等价 downstream provider requirement disposition，但本 FR 不生成 provider requirement pass。
- `minimum_verification_level` 只表达 admission 对 provider contract / capability proof 的最低期望；实际验证仍由 provider requirement / runtime owner 提供。

### 4. Secret references

Manifest 必须声明 provider admission 所需 secret refs，至少支持以下 secret kind：

- `profile_storage_secret`
- `provider_auth_secret`
- `proxy_credential`
- `fingerprint_seed`
- `native_messaging_secret`
- `extension_private_payload`
- `account_auth_material`

每个 secret ref 必须至少包含：

- `secret_kind`
- `secret_ref`
- `locator_kind`
- `redaction_state`
- `scope_ref`
- `owner_ref`
- `expires_at`

约束：

- `locator_kind` 只能为 `secret_handle`、`private_locator`、`public_locator` 或后续 redaction policy 明确允许的等价 locator。
- 任何 credential、cookie、token、storage secret、proxy secret、fingerprint seed 或 provider private payload 都不得以 raw value 出现在 manifest、PR body、stdout summary、fixture、spec sample 或 public artifact。
- `secret_handle` 只能证明 secret 存在和被引用，不能提供可恢复 secret。
- `redaction_state` 必须消费 `FR-0041` / #1181 的 redaction 语义；`redaction_required`、`policy_missing`、`invalid` 或 raw secret leak 必须阻断 admission。
- Secret ref 的 `scope_ref` 必须与 profile、provider、workflow 和 target scope 匹配；scope mismatch 必须 fail closed。

### 5. Admission evaluation input

Profile manifest allowlist evaluator 必须消费以下输入：

- `requested_profile_ref`
- `requested_provider_id`
- `requested_provider_contract_ref`
- `requested_workflow_ref`
- `requested_capability_level`
- `requested_target_domain`
- `requested_target_page`
- `requested_required_secret_kinds`
- `requested_provider_requirement_ref`
- `requested_head_sha`
- `profile_manifest_provider_allowlist`
- `evaluated_at`

约束：

- `requested_capability_level` 必须使用 `FR-0062` level。
- `write_admit` 或更高 level 必须提供 provider contract ref、workflow ref、target scope 和 required secret kinds。
- Missing manifest 返回 `profile_manifest_missing`。
- Missing or mismatched provider entry 返回 `provider_not_allowed` 或 `provider_contract_ref_mismatch`。
- Missing secret refs 返回 `secret_ref_missing`。
- Raw secret / invalid redaction 返回 `secret_redaction_invalid` 或 `raw_secret_present`。

### 6. Admission evaluation result

Profile manifest allowlist evaluator 必须输出下游可消费的 result。

Allowed status:

- `not_requested`
- `missing_manifest`
- `provider_not_allowed`
- `workflow_not_allowed`
- `target_scope_mismatch`
- `capability_not_allowed`
- `provider_contract_mismatch`
- `secret_ref_missing`
- `secret_ref_invalid`
- `redaction_invalid`
- `manifest_expired`
- `manifest_revoked`
- `head_mismatch`
- `accepted`

Allowed decision:

- `allow`
- `deny`
- `defer`

约束：

- `decision=allow` 只在 status 为 `accepted` 且 blocking reasons 为空时有效。
- `decision=allow` 只表示 profile manifest allowlist blocker 已清除；它不允许绕过 #1179 provider requirements、#1178 operator unlock、#1180 default lock、account safety、runtime target binding、anti-detection gate、FR-0016 live evidence 或 FR-0032 controlled success ladder。
- 任一 blocker 存在时，decision 必须为 `deny` 或 `defer`。
- Formal spec examples 可以使用 `evaluated_at=N/A`；真实 evaluator 输出必须使用 concrete timestamp。

### 7. Fail-closed blocking reasons

本 FR 至少冻结以下 blocking reasons：

- `profile_manifest_missing`
- `profile_ref_mismatch`
- `provider_not_allowed`
- `provider_contract_ref_missing`
- `provider_contract_ref_mismatch`
- `provider_requirement_ref_missing`
- `workflow_not_allowed`
- `target_scope_mismatch`
- `capability_level_unknown`
- `capability_not_allowed`
- `secret_ref_missing`
- `secret_ref_scope_mismatch`
- `secret_ref_expired`
- `secret_redaction_invalid`
- `raw_secret_present`
- `manifest_expired`
- `manifest_revoked`
- `manifest_head_mismatch`
- `evidence_ref_missing`
- `downstream_owner_required`

约束：

- Unknown provider id、unknown capability level、unknown secret kind 或 unknown redaction state 必须 fail closed。
- `raw_secret_present` 对任意 admission request 都必须 blocking。
- `provider_requirement_ref_missing` 表示本 manifest 缺少 downstream provider requirement locator；它不由本 FR 自动补齐。
- `downstream_owner_required` 表示本 FR 已完成 allowlist 判断，但还需要 #1179/#1180/#1211 或 runtime/live owner 继续判定。

### 8. Downstream handoff

本 FR 冻结以下 handoff：

| downstream item | 消费输入 | 本 FR 不提供 |
|---|---|---|
| #1179 Provider Requirements | accepted manifest result, provider entry, required secret refs | provider requirement pass |
| #1180 Default Lock | manifest result as one prerequisite ref | default lock release |
| #1211 Live Write Gate Matrix | allowlist status, blockers, secret redaction blockers | release gate pass |
| Runtime/profile owner | manifest shape and exact profile/provider scope | profile storage, secret store, runtime parser |
| FR-0032 / #835 baseline | historical controlled-success context only | current live evidence or recovery |

约束：

- #1175 合入后只能说明 profile manifest allowlist contract frozen；不能关闭 #1179/#1180/#1211。
- Downstream implementation 必须提供 current manifest instance、current secret refs 和 current provider requirement disposition；不能把本 spec 文本当作 profile manifest instance。

## 异常与边界场景

### 1. Provider contract 存在但 profile manifest 未允许

Given `FR-0033` provider contract 声明 provider 支持 page automation
When requested provider 不在 profile manifest allowlist 中
Then profile manifest evaluator returns `provider_not_allowed`
And decision is `deny`.

### 2. Secret ref 缺失

Given requested workflow requires `proxy_credential` and `fingerprint_seed`
When profile manifest allowed provider entry lacks one required secret ref
Then decision is `deny`
And blocking reasons include `secret_ref_missing`.

### 3. Raw secret 出现在 manifest

Given manifest includes a raw cookie, token, proxy password, fingerprint seed or private profile path
When admission evaluates the manifest
Then result is `redaction_invalid`
And blocking reasons include `raw_secret_present`.

### 4. Manifest allow 并不等于 commit allow

Given profile manifest result is accepted for `write_admit`
When downstream gate requests `live_write_commit`
Then downstream still requires #1178 operator unlock, #1180 default lock release, provider requirements, account safety, runtime target binding, anti-detection gate and live evidence
And profile manifest result alone cannot allow commit.

### 5. Head 或 scope drift

Given a manifest was accepted for head A, profile A and target page A
When a later admission request uses head B, profile B or target page B
Then evaluator returns `head_mismatch` or `target_scope_mismatch`
And decision is `deny` or `defer`.

### 6. #835 closed state is reused

Given #835 is closed
When a PR or gate tries to use that closed state as profile manifest allowlist evidence
Then evaluator must reject it as missing current manifest evidence
And downstream live evidence remains required.

## 验收标准

1. `spec.md` freezes manifest ownership, allowed provider entries, secret refs, evaluator input/result, fail-closed blockers and downstream handoff.
2. `contracts/profile-manifest-provider-allowlist.md` provides machine-consumable TypeScript-style interfaces and minimum redacted examples.
3. `data-model.md` explains logical entities without introducing SQLite schema, migrations or runtime storage.
4. `plan.md` includes required seven sections and keeps runtime/live/write actions out of scope.
5. `research.md` records issue #1175 readback, dependency consumption and boundary decisions.
6. `risks.md` covers provider allowlist bypass, secret leakage, manifest staleness, commit unlock confusion and #835 evidence misuse.
7. The PR only changes the FR-0065 suite and the #1175 sync-map entry, uses `Fixes #1175` only because #1175 is `fr-complete`, and keeps runtime/source/live actions out of scope.

## GWT 验收场景

### 场景 1：profile manifest 缺失时阻断 admission

Given a workflow requests `write_admit`
When no profile manifest provider allowlist exists for the requested profile
Then decision is `deny`
And blocking reasons include `profile_manifest_missing`.

### 场景 2：provider 不在 allowlist 中时阻断

Given profile manifest allows provider A
When admission requests provider B
Then decision is `deny`
And blocking reasons include `provider_not_allowed`.

### 场景 3：secret refs 必须是 locator

Given an allowed provider requires `provider_auth_secret`
When manifest uses a raw token instead of `secret_handle` or redacted locator
Then decision is `deny`
And blocking reasons include `raw_secret_present`.

### 场景 4：accepted manifest 只解除 allowlist blocker

Given profile manifest evaluation is accepted
When downstream requests `live_write_commit`
Then downstream must still require provider requirements, default lock, operator unlock, account safety, runtime target binding, anti-detection gate and live evidence.

### 场景 5：formal spec PR 不声明 live evidence

Given FR-0065 is a formal spec PR
When reviewer checks PR metadata and suite text
Then live evidence is marked not applicable
And no browser/account/runtime/live/write action is claimed.
