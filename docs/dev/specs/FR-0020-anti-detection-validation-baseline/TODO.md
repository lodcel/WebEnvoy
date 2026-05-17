# FR-0020 TODO

> GitHub Issue / PR / Project 是进度真相源。
> 本文件只保留 FR-0020 的 historical closeout、后续消费边界和恢复入口；不再维护 active checklist。

## Historical Closeout

- `#239` 已作为 FR-0020 canonical FR 容器关闭，不再是 open 横切主线 issue。
- `#239` 当前职责已收口为“反风控验证与基线评估”的 formal owner，为 `FR-0012/0013/0014` 与后续 Layer 4 消费统一验证对象。
- 后续实现或恢复链路应直接消费 `FR-0020` 已冻结对象，不再通过新的 umbrella issue 表达归属。

## 后续消费边界

后续事项如需消费 FR-0020，优先使用以下对象：

- `anti_detection_validation_request`
- `anti_detection_structured_sample`
- `anti_detection_baseline_snapshot`
- `anti_detection_baseline_registry_entry`
- `anti_detection_validation_record`
- `anti_detection_validation_view`

## 非目标

- 不在本文件中重新打开 spec review。
- 不把 `#239` 重新挂回 active backlog。
- 不通过 TODO.md 改写 `spec.md` / `contracts/` / `data-model.md` 的正式契约语义。
