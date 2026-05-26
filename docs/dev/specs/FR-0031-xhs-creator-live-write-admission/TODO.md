# FR-0031 TODO

> GitHub Issue / PR / Project 是进度真相源。
> 本文件只保留 FR-0031 的规约准入、实现入口和 closeout 边界。

## Spec Review

- [ ] `spec.md` 冻结 creator write admission owner、scope、validation binding 与 readiness ladder
- [ ] `plan.md` 补齐实施目标、分阶段拆分、实现约束、测试与验证策略、TDD 范围、并行 / 串行关系、进入实现前条件
- [ ] `contracts/xhs-creator-live-write-admission.md` 冻结 machine-checkable contract
- [ ] `data-model.md` 冻结 creator scope、target binding、validation binding、admission decision 字段
- [ ] `risks.md` 覆盖账号、写入、target mismatch、Service Worker freshness、baseline 误复用风险
- [ ] spec review 通过后再进入实现

## Implementation Entry

- [ ] `runtime.closeout_gate` creator write scope fail closed tests
- [ ] read closeout baseline 不满足 creator write validation 的 contract tests
- [ ] creator write validation ready 后 gate ready tests
- [ ] identity stale / target missing / account blocked blocker precedence tests
- [ ] #779 fresh rerun 消费 #819 和 #820 结论

## Closeout Boundary

- [ ] 不执行真实上传、提交、发布或不可逆写入
- [ ] 不恢复 Syvert integration 默认门禁
- [ ] #819 closeout 必须回写 #779
- [ ] #779 closeout 前必须重新执行 `runtime.status`、`runtime.audit`、`runtime.closeout_gate`
