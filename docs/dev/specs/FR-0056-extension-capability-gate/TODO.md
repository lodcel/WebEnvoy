# FR-0056 TODO

## Review 阶段

- [ ] 确认 `FR-0056` 只定义 Extension Capability Gate。
- [ ] 确认 gate 消费 `FR-0052` capability matrix，没有重写 matrix rows。
- [ ] 确认 gate 消费 `FR-0054` persistent profile / extension health，且 health pass 不等于 runtime-ready。
- [ ] 确认 gate 消费 `FR-0055` cloakserve limitation gate，cloakserve extension / relay / Native Messaging 默认 blocked / deny。
- [ ] 确认 gate 消费 `FR-0057` Native Messaging bridge doctor，且 doctor owner 是 WebEnvoy bridge owner。
- [ ] 确认 direct variant extension / Native Messaging requests fail closed unless later formal owner changes applicability.
- [ ] 确认 runtime ping、bootstrap ack、descriptor existence、stub/fake host success、historical artifact 或 same-head historical artifact 不能满足本 gate。
- [ ] 确认本 suite 没有 runtime/source code、provider adapter behavior、browser/live actions、fixtures、scripts、workflows、#1145 closeout 或 issue closeout。
- [ ] 确认 PR metadata 使用 `Refs #1153` / refs-only，并声明 formal spec/work-item PR、local_only integration、live evidence N/A、gate owner scheduler。

## 实现前待办

- [ ] Future gate parser implements `extension_capability_gate_input` and `extension_capability_gate_result`.
- [ ] Future provider selection owner wires FR-0056 before admitting workflows requiring extension bridge.
- [ ] Future runtime owner supplies accepted runtime attestation / target tab / observation refs before any runtime/page workflow allow.
- [ ] Future live evidence owner supplies accepted latest-head refs only when a workflow explicitly requires live evidence.
- [ ] Future cloakserve experimental owner consumes both FR-0055 and FR-0056 before any extension / relay / Native Messaging evaluation.
