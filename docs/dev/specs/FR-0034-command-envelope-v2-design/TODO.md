# FR-0034 TODO

## Spec PR

- [x] 建立 #1131 formal suite scaffold。
- [x] 冻结 Command Envelope v2 顶层字段。
- [x] 冻结 v1 `status` / `summary` / `observability` / `error.diagnosis` 到 v2 的兼容映射。
- [x] 冻结 `contracts/command-envelope-v2.md`。
- [x] 补齐 `data-model.md`、`research.md`、`risks.md`。
- [x] 通过本地 docs/spec 静态检查。
- [ ] 创建 / 更新 PR，补齐 metadata。
- [x] 处理 guardian/spec review 阻断：补齐 v1 timestamp compatibility 对 `operational.timestamps.completed_at` 的必填约束。
- [x] 处理 guardian/spec review 阻断：补齐 `DiagnosisIndexV2` 类型定义、空值语义和最小示例。
- [ ] 完成 guardian / review / GitHub checks。

## 后续实现事项

- [ ] #1133：实现或冻结 `summary` / `data` 兼容迁移。
- [ ] #1134：实现或冻结 `operational` / `observability` / `diagnosis` 兼容迁移。
- [ ] #1135：实现或冻结 `evidence` / `warnings` / `errors` 输出治理。
- [ ] #1136：完成 compatibility gate、consumer migration tests 和 closeout。
