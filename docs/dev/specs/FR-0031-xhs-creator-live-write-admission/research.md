# FR-0031 Research

## 2026-05-26 #779 fresh checkpoint

来源：#779 recovery checkpoint 与本地只读命令。

### read closeout baseline

`runtime.audit` 对 `xhs_001` 的 `live_read_high_risk` 查询显示：

- `probe_bundle_ref=probe-bundle/xhs-closeout-min-v1`
- `FR-0012/FR-0013/FR-0014` 均为 `baseline_status=ready`
- `current_result_state=verified`
- `current_drift_state=no_drift`
- `all_required_ready=true`

结论：read closeout baseline 已存在，但 scope 是 `www.xiaohongshu.com` / `live_read_high_risk`。

### creator live_write gate

`runtime.closeout_gate` 对 creator upload scope 查询显示：

- `target_domain=creator.xiaohongshu.com`
- `target_page=creator_publish_tab`
- `requested_execution_mode=live_write`
- `closeout_gate_aggregator.decision=NO_GO`
- `anti_detection_validation_view.effective_execution_mode=live_write`
- `missing_target_fr_refs=[FR-0012, FR-0013, FR-0014]`

结论：creator upload live write admission baseline 不存在，不能由 read baseline 替代。

## 取舍

### 方案 A：扩写 FR-0029

拒绝。FR-0029 已明确 `creator.xiaohongshu.com` 不在 closeout admission scope 内，扩写会破坏 read closeout owner 边界。

### 方案 B：在 #779 内临时特判 live_write

拒绝。#779 是 blocker recovery issue，不应发明正式契约，也不能绕过 spec review 进入高风险 live write gate。

### 方案 C：新增 FR-0031

采用。FR-0031 只定义 creator live write admission，不证明上传成功；它与 FR-0029 并列，分别拥有 read closeout admission 与 creator write admission。
