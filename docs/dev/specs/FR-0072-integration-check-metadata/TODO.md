# FR-0072 TODO

- [ ] 冻结 `spec.md` 中 required field set、enum、local-only default、integration-gated triggers、relationship matrix 和 lifecycle obligations。
- [ ] 冻结 `contracts/integration-check-metadata.md` logical contract，明确不是 runtime / CLI / JSON-RPC / Syvert normalized result / provider adapter schema。
- [ ] 冻结 `data-model.md` logical entities，明确不新增 SQLite / runtime / integration project storage。
- [ ] 记录 `research.md` 输入事实：#1205、boundary freeze、FR-0071、PR template、docs/dev/AGENTS、guardian addendum、merge-gate parser tests。
- [ ] 记录 `risks.md`：local-only 误升级、shared contract 漏报、contract_surface 误分类、metadata readback drift、scope drift。
- [ ] 更新 `.github/spec-issue-sync-map.yml`，将 `FR-0072 -> #1205` 建立单条映射。
- [ ] 执行 same-class metadata audit，确认现有 PR template / docs / guardian addendum / parser tests 与本 contract 无直接冲突；若有冲突，最小同步或回报 scheduler blocker。
- [ ] 本地验证通过：`docs-guard`、`spec-guard`、`spec-issue-sync-map validate/assert-mapped`、`check-pr-purity`、`git diff --check`。
- [ ] 确认 PR metadata 使用 `Refs #1205`，不提前关闭 #1205。
- [ ] 确认 this PR does not implement Syvert normalized result, provider adapter, joint acceptance implementation, runtime/live evidence, browser/account/write actions, M14+ scheduling, guardian/formal review/controlled merge/issue closeout。
- [ ] 等待 scheduler-owned spec review / gate。
