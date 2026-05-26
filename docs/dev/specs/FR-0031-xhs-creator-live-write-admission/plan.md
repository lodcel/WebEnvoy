# FR-0031 实施计划

## 实施目标

冻结 XHS creator upload live write admission contract，让 #779/#756 不再把 `FR-0029` read closeout baseline 误用为 creator write baseline，并为后续 non-write readiness 与受控上传 live evidence 提供可验证入口。

## 分阶段拆分

### 阶段 1：formal contract

- 产出：`spec.md`、`contracts/xhs-creator-live-write-admission.md`
- 重点：冻结 owner、scope、probe bundle、validation binding 与 `FR-0029` 隔离边界。

### 阶段 2：data model and risk

- 产出：`data-model.md`、`risks.md`
- 重点：冻结 creator write scope、target binding、validation view 与 admission decision 的最小字段。

### 阶段 3：runtime gate implementation

- 产出：实现 PR
- 重点：让 `runtime.closeout_gate` 在 creator write scope 下消费独立 validation view，并在缺失时 fail closed。

### 阶段 4：profile/runtime recovery

- 产出：#820 或后续 PR
- 重点：恢复 managed profile root、Service Worker freshness 与 creator target continuity。

### 阶段 5：#779 closeout rerun

- 产出：#779 closeout evidence
- 重点：重新执行 `runtime.status`、`runtime.audit`、`runtime.closeout_gate`，证明 runtime/profile/target/validation 不再阻断。

## 实现约束

- 不执行真实上传、提交、发布、文件选择器、DataTransfer 注入或不可逆写入。
- 不恢复 Syvert integration 默认门禁。
- 不把 `FR-0029` read baseline 复用为 creator write baseline。
- 不把具体 profile 名写成 formal contract 常量。
- 不新增第二套底层 anti-detection object family；validation truth 仍由 `FR-0020` 对象承载。

## 测试与验证策略

- 文档门禁：
  - `bash scripts/docs-guard.sh`
  - `bash scripts/spec-guard.sh`
  - `git diff --check`
- 实现阶段测试：
  - `runtime.closeout_gate` creator write missing validation returns `NO_GO`
  - read baseline ready does not satisfy creator write validation
  - creator write validation ready plus runtime/target/account/rhythm ready returns `GO`
  - Service Worker stale blocks before target/live write probe
  - target missing blocks before validation-ready admission success
- 运行时恢复验证：
  - `runtime.status`
  - `runtime.audit`
  - `runtime.closeout_gate`
  - dry-run 或 non-write readiness probe

## TDD 范围

- 规约 PR 不改运行时代码。
- 实现 PR 必须先补 contract tests，覆盖：
  - `live_read_high_risk` ready + `live_write` missing -> `NO_GO`
  - `live_write` all three validation scopes ready -> validation gate ready
  - creator target missing -> target blocker
  - identity stale -> identity blocker
  - account safety blocked -> account blocker

## 并行 / 串行关系

- 串行：
  - #819 / FR-0031 spec review 必须先于 creator write admission implementation。
  - #820 profile/runtime recovery 必须先于 #779 latest readiness rerun。
  - #779 closeout 必须等待 #819 和 #820 都有可复核结论。
- 可并行：
  - #819 spec review 可与 #820 的只读 profile/root 归属分析并行。
  - #819 实现可与 #820 的 Service Worker refresh 准备并行，但不能共享 live_write action。

## 进入实现前条件

- #819 spec review 通过。
- reviewer 确认 creator write scope 与 `FR-0029` read scope 已隔离。
- reviewer 确认 non-write readiness ladder 不会执行上传、提交、发布或账号接触动作。
- reviewer 确认 `FR-0012/0013/0014` validation binding 与 `FR-0020` 对象关系已冻结。
- #820 已给出 profile/root 与 target continuity 的恢复路径或明确 blocker。
