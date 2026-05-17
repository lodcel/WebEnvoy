# FR-0029 TODO

> GitHub Issue / PR / Project 是进度真相源。
> 本文件只保留 FR-0029 的 historical closeout、后续消费边界和恢复入口；不再维护 active checklist。

## Historical Closeout

- `#552` 已作为 FR-0029 canonical FR issue 关闭，当前保持 historical-complete。
- FR-0029 的 owner 范围为 XHS closeout recovery admission formal truth。
- `#445` close condition 未被本 FR 改写；本 FR 只定义从 account-safety / anti-detection 恢复链重新进入 closeout rerun 的准入条件。
- `#238` / FR-0022 当前只保留条件升级 hook，不是最小恢复硬前置。

## 后续消费边界

后续恢复或 closeout 链路应消费：

- `xhs.search`
- `xhs.detail`
- `xhs.user_home`
- `runtime.status.account_safety`
- `runtime.status.xhs_closeout_rhythm`
- `runtime.audit.anti_detection_validation_view`
- `options.xhs_recovery_probe=true`
- `probe-bundle/xhs-recovery-recon-v1`
- `probe-bundle/xhs-closeout-min-v1`

## 恢复入口

- 当前恢复顺序为 `#265 -> #267 -> #266 -> #239 -> #552 integrated verify`。
- 后续如需升级 Layer 4 为硬前置，必须先进行独立 truth-sync，不得通过 TODO.md 临时改写。
