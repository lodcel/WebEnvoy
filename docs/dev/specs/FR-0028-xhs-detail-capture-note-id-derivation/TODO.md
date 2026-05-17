# FR-0028 TODO

> GitHub Issue / PR / Project 是进度真相源。
> 本文件只保留 FR-0028 的 historical closeout、后续消费边界和实现入口；不再维护 active checklist。

## Historical Closeout

- `#510` 已作为 FR-0028 canonical FR issue 关闭，当前保持 historical-complete。
- FR-0028 的 owner 范围为 current-main observable detail matcher 与 admitted canonical `note_id` derivation truth。
- Prerequisite-tree maintenance 已由 `#513/#514` 收口；本 FR 不再隐式承接该维护范围。

## 后续消费边界

后续实现应优先消费本 FR 冻结的：

- current-main observable detail response candidate matcher 边界
- response-side admitted canonical `note_id` derivation source
- rejected / incompatible observation 可保留的 candidate-only derivation 边界
- request-side `source_note_id`、referrer、metadata-only note fields 的 current formal 地位

## 实现入口

- successor implementation 后续应消费 `#504 + #505 + #508 + #510` 的已完成前置。
- 本文件不重新打开 spec review，也不把 `#510` 重新挂回 active backlog。
