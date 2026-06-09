# FR-0051 TODO

## Review 阶段

- [ ] 确认 `cloakbrowser.cloakserve` descriptor 已覆盖 identity、external managed mode、engine、CDP transport、extension workflow、capability refs、limitation refs 与 evidence slots。
- [ ] 确认 default extension disabling 已冻结，且 WebEnvoy extension bridge / Native Messaging 默认 unsupported。
- [ ] 确认 extension workflow 只作为 experimental reference，不被写成 supported capability。
- [ ] 确认 provider contract refs 指向 FR-0033 / FR-0035 / #1149 / #1152，且本 suite 不定义 capability matrix 或 limitation gate result。
- [ ] 确认 limitation refs 已足够 #1149 和 #1152 fail-closed 消费。
- [ ] 确认本 suite 没有 runtime implementation、health result schema、launch evidence、fresh live evidence、fixtures、XHS、Syvert、official Chrome service worker 或 browser patching。
- [ ] 确认 PR metadata 使用 `Fixes #1148`，并声明 integration local-only、live evidence N/A。

## 实现前待办

- [ ] #1149 消费 #1146/#1147/#1148 descriptor refs 与 FR-0035，冻结 CloakBrowser capability matrix。
- [ ] #1152 消费 FR-0051 limitation refs，冻结 limitation gate 行为。
- [ ] CloakBrowser health owner 消费 FR-0038，不从 descriptor 推导 health schema。
- [ ] CloakBrowser launch evidence owner 消费 FR-0040 / FR-0041，不从 descriptor 推导 launch evidence 或 redaction shape。
- [ ] Fixture owner 等待 descriptor、matrix、limitation gate、health 和 launch evidence owner 提供输入。
