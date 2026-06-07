# FR-0038 TODO

## Review 阶段

- [ ] 确认 `provider_doctor_report` 字段与 closed enum 足以支撑后续 doctor command / registry / selection / capability verification 实现。
- [ ] 确认 binary、version、extension load、native messaging、display/headless mode、profile persistence 与 capability-specific readiness 的 required check mapping 无歧义。
- [ ] 确认 doctor pass 最高只到 `doctor_checked`，不替代 runtime attestation、live evidence、profile lock 或 FR-0015 readiness。
- [ ] 确认本 FR 不包含 runtime/provider registry 实现、doctor command、Syvert normalized mapping、CloakBrowser 私有 patch 细节或 WebEnvoy Agent brain 范围。
- [ ] 确认与 `FR-0033`、M1 `boundary.md`、`FR-0015`、`FR-0016`、`FR-0003` 的 ownership 不冲突。
- [ ] 确认 `#1127` 是 spec-only / contract-freeze FR，合入本 suite 后满足 `Close Semantics: fr-complete`。
- [ ] 确认 PR metadata 使用 `Fixes #1127` 与 provider/shared-contract integration fields，并锚定 `#1111`。

## 实现前待办

- [ ] 后续 provider doctor command 引用本 FR，而不是在实现 PR 中重新发明 doctor report 字段。
- [ ] 后续 parser 测试覆盖 required checks、closed enum、unknown status、fatal blocking、secret evidence 与 capability id mismatch。
- [ ] 后续 provider registry / selection 实现消费 `provider_blocked` 与 `blocked_capabilities`，并保持 fail-closed。
- [ ] 后续 capability verification 实现明确 doctor layer、runtime layer 与 live evidence layer 的 verification level 递进关系。
- [ ] 后续若继续改变 shared input/output、error semantics、diagnostics/observability、runtime mode 或 provider/shared-contract integration 口径，沿用或重新评估 integration gate。
