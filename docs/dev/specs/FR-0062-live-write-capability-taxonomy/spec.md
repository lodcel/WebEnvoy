# FR-0062 Live-Write Capability Taxonomy

Canonical Issue: #1174

## 背景

`#1174` 属于 `#1117 Live Write Gate Alignment`，目标是在下游 live-write gate 工作开始前，先冻结一套窄的能力层级与门禁词汇。当前仓库已经有 `FR-0031` 的 creator live write admission、`FR-0032 / #835` 的 controlled live write success、`FR-0033` 的 provider contract、`FR-0035` 的 capability verification model，以及 `FR-0040` / `FR-0041` 的 evidence / redaction 规则。但这些输入没有统一回答一个更基础的问题：一个 workflow 何时只是 read-only，何时只是允许进入写入准入，何时只是准备写入，何时才可以请求真实外部可见提交。

如果没有这层 taxonomy，后续 `#1178 Operator Unlock`、`#1179 xhs.creator_publish.admit Provider Requirements`、`#1180 live_write_commit Default Lock` 和 `#1211 Live Write Gate Matrix` 容易把 non-write readiness、provider capability declaration、operator approval、account safety 或 #835 历史 baseline 混写成默认可提交。

本 FR 只冻结 taxonomy、gate vocabulary、downstream ownership 和 fail-closed 语义。它不启用 `live_write_commit`，不实现 XHS publish，不执行 browser / profile / account / live 操作，也不修复或重开 #835。

## 目标

1. 冻结 live-write capability levels：`read_only`、`write_admit`、`write_prepare`、`live_write_commit`。
2. 冻结 gate vocabulary，使 downstream gate 可以稳定表达 requested / effective / blocked capability。
3. 冻结每个 capability level 的 required owner、required evidence class 和 fail-closed 规则。
4. 明确 #1178、#1179、#1180、#1211 如何消费本 taxonomy，且不能反向扩大 #1174 scope。
5. 明确 #835 closed baseline 只能作为历史/上游背景，不能被 #1174 解释为 live write commit 默认可用。

## 非目标

- 不实现 runtime code、driver、adapter、provider selection、CLI、tests、fixtures、scripts、workflows、guardian、formal review、controlled merge 或 issue closeout。
- 不执行 browser、profile、account、live、external-visible、upload、submit、publish、file picker、DataTransfer、editor text write 或 cleanup 操作。
- 不启用默认 `live_write_commit`，不建立 operator unlock UI，不创建 profile allowlist，不声明 account safety clear。
- 不修改 `FR-0031` creator admission、`FR-0032` controlled success、`FR-0033` provider contract、`FR-0035` verification model、`FR-0040` evidence kernel 或 `FR-0041` redaction policy 的字段 shape。
- 不定义 Syvert normalized result、XHS publish implementation、CloakBrowser-as-core、browser patching、provider private patch schema 或跨仓 shared contract。
- 不修复、不重开、不关闭 #835；#835 的 closed 状态不是本 PR 的 gate evidence。

## 功能需求

### 1. Taxonomy ownership

系统必须冻结一个稳定的 `live_write_capability_taxonomy`。

约束：

- Owner 固定为 `#1174` / `FR-0062`。
- 本 taxonomy 只定义 capability level、gate vocabulary、owner handoff 和 fail-closed semantics。
- 本 taxonomy 不得被解释为 runtime gate result、provider capability proof、operator unlock record、account safety record、live evidence record 或 release gate pass。
- Downstream owner 必须消费本 taxonomy，而不是重新发明相邻 capability names。

### 2. Capability levels

系统必须支持以下有序 capability levels：

| level | 语义 | 外部可见写入 |
|---|---|---|
| `read_only` | 只允许读取、侦察、诊断、状态提取、dry-run 或 non-write readiness。 | 禁止 |
| `write_admit` | 允许判断一个写入 workflow 是否具备进入写入准备的 admission prerequisites。 | 禁止 |
| `write_prepare` | 允许准备写入前置，例如 target binding、artifact staging plan、draft/preflight planning 或 non-commit preparation。 | 禁止真实提交 |
| `live_write_commit` | 允许在所有 gate 满足后请求真实外部可见提交动作。 | 可能发生，默认锁定 |

约束：

- Capability levels 只能按从低到高升级；任何 higher level 缺少 required gate 时必须降为 blocked / deny，而不是回退为隐式 allow。
- `write_admit` 不等于 `write_prepare`。
- `write_prepare` 不等于 `live_write_commit`。
- `live_write_commit` 必须默认 locked，直到 #1178 operator unlock、#1180 default commit lock、#1179 provider requirements 和 applicable risk / evidence gates 同时满足。

