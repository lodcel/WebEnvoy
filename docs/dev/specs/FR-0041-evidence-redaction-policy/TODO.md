# FR-0041 TODO

## 当前 PR

- [x] 冻结 Evidence Redaction Policy formal spec。
- [x] 补齐 contract、data model、plan、research、risks。
- [x] 明确不修改 FR-0040 provider evidence record shape。
- [x] 明确 #1143 可消费本 policy 但不得重定义 redaction semantics。
- [x] 更新 `.github/spec-issue-sync-map.yml` 映射 #1129。
- [x] 运行本地 docs/spec/map/purity/diff 验证。
- [ ] 打开 PR 并填写 parser-friendly metadata。
- [ ] 等待 hosted checks。
- [ ] 回报 scheduler gate evidence。

## 后续实现事项

- [ ] #1143 official Chrome launch evidence 消费本 policy。
- [ ] 后续 redaction implementation 覆盖 sensitivity classification tests。
- [ ] 后续 redaction implementation 覆盖 locator validation tests。
- [ ] 后续 fixture implementation 覆盖 synthetic / redacted value enforcement tests。

## 禁止在本 PR 承载

- [ ] 不推进 #1143/#1144。
- [ ] 不实现 redaction engine、collector、artifact writer 或 CLI formatter。
- [ ] 不运行或申报 runtime/live/account evidence。
- [ ] 不修改 FR-0040 suite 或 provider evidence record shape。
