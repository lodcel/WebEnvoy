# FR-0062 TODO

## Review 阶段

- [ ] 确认 `FR-0062` 只定义 Live-Write Capability Taxonomy。
- [ ] 确认 frozen levels 只有 `read_only`、`write_admit`、`write_prepare`、`live_write_commit`。
- [ ] 确认 `write_admit`、`write_prepare` 和 `live_write_commit` 语义不重叠。
- [ ] 确认 `live_write_commit` 默认 locked，且本 PR 不解除 default commit lock。
- [ ] 确认 #1178 owns operator unlock，#1179 owns provider requirements，#1180 owns default commit lock，#1211 owns release gate matrix。
- [ ] 确认 #835 CLOSED 只作为历史 baseline / related controlled-success owner，不作为当前 live evidence。
- [ ] 确认本 suite 没有 runtime/source code、tests、fixtures、scripts、workflows、browser/account/live action、Syvert normalized result、provider adapter implementation 或 issue closeout。
- [ ] 确认 PR metadata 使用 `Refs #1174` / refs-only，并且 GitHub `closingIssuesReferences=[]`。

## 实现前待办

- [ ] #1178 consumes `live_write_commit` and freezes operator unlock evidence.
- [ ] #1179 consumes `write_admit` / `write_prepare` vocabulary for `xhs.creator_publish.admit` provider requirements.
- [ ] #1180 consumes `live_write_commit` and freezes default commit lock release semantics.
- [ ] #1211 consumes all capability levels and blocking reasons in the release gate matrix.
- [ ] Future parser / release gate rejects aliases and unknown capability levels.
- [ ] Future live-write implementation supplies current operator unlock, account safety, provider requirement, default lock release and live evidence refs before any commit allow.
