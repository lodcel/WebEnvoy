# FR-0044 Risks

## 风险 1：把静态 matrix 误读为 runtime ready

- 触发：consumer 看到 `statically_verified` 后直接允许 `read/write/download`。
- 影响：绕过 `FR-0035` minimum support state、health、runtime attestation 或 live evidence gate。
- 缓解：spec 明确本 PR 最高只到 static support；业务 admission 要求更高 source 时必须 deny/defer 或 blocked/deny。
- 回滚：撤销错误 consumer 或 selection 行为，不修改 FR-0044 matrix 语义放宽。

## 风险 2：把 persistent refs 写成 health result schema

- 触发：matrix row 为 extension/native messaging 填写 ready/pass payload。
- 影响：抢占 #1140/#1141/#1142 与 `FR-0038` owner。
- 缓解：matrix 只允许 evidence ref strategy，health refs 必须指向 future owner。
- 回滚：移除 health payload，保留 static descriptor ref 和 downstream owner。

## 风险 3：direct provider 被误标为支持 extension/native messaging

- 触发：direct row 忽略 `FR-0042` 的 `extension_binding_support=none` 或 `native_messaging_support=none`。
- 影响：后续 selection 可能选择 direct provider 执行需要 persistent binding 的 capability。
- 缓解：direct `extension-runtime.bridge` 与 `native-bridge.messaging` 固定为 `unsupported`。
- 回滚：恢复 unsupported row，并按 `FR-0035` 加 blocking reason。

## 风险 4：future evidence slot 被当作 evidence passed

- 触发：`launch_evidence_ref`、`health_result_ref` 或 `fixture_ref` 存在就被当成可用证据。
- 影响：跳过 #1140-#1144 的正式输出。
- 缓解：spec 和 data model 明确 slot existence is not evidence availability。
- 回滚：修正 consumer，把 future slot 改为 missing source 并 fail closed。

## 风险 5：scope 扩大到 runtime/live/browser

- 触发：为证明 matrix 正确而运行 live/browser/runtime 或修改 runtime code。
- 影响：违反 #1139 worker scope，并可能触发真实 Live Evidence 专项门禁。
- 缓解：本 PR 只做文档和 sync map 验证；不运行 guardian/formal review/controlled merge。
- 回滚：移除 runtime/live 输出，必要时报告 scheduler reclassify。
