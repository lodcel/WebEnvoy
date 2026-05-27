# FR-0032 XHS Controlled Live Write Success

Canonical Issue: #835

## 背景

#779 已在 latest main `3595cea448cb27ae5b4398dad494de98c12afd06` 给出 creator `live_write` readmission `GO`。该 GO 只证明 XHS creator write admission baseline 已恢复：runtime ready、real browser、creator target binding verified、account safety clear，以及 `FR-0012/FR-0013/FR-0014` creator bundle validation rows 均为 ready / verified / no_drift。

#779 / #834 / #837 / #838 均未执行真实 upload、submit、publish、file picker、DataTransfer、editor text write 或账号写入动作。因此 FR-0032 的职责不是复述 readmission，而是在 spec review 之后定义和实现完整受控 live write success：upload -> submit -> publish -> evidence -> cleanup/rollback -> residual/risk closeout。

## 目标

1. 冻结 XHS creator 受控 live write success 的正式 owner、scope、执行阶梯和 success bar。
2. 冻结 upload artifact、published result、cleanup/rollback、risk signal、stop signal 的 evidence contract。
3. 冻结首批实现必须记录的 live write 数据模型和生命周期。
4. 明确 GO baseline 的有效性、过期重跑要求和不能替代 live write success 的边界。
5. 为 #844 spec review、#845 upload path、#846 submit/publish/evaluator 与 #847 latest-main controlled live closeout 提供正式输入。

## 非目标

- 本规约 PR 不实现 runtime 能力。
- 本规约 PR 不执行真实 upload、submit、publish、file picker、DataTransfer、editor text write 或账号写入动作。
- 不把 #779 GO、dry-run、recon、non-write readiness、upload-only success、DOM/state extraction 或 spec draft 等同于 full live write success。
- 不绕过 account safety、anti-detection baseline、runtime gate、publish visibility scope、cleanup failure policy 或 spec review。
- 不抽取 WebEnvoy / Syvert adapter，不引入 CloakBrowser provider，不改变 adapter / provider 边界。

## GO Validity Snapshot

FR-0032 当前消费的 readmission baseline 固定为：

- #779 final readmission comment: #779 `GO` on 2026-05-27.
- latest-main head: `3595cea448cb27ae5b4398dad494de98c12afd06`.
- #834 closed / Project Done.
- #837 closed / Project Done; creator validation rows generated.
- #838 closed / Project Done; final readmission rerun returned `GO`.
- profile: `profile/xhs_001`.
- target: `creator.xiaohongshu.com` / `creator_publish_tab`.
- target tab from final rerun: `1230454030`.
- requested execution mode: `live_write`.
- probe bundle: `probe-bundle/xhs-creator-live-write-admission-v1`.
- runtime/start and final closeout run_id: `issue838-runtime-start-creator-latest-main-20260527T071400Z`.
- execution surface: `real_browser`; `headless=false`.
- account safety: `clear`.
- validation rows: `FR-0012/FR-0013/FR-0014` all `baseline_status=ready`, `current_result_state=verified`, `current_drift_state=no_drift`.

The snapshot is an entry baseline only. It authorizes #844 to review FR-0032 inputs and later implementation issues to start after review; it does not authorize immediate live write execution.

If #847 or any live write execution starts after this snapshot is stale, the implementation must rerun:

- `runtime.status`
- `runtime.audit`
- `runtime.closeout_gate`
- `xhs.creator_publish.admit` dry-run
- `anti_detection_validation_view` query for the creator bundle rows

## Functional Requirements

### 1. Formal Owner

FR-0032 owns only controlled XHS creator live write success. It does not own creator write admission baseline; that remains `FR-0031 / #819`.

Constraints:

- #842 / #843 own the spec-suite draft and required contracts/data model/risk/research slices.
- #844 owns spec review / guardian / merge-ready closeout for the suite.
- #845 owns controlled upload path non-publish validation.
- #846 owns submit / publish gate, state machine and evidence evaluator.
- #847 owns latest-main controlled live upload / submit / publish closeout.

### 2. Controlled Live Write Scope

The controlled live write scope is:

