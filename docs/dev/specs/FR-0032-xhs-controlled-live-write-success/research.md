# FR-0032 Research

## Inputs Read

本 suite 消费了以下当前输入：

- #835 parent scope: full controlled upload / submit / publish success is required; upload-only is insufficient.
- #842: spec scaffold and GO validity snapshot requirements.
- #843: contracts / data-model / risks / research requirements.
- #844: spec review closeout input requirements.
- #779 final GO comment.
- #834 closeout comment.
- #837 validation row evidence.
- #838 final readmission rerun evidence.
- `vision.md`: WebEnvoy 是浏览器内执行工具，不是 Agent 大脑；当前重点是可集成执行内核与可复用能力。
- `docs/dev/AGENTS.md`: high-risk FR requires full suite and spec review before implementation.
- `docs/dev/roadmap.md`: Phase 1/2 write capability must remain gated by anti-detection and evidence.
- `docs/dev/architecture/system-design.md`: browser-in-process HTTP boundary and four-component model.
- FR-0031 suite: creator `live_write` admission owner, scope, validation binding and non-write readiness ladder.

## Current GO Baseline

Authoritative latest snapshot for FR-0032 entry discussion:

- latest main head: `3595cea448cb27ae5b4398dad494de98c12afd06`.
- #779 readmission decision: `GO`.
- final gate run_id: `issue838-runtime-start-creator-latest-main-20260527T071400Z`.
- runtime surface: `real_browser`, `headless=false`.
- target binding: verified creator tab `1230454030`.
- target: `creator.xiaohongshu.com` / `creator_publish_tab`.
- account safety: clear.
- validation scope: `profile/xhs_001`, `live_write`, `probe-bundle/xhs-creator-live-write-admission-v1`.
- validation rows: `FR-0012`, `FR-0013`, `FR-0014` all ready / verified / no_drift.

Boundary:

- no real upload, submit, publish, file picker, DataTransfer, editor text write, or account write action was executed.
- this GO admits the next FR-0032 flow; it is not full live write success.

## XHS Creator Write State Machine Assumption

FR-0032 uses the following minimal state machine until implementation proves a more precise shape:

1. `entry_gate_ready`: runtime/profile/target/account/validation ready.
2. `compose_ready`: creator publish page is ready and write gate is explicitly open.
3. `upload_started`: media/content selection or injection path begins.
4. `upload_staged`: platform/editor accepted the upload artifact.
5. `submit_ready`: editor state is valid for submit.
6. `submitted`: platform accepted submit action or moved to publish confirmation.
7. `publish_confirmed`: platform accepted publish.
8. `publish_identity_captured`: stable result identity captured.
9. `cleanup_started`: cleanup/rollback policy is executing.
10. `closed`: cleanup/residual/risk closeout complete.

Failure can occur at every state and must emit `live_write_stop_signal`.

## Upload Path Unknowns

Known from current scope:

- FR-0032 may need file picker, DataTransfer or equivalent upload path in later implementation.
- #842/#843/#844 must not execute or implement those paths.
- Upload success must be stronger than visible UI only; it needs artifact identity and platform/editor acceptance evidence.

Research conclusion:

- The spec should not choose one upload mechanism yet.
- The contract should require evidence independent of the chosen mechanism.
- Implementation issue #845 should select the actual upload path after spec review.

## Submit / Publish Path Unknowns

Known from product scope:

- Full success requires submit and publish, not upload-only evidence.
- The platform may expose publish success through response, creator result page, current page state or follow-up page verification.

Research conclusion:

- FR-0032 requires a publish result identity contract instead of a single selector or response shape.
- A generic success toast is insufficient unless paired with a stable identity.
- #846 should own state machine and evaluator implementation.

## Publish Visibility Scope

FR-0032 must record one of:

- `private_or_self_visible`
- `limited_test_visibility`
- `public_visible`
- `unknown`

Decision:

- `unknown` is valid only for failure/incomplete reporting.
- Any planned live publish must select a non-unknown scope before upload starts.
- Public visibility requires explicit implementation issue acceptance and cleanup/residual plan.

## Cleanup / Rollback Feasibility

Potential cleanup outcomes:

- delete published result
- hide published result
- remove draft
- abandon unpublished upload
- no safe cleanup action

Research conclusion:

- FR-0032 cannot assume rollback is always supported.
- Cleanup failure must be a first-class closeout outcome.
- If cleanup is unavailable or unsafe, residual content must be tracked with visibility, locator and follow-up owner.

## Failure Policy

Fail closed before or during live write when:

- spec review has not passed.
- #779-equivalent GO is stale.
- runtime/identity/target/account/validation proof is missing.
- publish visibility scope is unknown before planned live publish.
- account safety, captcha, login, security redirect or browser abnormal signal appears.
- upload artifact identity is missing.
- publish result identity is missing after claimed success.
- cleanup cannot run and residual record is missing.

## Option Tradeoffs

### Option A: Treat #779 GO as live success

Rejected. #779 explicitly performed non-write readmission only and did not execute upload, submit or publish.

### Option B: Close #835 after upload-only evidence

Rejected. Parent scope requires full upload / submit / publish success plus cleanup and risk evidence.

### Option C: Define structured contracts before implementation

Accepted. FR-0032 is high risk and account-touching; contracts/data model/risks/research are required before implementation.

### Option D: Add adapter/provider extraction to FR-0032

Rejected. Evidence should be adapter-consumable later, but adapter/provider extraction belongs to separate scoped work.

## Handoff to Implementation

#845 should consume:

- `live_write_attempt`
- `upload_artifact_identity`
- entry gate
- upload-related stop signal

#846 should consume:

- submit evidence
- publish result identity
- cleanup/rollback proof
- risk signal
- route evidence evaluator

#847 should consume:

- latest-main fresh GO rerun
- implemented evaluator
- controlled live upload / submit / publish run
- cleanup/residual closeout evidence
