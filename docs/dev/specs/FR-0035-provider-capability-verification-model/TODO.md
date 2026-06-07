# FR-0035 TODO

## 当前状态

- [x] 建立 Provider Capability Verification Model formal suite。
- [x] 冻结 support state、verification source、verification record、blocking reason 与 fail-closed 规则。
- [x] 明确本 FR 锚定 `FR-0033`，不实现 registry、doctor、selection、evidence kernel 或 runtime 行为。
- [x] 更新 `.github/spec-issue-sync-map.yml`，将 `#1124` 绑定到本 spec。

## 本 PR 收口前

- [ ] 运行 `bash scripts/docs-guard.sh`。
- [ ] 运行 `bash scripts/spec-guard.sh`。
- [ ] 运行 `bash scripts/check-pr-purity.sh docs/FR-0035-provider-capability-verification-model main`。
- [ ] 创建 formal spec review PR，并在 PR metadata 中使用 `Fixes #1124`。
- [ ] 完成 guardian / post-review，并等待 scheduler 后续合并调度。

## 后续事项，不由本 FR 承接

- `#1125` Provider Registry。
- `#1126` Launch Envelope Extraction。
- `#1127` Provider Health / Doctor Contract。
- `#1128` Provider Evidence Kernel。
- `#1130` Evidence Redaction Policy。
- 任何 runtime/provider implementation、Syvert adapter、CloakBrowser provider、external live/runtime 行为。