### 3. Gate vocabulary

Gate 输入必须能表达：

- `requested_capability_level`
- `effective_capability_level`
- `maximum_capability_level`
- `minimum_required_level`
- `capability_owner`
- `gate_status`
- `decision`
- `blocking_reasons`
- `downstream_owner`
- `evidence_refs`

Allowed values:

- `requested_capability_level`、`effective_capability_level`、`maximum_capability_level`、`minimum_required_level` 使用本 FR 的四个 level。
- `gate_status` 至少支持 `not_applicable`、`eligible`、`deferred`、`blocked`、`locked`、`ready_for_downstream_gate`。
- `decision` 只能为 `allow`、`deny`、`defer`。

约束：

- `decision=allow` 只表示当前 gate 对该 level 不再阻断；它不替代 downstream gate、runtime attestation、operator unlock、account safety 或 live evidence。
- `gate_status=ready_for_downstream_gate` 表示移交下游 owner 继续判定，不表示 live-write success。
- `gate_status=locked` 必须优先于 `eligible`。
- Unknown level、unknown gate vocabulary、unknown owner 或 missing evidence refs 必须 fail closed。

### 4. Level-specific minimum requirements

`read_only` 最低要求：

- 目标 workflow 不产生外部可见写入。
- 不触发 upload、submit、publish、delete、hide、rollback 或任何账号写动作。
- Evidence 可以是 static / diagnostic / dry-run / read-only runtime refs，但不得冒充 live evidence。

`write_admit` 最低要求：

- 请求必须绑定 explicit write scope，例如 `xhs.creator_publish.admit`。
- 必须提供 target domain、target page、requested workflow、provider requirement ref 和 risk gate refs。
- Provider requirement 只能证明 admission prerequisite，不证明提交可用。
- Missing provider requirement、account safety unknown 或 stale admission evidence 必须 blocked / deny。

`write_prepare` 最低要求：

- 必须先满足 `write_admit`。
- 必须明确 preparation boundary，不得通过准备动作触发真实提交。
- Artifact staging、target restore、draft state、locator verification 或 non-write page readiness 都必须保持可停止、可审计和 non-commit。
- 若 preparation 需要触碰账号状态或页面写入候选状态，必须由下游 issue 单独冻结并保留 stop / cleanup policy。

`live_write_commit` 最低要求：

- 必须先满足 `write_prepare`。
- 必须有 #1178 operator unlock record。
- 必须有 #1180 default commit lock 明确解除且 scope 精确匹配。
- 必须有 #1179 provider requirements pass 或 equivalent accepted downstream gate。
- 必须有 current account safety clear、runtime/profile/target binding、applicable anti-detection / evidence gates 和 latest-head live evidence requirements。
- 必须遵循 FR-0032 / downstream controlled live write success ladder；任何 missing / stale / fake / stub / control-plane-only evidence 必须 blocked / deny。

### 5. Downstream ownership

本 taxonomy 冻结以下 ownership：

| downstream item | owner role | 可消费本 FR 的内容 | 不得做的事 |
|---|---|---|---|
| #1178 Operator Unlock | Operator unlock FR | `live_write_commit` 必须显式 operator unlock | 不得把 operator unlock 写成本 FR 已满足 |
| #1179 Provider Requirements | `xhs.creator_publish.admit` work item | `write_admit` / `write_prepare` 的 provider requirement vocabulary | 不得启用 default commit |
| #1180 Default Lock | Default commit lock FR | `live_write_commit` 默认 locked / fail closed | 不得把 lock 解除写成 taxonomy merge 的副作用 |
| #1211 Live Write Gate Matrix | Release gate closeout | 四层 capability levels 与 gate vocabulary | 不得引入 implementation scope 或 live evidence claim |

约束：

- Downstream owner 可以引用本 taxonomy，但必须在各自 PR 中提供自己的 evidence refs、gate status 和 closing semantics。
- #1174 合入后只能说明 taxonomy frozen；不能关闭 #1178/#1179/#1180/#1211。
- #1174 PR 使用 `Refs #1174`，不得使用 auto-closing keyword。

### 6. #835 baseline disposition

系统必须把 #835 视为历史 baseline / related controlled-success owner，而不是本 taxonomy 的 live evidence。

约束：