- `platform=xhs`
- `target_domain=creator.xiaohongshu.com`
- `target_page=creator_publish_tab`
- `browser_channel=Google Chrome stable`
- `execution_surface=real_browser`
- `requested_execution_mode=live_write`
- `profile_ref` from the canonical `FR-0003 / FR-0020` namespace
- `probe_bundle_ref=probe-bundle/xhs-creator-live-write-admission-v1`

Constraints:

- `www.xiaohongshu.com`, `live_read_high_risk`, stub, fake host, control-plane-only signal, old head or old artifact cannot satisfy this scope.
- Specific local profile names may appear in evidence snapshots, but formal contracts must use `profile_ref`.

### 3. Entry Gate

Before any live write action, the system must prove:

- FR-0032 spec review passed.
- implementation issue scope is approved and mapped to #845/#846/#847.
- latest head has fresh #779-equivalent creator `live_write` readmission `GO`.
- runtime is official Chrome real browser and headless is false.
- profile identity binding is bound and Service Worker freshness is not blocking.
- creator target binding is verified.
- account safety is clear.
- creator validation rows for `FR-0012/FR-0013/FR-0014` are ready / verified / no_drift.
- publish visibility scope and cleanup failure policy are selected and recorded before write execution.

Any missing entry proof returns `NO_GO` and must not be probed through live upload.

### 4. Execution Ladder

FR-0032 implementation must follow this ladder:

1. static tests and docs/spec guards
2. `runtime.status`
3. `runtime.audit`
4. `runtime.closeout_gate`
5. `xhs.creator_publish.admit` dry-run
6. recon / page-state and target confirmation
7. single-route limited live upload path
8. route evidence evaluator
9. controlled upload
10. controlled submit
11. controlled publish
12. published result identity capture
13. cleanup / rollback
14. residual record and risk closeout

Each step stops on first failure. A failed step must write a structured stop signal and must not continue to later write actions.

### 5. Upload Success

Upload success requires `upload_artifact_identity` evidence, not only visible UI state.

Minimum proof:

- upload attempt is bound to current `live_write_attempt_id`, `run_id`, `profile_ref`, `target_tab_id`, target page and artifact identity.
- source media identity is recorded without leaking sensitive local paths beyond the minimum auditable reference.
- platform accepted or staged the upload artifact.
- page state confirms the artifact is visible or ready for submit.
- no account safety, captcha, security redirect or browser abnormal signal appeared.

Upload-only success cannot close FR-0032.

### 6. Submit Success

Submit success requires proof that the creator workflow moved from editable draft/staged state into platform submission/publishing flow.

Minimum proof:

- submit action was deliberately allowed by the write gate.
- submit locator and action are recorded.
- submit result state is captured.
- any platform validation error, content policy interruption, account safety signal, captcha, rate limit or environment abnormal signal is recorded as stop/failure.

Submit success without publish result identity cannot close FR-0032.

### 7. Publish Success

Publish success requires `publish_result_identity`.

Minimum proof:

- platform returned or rendered a stable result identity such as note id, published URL, creator result page URL or equivalent current-platform identity.
- publish visibility scope is recorded.
- result identity is bound to current `run_id`, `profile_ref`, `target_tab_id`, source upload artifact and submit action.
- page/platform success signal is not only a generic toast unless it is paired with result identity or a follow-up current-page verification.

If the platform shows success but no stable identity can be captured, the run is `published_identity_missing`, not full success.

### 8. Cleanup / Rollback

After publish success or after any partial write, the system must attempt the configured cleanup/rollback path unless the stop policy says cleanup would increase account risk.

Allowed cleanup outcomes:

- `deleted`
- `hidden`
- `draft_removed`
- `rollback_not_supported`
- `cleanup_blocked`
- `cleanup_failed`

If content cannot be deleted, hidden or rolled back, the system must create `residual_record` with the published identity, visibility scope, reason and required manual follow-up.

### 9. Risk Signal and Stop Policy

The system must collect risk signals throughout live write:

- account safety
- captcha / verification
- login required
- security redirect
- browser environment abnormal
- rate limit
- content policy / platform moderation
- upload failure
- submit failure
- publish identity missing
- cleanup failure

Any high-risk signal hard-stops later write actions. The stop signal must include the failed step, blocker layer, failure reason, cleanup status and whether residual content may remain.

### 10. Evidence Contract

