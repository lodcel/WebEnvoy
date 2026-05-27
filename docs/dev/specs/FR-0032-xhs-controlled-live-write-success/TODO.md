# FR-0032 TODO

本文只记录 FR-0032 suite 和后续实现恢复入口；GitHub Issues / Project 仍是状态真相源。

## #842-A Spec Scaffold

- [x] 创建 `docs/dev/specs/FR-0032-xhs-controlled-live-write-success/`。
- [x] 起草 `spec.md`。
- [x] 起草 `plan.md`。
- [x] 起草 `TODO.md`。
- [x] 写清本 suite 不实现 runtime、不执行 upload / submit / publish、不触发 file picker / DataTransfer / editor text write / account write。

## #842-B GO Validity Snapshot

- [x] 固化 #779 final readmission `GO` snapshot。
- [x] 固化 latest-main head `3595cea448cb27ae5b4398dad494de98c12afd06`。
- [x] 固化 #834/#837/#838 consumed evidence。
- [x] 固化 profile/target/probe bundle scope。
- [x] 写清 GO 过期后的重跑要求。

## #843-A Evidence Contracts

- [x] 起草 `contracts/live-write-evidence.md`。
- [x] 起草 `contracts/published-result-identity.md`。
- [x] 起草 `contracts/cleanup-rollback-proof.md`。
- [x] 起草 `contracts/live-write-stop-signal.md`。

## #843-B Data Model

- [x] 起草 `data-model.md`。
- [x] 定义 `live_write_attempt`。
- [x] 定义 `upload_artifact_identity`。
- [x] 定义 `publish_result_identity`。
- [x] 定义 `cleanup_result`。
- [x] 定义 `risk_signal`。
- [x] 定义 `residual_record`。

## #843-C Risks / Research

- [x] 起草 `risks.md`。
- [x] 起草 `research.md`。
- [x] 覆盖 publish visibility scope。
- [x] 覆盖 cleanup failure policy。
- [x] 覆盖 adapter-consumable future boundary without Syvert/CloakBrowser extraction。

## Validation

- [x] `bash scripts/docs-guard.sh`
- [x] `bash scripts/spec-guard.sh`
- [x] `git diff --check`
- [x] 必要 markdown/link/static validation

## GitHub Closeout

- [x] #842 comment: checkpoint summary and validation evidence.
- [x] #843 comment: checkpoint summary and validation evidence.
- [x] #835 comment: FR-0032 suite evidence summary and #844 readiness.
- [x] Project status check for #842/#843/#844/#835.

## Remaining Blockers

- #844 owns spec review / guardian / merge-ready closeout for PR #848.