- #835 CLOSED 不表示 `live_write_commit` default allowed。
- #835 的 FR-0032 evidence ladder 可以被 downstream live owner 引用，但 #1174 不重跑、不更新、不补证据。
- 任何把 #835 closed state、FR-0032 spec text、historical GO、runtime ping、bootstrap ack、stub/fake host result 或 same-head historical artifact 当作当前 `live_write_commit` evidence 的 gate，必须 blocked / deny。

### 7. Fail-closed blocking reasons

本 taxonomy 至少冻结以下 blocking reasons：

- `unknown_capability_level`
- `capability_level_escalation_not_allowed`
- `owner_missing`
- `provider_requirement_missing`
- `operator_unlock_missing`
- `default_commit_lock_active`
- `account_safety_unknown`
- `runtime_target_binding_missing`
- `anti_detection_gate_missing`
- `live_evidence_missing`
- `stub_or_fake_host_evidence`
- `control_plane_only_signal`
- `historical_or_stale_evidence`
- `scope_mismatch`
- `downstream_owner_required`

约束：

- 任一 blocking reason 命中 requested level 的 required requirement 时，decision 必须为 `deny` 或 `defer`，不能为 `allow`。
- `live_write_commit` 命中任何 blocking reason 时必须 `gate_status=locked|blocked`。

## 异常与边界场景

### 1. Provider requirement pass 被误写成 commit allow

Given #1179 reports provider requirements satisfy `write_admit`
When a downstream gate requests `live_write_commit`
Then the taxonomy requires #1178 operator unlock and #1180 default lock release
And the provider requirement result alone cannot allow commit.

### 2. Operator unlock 缺失

Given requested capability level is `live_write_commit`
When no #1178 operator unlock record exists for the exact scope
Then gate status is `locked`
And decision is `deny`
And blocking reasons include `operator_unlock_missing`.

### 3. Default commit lock remains active

Given write admission and preparation prerequisites pass
When #1180 default commit lock remains active
Then effective capability level cannot exceed `write_prepare`
And `live_write_commit` remains unavailable.

### 4. #835 closed state is reused as live evidence

Given #835 is closed
When a PR or gate tries to use that closed state as current `live_write_commit` evidence
Then the taxonomy marks the evidence as historical baseline only
And decision remains `deny` or `defer` until current downstream gates provide accepted evidence.

### 5. Unknown capability term appears

Given a gate input uses `write_ready` or another non-frozen term
When the taxonomy evaluator consumes the input
Then it must fail closed with `unknown_capability_level`
And must not map the term to a neighboring level by guess.

### 6. Read-only route requests preparation side effect

Given requested capability level is `read_only`
When the route needs upload, draft mutation, submit, publish, delete or account-affine write state
Then the taxonomy must reject the route as scope mismatch
And require a downstream write owner before proceeding.

## 验收标准

1. `spec.md` freezes the four capability levels, gate vocabulary, downstream ownership and fail-closed rules.
2. `contracts/live-write-capability-taxonomy.md` provides machine-consumable enums and result shape.
3. `data-model.md` explains the taxonomy entities without introducing runtime persistence or SQLite schema.
4. `plan.md` includes required seven sections and keeps implementation/live actions out of scope.
5. `TODO.md` records review and downstream handoff checks without becoming project truth source.
6. `risks.md` covers commit unlock confusion, account safety, #835 baseline reuse and live evidence misclaims.
7. The PR only changes the FR-0062 suite and the #1174 sync-map entry, uses `Refs #1174`, and keeps `closingIssuesReferences=[]`.

## GWT 验收场景

### 场景 1：capability levels are frozen

Given a reviewer checks FR-0062
When they inspect the capability taxonomy
Then they can find exactly `read_only`, `write_admit`, `write_prepare` and `live_write_commit`
And each level has non-overlapping write visibility semantics.

### 场景 2：live_write_commit stays locked by default

Given `write_admit` and `write_prepare` prerequisites are present
When operator unlock or default commit lock release is missing
Then `live_write_commit` remains locked
And the result cannot be reported as publish-ready.

### 场景 3：downstream owners can consume stable vocabulary

Given #1178, #1179, #1180 or #1211 needs a capability term
When it consumes FR-0062
Then it can reuse the same capability level and blocking reason vocabulary
And it still owns its own evidence and gate result.

### 场景 4：no live evidence is claimed by this PR

Given FR-0062 is a formal spec PR
When reviewer checks PR metadata and suite text
Then live evidence is marked not applicable
And no browser/account/runtime/live action is claimed.
