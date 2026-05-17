# FR-0027 TODO

> GitHub Issue / PR / Project 是进度真相源。
> 本文件只保留 FR-0027 的 historical closeout、后续消费边界和实现入口；不再维护 active checklist。

## Historical Closeout

- `#508` 已作为 FR-0027 canonical FR issue 关闭，当前保持 historical-complete。
- Merged formal suite 为 `#509`；`#512` compatibility/backwrite 与 `#513` prerequisite-tree maintenance 已在关闭前完成。
- FR-0027 的 owner 范围为 XHS shared request-context minimal invariants 与 successor implementation shared gate。
- 关闭本 FR 不等于 implementation-ready；后续实现仍需显式消费已冻结 shared gate truth。

## 后续消费边界

后续实现应优先消费本 FR 冻结的：

- page-local / document-local `page_context_namespace`
- route bucket 与 shape slot 层级身份
- canonical `shape_key`、exact-match、fail-closed、namespace isolation
- sibling-shape `shape_mismatch` 的最小 shared 诊断面
- successor implementation 的 shared formal gate 表达

## 非目标

- 不在本文件中重新打开 spec review。
- 不把 `#508` 重新挂回 active backlog。
- 不通过 TODO.md 改写 `spec.md` / `contracts/` / `data-model.md` 的正式契约语义。
