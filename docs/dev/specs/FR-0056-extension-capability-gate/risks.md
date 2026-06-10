# FR-0056 Risks

## 风险 1：把 gate 写成 extension bridge ready

- 触发：gate output 或 PR metadata 声称 extension bridge ready / runtime-ready。
- 影响：绕过 downstream runtime attestation、target tab binding 和 live evidence owner。
- 缓解：FR-0056 只定义 admission disposition；health / doctor pass 不等于 runtime proof。
- 回滚：移除 ready claim，恢复 blocked / defer to runtime owner。

## 风险 2：persistent health 被误用为 business allow

- 触发：`FR-0054` profile / extension health pass 后直接允许 read/write/download。
- 影响：绕过 `FR-0035` minimum support state 与 runtime observation requirement。
- 缓解：business workflow 仍要求 runtime attestation、target tab binding、runtime observation 或 live refs。
- 回滚：将 health pass 降回 prerequisite，补 `runtime_attestation_required` / `runtime_observation_required` blocker。

## 风险 3：Native Messaging doctor 被误用为 runtime proof

- 触发：`FR-0057` doctor-layer ready 被写成 Native Messaging runtime ready 或 command success。
- 影响：绕过 extension/native host runtime owner 与 target page evidence。
- 缓解：doctor pass 最高满足 doctor-layer requirement；runtime/page workflow 仍需 downstream refs。
- 回滚：移除 runtime proof 语义，恢复 `native_bridge_doctor_not_ready` 或 `runtime_attestation_required`。

## 风险 4：cloakserve limitation gate 被绕过

- 触发：直接使用 cloakserve CDP endpoint、runtime ping、bootstrap ack 或 final args evidence 放行 extension/relay workflow。
- 影响：绕过 `FR-0055` default blocked / deny 语义。
- 缓解：cloakserve extension / relay / Native Messaging workflow 必须消费 `FR-0055`，scoped experimental issue 只允许 evaluation。
- 回滚：恢复 `cloakserve_extension_bridge_blocked` 或 `cloakserve_native_messaging_blocked`。

## 风险 5：direct locator 被误读为 stable extension binding

- 触发：direct descriptor extension path / locator 被写成 stable extension identity or extension runtime surface。
- 影响：误放行 direct extension bridge 或 Native Messaging workflow。
- 缓解：direct extension bridge默认 blocked；Native Messaging unsupported。
- 回滚：恢复 direct fail-closed disposition，要求 future formal owner 先冻结 identity/runtime refs。

## 风险 6：scope 扩大到 runtime/live/browser

- 触发：为证明 gate 正确而运行 browser/live/runtime，或修改 source code/scripts/workflows。
- 影响：违反 worker scope，触发真实 Live Evidence 专项门禁或高风险 implementation review。
- 缓解：本 PR 只做 formal suite 和 sync map；不运行 guardian/formal review/controlled merge/issue closeout。
- 回滚：移除 runtime/live 输出，必要时报告 scheduler reclassify。
