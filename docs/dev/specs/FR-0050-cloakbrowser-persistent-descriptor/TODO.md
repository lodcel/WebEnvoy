# FR-0050 TODO

## Review 阶段

- [ ] 确认 `cloakbrowser.persistent` provider identity、mode、engine 与 transport descriptor 已冻结。
- [ ] 确认 persistent profile reference、profile identity constraints 与 cleanup expectation 已覆盖 #1147 scope。
- [ ] 确认 extension workflow refs 已覆盖 extension identity、installation、runtime、native bridge、workflow capability refs 与 artifact passthrough refs。
- [ ] 确认 health requirement inputs 只指向 FR-0038 / downstream health owner，没有定义 health result schema。
- [ ] 确认本 suite 没有 capability matrix semantics、launch evidence、fixture payload、runtime implementation、fresh live evidence、XHS 或 Syvert scope。
- [ ] 确认与 #1146 direct descriptor 的差异边界清楚，未定义 direct launch args / final args evidence。
- [ ] 确认没有 CloakBrowser private patch schema、driver state、license secret、account credential、cookie、token、raw sensitive path 或 broker credential。
- [ ] 确认 PR metadata 使用 `Refs #1147`，不自动关闭 #1147，并声明 integration local-only、live evidence N/A。

## 实现前待办

- [ ] #1149 消费 FR-0050 与 FR-0035，冻结 CloakBrowser capability matrix。
- [ ] 后续 health issues 消费 FR-0038 与 FR-0050 health requirement inputs，定义 required doctor checks。
- [ ] 后续 fixture issue 在 descriptor、matrix 与 health owner 稳定后补 fixture。
- [ ] 后续 runtime implementation 不得从 descriptor existence 推导 health pass、runtime ready 或 live evidence ready。
- [ ] 后续 registry consumer 如登记 `cloakbrowser.persistent`，保持 FR-0036 registry alignment，不复制第二套 persistent shape。
