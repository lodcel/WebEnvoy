# FR-0025 TODO

> GitHub Issue / PR / Project 是进度真相源。
> 本文件只保留 FR-0025 的 historical closeout、后续消费边界和 deferred scope；不再维护 active checklist。

## Historical Closeout

- `#504` 已作为 FR-0025 canonical FR issue 关闭，当前保持 historical-complete。
- FR-0025 的 owner 范围只限于 `xhs.detail` / `xhs.user_home` command surface 与 request-context baseline。
- 本 FR 不再承接 successor detail implementation 的后续 gate；后续实现路径消费 `#504 + #505` 后，仍以 `#508` shared reuse semantics 和 `#510` detail derivation truth 作为已完成前置。

## 后续消费边界

后续实现应优先消费本 FR 冻结的：

- current public command surface 结论
- caller-facing `ability` envelope
- `note_id` / `user_id`
- `explore_detail_tab` / `profile_tab`
- `FR-0023` 四个顶层对象输入 ownership
- `options.upstream_authorization_request` 兼容 mirror 路径
- `request_admission_result` / `execution_audit` 的 command-level ownership

## Deferred Scope

- `#505` / FR-0026：`xhs.detail` canonical identity 与 `image_scenes`
- `#508` / FR-0027：shared request-context minimal invariants 与 successor implementation shared gate
- `#510` / FR-0028：successor detail implementation path 所需的 detail derivation gate
