# FR-0030 TODO

> GitHub Issue / PR / Project 是进度真相源。
> 本文件只保留 FR-0030 的 historical closeout、后续消费边界和恢复入口；不再维护 active checklist。

## Historical Closeout

- `#581` 已作为 FR-0030 canonical FR issue 关闭，当前保持 historical-complete。
- FR-0030 的 owner 范围为 XHS closeout route evidence taxonomy，来源于 `#579` route strategy 子任务。
- `#579` 已关闭，且其 route contract 已完成 `#581 -> #580 -> #583 -> #582` 子任务链。
- `#581` 当前只作为 route evidence taxonomy 的已完成前置被消费。

## 后续消费边界

后续恢复链路应消费：

- `route_evidence_class`
- `dom_state_extraction.extraction_layer`
- DOM/state provenance 字段
- detail/user_home route-specific DOM/state evidence
- `#583` signed continuity gate
- `#582` active fetch fallback gate

## 非目标

- DOM/state evidence 不替代 `#445` full closeout success bar。
- Active fetch fallback 仍必须由 `#582` 单独 gate。
- 本文件不重新打开 spec review，也不修改 FR-0005 docs。
