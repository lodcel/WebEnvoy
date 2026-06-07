# FR-0043 TODO

## Review 阶段

- [ ] 确认 `official-chrome.persistent` 只增补 persistent-specific descriptor delta。
- [ ] 确认本 suite 未重写 `FR-0042` common descriptor shape 或 direct variant。
- [ ] 确认 persistent profile reference、extension binding 与 native messaging readiness refs 已覆盖 #1138 scope。
- [ ] 确认 profile identity constraints 禁止 credentials、cookies、sensitive absolute paths 与 secret 内联。
- [ ] 确认本 suite 没有 capability matrix semantics、health result schema、launch evidence、redaction shape、fresh live evidence、fixtures 或 runtime implementation。
- [ ] 确认 `#1139/#1140/#1141/#1142/#1143/#1144` downstream owner 边界清楚。
- [ ] 确认 PR metadata 使用正确关闭语义，并声明 integration local-only、live evidence N/A。

## 实现前待办

- [ ] #1139 消费 persistent descriptor delta 与 FR-0035，冻结 official Chrome capability matrix。
- [ ] M3-C health issues 消费 FR-0038，验证 profile lock、extension runtime、service worker 与 native messaging readiness。
- [ ] #1143 消费 FR-0040 与 FR-0041，定义 launch evidence 引用、产物与 redaction。
- [ ] #1144 消费 descriptor、matrix、health 和 launch evidence，补 official Chrome fixtures。
- [ ] 后续 registry consumer 如登记 `official-chrome.persistent`，保持 FR-0036 registry alignment，不复制第二套 persistent shape。
