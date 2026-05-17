# FR-0026 TODO

> GitHub Issue / PR / Project 是进度真相源。
> 本文件只保留 FR-0026 的 historical closeout、后续消费边界和 deferred scope；不再维护 active checklist。

## Historical Closeout

- `#505` 已作为 FR-0026 canonical FR issue 关闭，当前保持 historical-complete。
- FR-0026 的 owner 范围只限于 current v1 `xhs.detail` canonical identity。
- 本 FR 不拥有 shared request-context reuse、detail matcher、route eligibility 或 successor implementation gate；这些已分别由 `#508` 与 `#510` 收口。

## 后续消费边界

后续实现应优先消费本 FR 冻结的：

- current v1 `xhs.detail` identity 只包含 `note_id`
- `image_scenes` 当前不进入 identity
- `source_note_id` 当前不进入 admitted canonical mapping
- future identity expansion 必须等待新的 spec 修订

## Deferred Scope

- `#508` / FR-0027：shared request-context reuse、slotting、route eligibility 与 successor shared gate
- `#510` / FR-0028：detail matcher 与 admitted canonical `note_id` derivation
