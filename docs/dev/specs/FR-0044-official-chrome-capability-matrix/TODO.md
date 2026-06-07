# FR-0044 TODO

## Review 阶段

- [ ] 确认 `FR-0044` 只定义 official Chrome capability matrix。
- [ ] 确认 direct / persistent 每个 capability row 均包含 support level、limitation、verification source 与 evidence ref strategy。
- [ ] 确认 matrix 消费 `FR-0042`、`FR-0043` 与 `FR-0035`，没有重写 descriptor shape。
- [ ] 确认本 suite 没有 health result schema、launch evidence record、fixture payload、runtime implementation 或 live evidence。
- [ ] 确认 direct extension/native messaging rows 为 unsupported。
- [ ] 确认 persistent profile/extension/native messaging refs 不被写成 health pass 或 runtime ready。
- [ ] 确认 PR metadata 使用 `Refs #1139` / `refs_only`，并声明 formal spec review PR、integration-gated execution_provider surface、live evidence N/A、gate owner scheduler。

## 实现前待办

- [ ] #1140 消费本 matrix 和 `FR-0038`，验证 persistent extension identity / runtime health。
- [ ] #1141 消费本 matrix 和 `FR-0038`，验证 MV3 service worker freshness。
- [ ] #1142 消费本 matrix 和 `FR-0038`，验证 native messaging readiness。
- [ ] #1143 消费本 matrix、`FR-0040` 与 `FR-0041`，定义 launch evidence 引用与产物。
- [ ] #1144 消费 descriptor、matrix、health 和 launch evidence，补 official Chrome fixtures。