FR-0032 evidence must be structured and adapter-consumable later, but this FR does not extract Syvert Adapter or introduce CloakBrowser provider.

Required contracts:

- `contracts/live-write-evidence.md`
- `contracts/published-result-identity.md`
- `contracts/cleanup-rollback-proof.md`
- `contracts/live-write-stop-signal.md`

Free-text issue comments may summarize closeout, but they cannot replace these evidence objects.

## 异常与边界场景

### 1. #779 GO 过期

Given FR-0032 implementation starts after the stored GO snapshot is stale
When the system prepares for controlled live write
Then it must rerun `runtime.status`、`runtime.audit`、`runtime.closeout_gate`、`xhs.creator_publish.admit` dry-run and validation row query
And any missing proof must stop before upload.

### 2. Upload succeeds but submit is blocked

Given an upload artifact is accepted by the page
When submit is blocked by account safety, captcha, policy or platform validation
Then the attempt is not full live write success
And cleanup / rollback or residual recording must run according to policy.

### 3. Publish success signal lacks identity

Given the platform shows a publish success toast
But no note id, result URL or equivalent identity can be captured
When closeout evaluates success
Then the result is `published_identity_missing`
And FR-0032 cannot be closed as success.

### 4. Cleanup fails after publish

Given publish result identity exists
When cleanup/delete/hide/rollback fails or is unsupported
Then the system must record `residual_record`
And the closeout must disclose remaining externally visible content and required follow-up.

### 5. Risk signal appears after upload

Given upload has staged media
When account safety, captcha, security redirect or browser abnormal signal appears before submit or publish
Then the system must stop later write actions
And record a stop signal plus cleanup/rollback status.

### 6. Spec draft is mistaken for live success

Given this FR suite is drafted and passes docs/spec guard
When #835 is evaluated
Then the status remains not live write success
And #844 may enter spec review, while #845/#846/#847 remain gated by review and implementation work.

## 验收标准

1. `spec.md` freezes FR-0032 owner, scope, GO snapshot, entry gate, execution ladder and success bar.
2. `plan.md` includes the required seven sections and separates spec review from implementation and live closeout.
3. `TODO.md` records #842/#843/#844/#845/#846/#847 sequencing without becoming project truth source.
4. All four required contracts exist and define machine-readable evidence shapes.
5. `data-model.md` defines `live_write_attempt`, `upload_artifact_identity`, `publish_result_identity`, `cleanup_result`, `risk_signal` and `residual_record`.
6. `risks.md` covers account safety, true write, public publish, irreversible action, cleanup failure, residual record and stop policy.
7. `research.md` records current XHS creator upload / submit / publish state-machine assumptions, publish visibility scope, cleanup/rollback feasibility and failure policy.
8. The suite does not implement runtime ability or execute upload / submit / publish / file picker / DataTransfer / editor write / account write.
9. #844 can use this suite as spec review input after local docs/spec/static validation passes.

## GWT 验收场景

### 场景 1：GO snapshot only admits spec/implementation flow

Given #779 final readmission decision is `GO`
When FR-0032 spec suite consumes the snapshot
Then the suite may enter #844 spec review
And no upload, submit or publish action is authorized by the snapshot alone.

### 场景 2：Controlled live write success

Given spec review passed
And latest-head creator write admission is `GO`
And account safety is clear
And publish visibility and cleanup policy are recorded
When controlled upload, submit and publish all complete
Then evidence includes upload artifact identity, publish result identity, cleanup/rollback proof, risk signals and stop policy status
And closeout can evaluate full live write success.

### 场景 3：Upload-only result is insufficient

Given upload artifact identity is captured
But submit or publish did not complete
When closeout evaluates #835
Then the result is not full live write success
And the attempt must record cleanup/rollback or residual status.

### 场景 4：Cleanup failure creates residual record

Given publish result identity was captured
And cleanup failed or rollback is unsupported
When the attempt closes
Then `cleanup_result` records the failure
And `residual_record` records the externally visible remaining content and follow-up owner.

### 场景 5：High-risk signal stops the ladder

Given any later write step is pending
When account safety, captcha, security redirect or browser abnormal signal appears
Then the system emits `live_write_stop_signal`
And no later write action is executed.
