# FR-0042 TODO

## Review 阶段

- [ ] 确认 `official_chrome_descriptor` common shape 已覆盖 identity、mode、engine、transport、profile semantics、capability refs、limitation refs 与 evidence slots。
- [ ] 确认 `official-chrome.direct` 只定义 direct-launch-specific behavior and limitations。
- [ ] 确认本 suite 没有 persistent-specific extension/native-messaging/profile/service-worker delta。
- [ ] 确认本 suite 没有 capability matrix semantics、health result schema、launch evidence、fresh live evidence 或 fixtures。
- [ ] 确认 `#1138/#1139/#1140-#1144` downstream owner 边界清楚。
- [ ] 确认 PR metadata 使用 `Fixes #1137`，并声明 integration local-only、live evidence N/A。

## 实现前待办

- [ ] #1138 消费本 common shape，只补 persistent-specific delta。
- [ ] #1139 消费本 descriptor refs 与 FR-0035，冻结 official Chrome capability matrix。
- [ ] M3-C health issues 消费 FR-0038，不从本 descriptor 推导 health schema。
- [ ] #1143 消费 evidence slots，定义 launch evidence 引用与产物。
- [ ] #1144 消费 descriptor、matrix、health 和 launch evidence，补 official Chrome fixtures。
