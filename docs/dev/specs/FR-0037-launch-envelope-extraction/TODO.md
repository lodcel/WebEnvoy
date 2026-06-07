# FR-0037 TODO

## Review 阶段

- [ ] 确认 `launch_envelope` 字段与 closed enum 足以支撑后续 launch admission / evidence kernel / doctor 消费。
- [ ] 确认 provider reference 只消费 `FR-0033.browser_provider_contract`，不重定义 provider capability declarations。
- [ ] 确认 profile binding、browser mode、network/regional settings、runtime bindings、fingerprint policy 与 evidence requirements 的 fail-closed 规则无歧义。
- [ ] 确认 launch admission health matrix 覆盖 profile lock、login state、extension identity、Native Messaging、runtime bootstrap、proxy/fingerprint 与 evidence requirements。
- [ ] 确认恢复路径不会授权删除 lock、切换 host、污染 extension paths、复用旧 artifact 或静默生成新输入。
- [ ] 确认最小验证矩阵覆盖 happy path、blocked path 与 recoverable path。
- [ ] 确认 secret redaction 边界足够明确：proxy、seed、profile、extension paths、Native Host manifest 均只使用 locator / artifact ref。
- [ ] 确认本 FR 不包含 provider registry、provider doctor、provider evidence kernel、CLI 或 browser launch implementation。
- [ ] 确认与 `FR-0033`、`FR-0015`、`FR-0016`、`FR-0020`、`FR-0034` 的 ownership 不冲突。
- [ ] 确认 `#1126` 是 spec-only / contract-freeze FR，合入本 suite 后满足 `Close Semantics: fr-complete`。
- [ ] 确认 PR metadata 使用 `Fixes #1126` 与 provider/shared-contract integration fields，并锚定 `#1111`。

## 实现前待办

- [ ] 后续 provider registry / doctor / evidence kernel / launch admission issue 引用本 FR，而不是在实现 PR 中重新发明 launch fields。
- [ ] 后续 parser 测试覆盖 required fields、closed enum、provider ref mismatch、profile lock unavailable、headless conflict、unknown limitation 与 evidence requirement unmet。
- [ ] 后续 admission tests 覆盖 disconnected / recoverable / blocked health states，确保不会被误判为 healthy。
- [ ] 后续 evidence kernel 产出 launch evidence artifact 时，必须区分 requirements 与 collected evidence。
- [ ] 后续 provider-specific adapter 若需要私有 patch schema，必须在 provider-specific 边界中承接，不回写为 Launch Envelope。
- [ ] 后续若继续改变 shared input/output、runtime mode、provider/shared-contract integration 口径或 evidence requirements，沿用或重新评估 integration gate。
