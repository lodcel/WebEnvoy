# FR-0036 TODO

## Review 阶段

- [ ] 确认 `browser_provider_registry` 与 `browser_provider_registry_entry` 字段足以支撑后续 provider doctor / selection / driver integration。
- [ ] 确认 registry entry 必须引用并携带 `FR-0033.browser_provider_contract` snapshot，不重写 provider contract 字段。
- [ ] 确认 official Chrome、CloakBrowser managed provider 与 future remote browser provider 的登记边界无歧义。
- [ ] 确认 `registry_status`、`default_eligibility`、locator、constraints 与 fail-closed 规则不会被误读为 runtime ready。
- [ ] 确认本 suite 不包含 runtime/provider selection/doctor/driver implementation、Syvert normalized mapping、CloakBrowser-as-core 或外部 live 行为。
- [ ] 确认 PR metadata 使用 `Fixes #1125` 与 provider/shared-contract integration fields，并锚定 `#1111`。

## 实现前待办

- [ ] 后续 provider registry parser issue 引用本 suite，而不是在实现 PR 中重新发明 registry 字段。
- [ ] 后续 provider selection issue 覆盖 `declared`、`blocked`、`diagnostic_only`、`experimental_only`、`requires_opt_in=true` 与 verification level 不足场景。
- [ ] 后续 driver integration issue 从 registry lookup provider，不按 provider family/name 写硬编码分支。
- [ ] 后续 CloakBrowser 或 remote provider adapter 若需要私有 schema、认证或 broker 协议，必须在 provider-specific 边界中承接，不回写为 WebEnvoy core registry。
