# FR-0052 Risks

## 风险 1：把静态 matrix 误读为 runtime ready

- 触发：consumer 看到 `statically_verified` 后直接允许 `read/write/download`。
- 影响：绕过 `FR-0035` minimum support state、health、runtime attestation、limitation gate 或 live evidence gate。
- 缓解：spec 明确本 PR 最高只到 static support；业务 admission 要求更高 source 时必须 deny/defer 或 blocked/deny。
- 回滚：撤销错误 consumer 或 selection 行为，不修改 FR-0052 matrix 语义放宽。

## 风险 2：把 persistent refs 写成 health result schema

- 触发：matrix row 为 profile、extension 或 Native Messaging 填写 ready/pass payload。
- 影响：抢占 #1151/#1154 与 `FR-0038` owner，并可能误放行业务 capability。
- 缓解：matrix 只允许 evidence ref strategy，health refs 必须指向 downstream owner。
- 回滚：移除 health payload，保留 static descriptor ref 和 downstream owner。

## 风险 3：direct / cloakserve 被误标为 Native Messaging supported

- 触发：matrix 忽略 `FR-0049` direct `native_messaging_support=none` 或 `FR-0051` cloakserve `native_messaging_support=none`。
- 影响：后续 selection 可能选择不具备 WebEnvoy Native Messaging bridge 的 provider 执行 bridge capability。
- 缓解：direct 和 cloakserve `native-bridge.messaging` 固定为 `unsupported`。
- 回滚：恢复 unsupported row，并按 `FR-0035` 加 blocking reason。

## 风险 4：cloakserve experimental route 被默认放行

- 触发：matrix 把 cloakserve CDP support 解释为 read/write/download ready。
- 影响：绕过 #1152 limitation gate，对 unknown headless/profile/endpoint security 做业务 admission。
- 缓解：cloakserve business rows 当前最高 `declared`，必须保留 #1152 limitation gate 与 runtime/evidence refs。
- 回滚：恢复 declared + fail-closed rows，移除任何 allow 语义。

## 风险 5：future evidence slot 被当作 evidence passed

- 触发：`final_args_evidence_ref`、`fingerprint_seed_policy_ref`、`launch_evidence_ref` 或 `health_result_ref` 存在就被当成可用证据。
- 影响：跳过 #1155/#1156/#1153 或后续 evidence owner 的正式输出。
- 缓解：spec 和 data model 明确 slot existence is not evidence availability。
- 回滚：修正 consumer，把 future slot 改为 missing source 并 fail closed。

## 风险 6：scope 扩大到 runtime/live/browser

- 触发：为证明 matrix 正确而运行 live/browser/runtime 或修改 runtime code。
- 影响：违反 #1149 worker scope，并可能触发真实 Live Evidence 专项门禁。
- 缓解：本 PR 只做文档和 sync map 验证；不运行 guardian/formal review/controlled merge/issue closeout。
- 回滚：移除 runtime/live 输出，必要时报告 scheduler reclassify。
