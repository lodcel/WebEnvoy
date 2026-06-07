# FR-0033 TODO

## Review 阶段

- [ ] 确认 `browser_provider_contract` 字段与 closed enum 足以支撑后续 registry / doctor / selection 实现。
- [ ] 确认 provider identity、mode、browser engine、automation transport、capability declarations、verification level、limitations 与 fail-closed 规则无歧义。
- [ ] 确认本 FR 不包含 runtime/provider registry 实现、Syvert normalized mapping、CloakBrowser 私有 patch 细节或 WebEnvoy Agent brain 范围。
- [ ] 确认与 M1 `boundary.md`、`FR-0015`、`FR-0016`、`FR-0020` 的 ownership 不冲突。
- [ ] 确认 PR metadata 使用 `Fixes #1123` 与 local-only integration fields。

## 实现前待办

- [ ] 后续 provider registry / doctor / selection issue 引用本 FR，而不是在实现 PR 中重新发明 provider contract 字段。
- [ ] 后续 parser 测试覆盖 required fields、closed enum、unknown limitation、diagnostic-only、not-attachable 与 verification level 不足场景。
- [ ] 后续 provider-specific adapter 若需要私有 patch schema，必须在 provider-specific 边界中承接，不回写为 WebEnvoy core contract。
- [ ] 后续若改变跨仓 shared input/output、error semantics、diagnostics/observability、runtime mode 或 provider/shared-contract integration 口径，重新评估 integration gate。
