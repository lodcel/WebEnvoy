# FR-0050 实施计划

## 实施目标

把 `#1147 cloakbrowser.persistent Descriptor` 冻结成一个窄 formal suite：只定义 persistent CloakBrowser profile、extension workflow capability references、health requirement inputs、provider contract references，以及与 direct descriptor 的差异边界，使 #1149 capability matrix 和后续 health issues 可消费。

`#1147` 是 `work-item-complete`：合入本 suite 后满足 persistent descriptor freeze 的关闭条件；capability matrix、health checks、fixtures、runtime implementation、launch evidence 与 live evidence 由后续 issue 承接。

## 分阶段拆分

### 阶段 1：persistent descriptor 边界冻结

- 产出：`spec.md`、`contracts/cloakbrowser-persistent-descriptor.md`
- 重点：确认 `cloakbrowser.persistent` 只表达 static descriptor refs，不定义 health result、runtime ready 或 capability matrix。

### 阶段 2：profile / extension workflow / health inputs 落成

- 产出：`data-model.md`
- 重点：冻结 persistent profile reference、profile identity constraints、extension workflow refs 与 health requirement inputs。

### 阶段 3：direct 差异与禁止范围收口

- 产出：`risks.md`、`TODO.md`
- 重点：确认本 suite 不推进 `#1146/#1148/#1149`，不暴露 CloakBrowser private patch schema，不夹带 XHS、Syvert 或 runtime behavior。

### 阶段 4：PR 与验证准备

- 产出：parser-friendly PR body、验证记录、纯度预检结果
- 重点：确保 PR 只包含 FR-0050 suite 与 sync map，不混入 runtime、fixtures、health、capability matrix 或 launch evidence。

## 实现约束

- 只修改 `docs/dev/specs/FR-0050-cloakbrowser-persistent-descriptor/**` 与 `.github/spec-issue-sync-map.yml`。
- 不修改 runtime、extension、native host、Playwright、provider selection、doctor、CLI、fixtures 或测试代码。
- 不推进 #1146 direct descriptor、#1148 cloakserve descriptor、#1149 capability matrix 或后续 health implementation。
- 不定义 business capability support matrix、verification threshold、health result schema、launch evidence、redaction shape、fixture payload、fresh live evidence 或 runtime attestation。
- 不把 CloakBrowser private patch schema、driver internal state、license secret、account credential 或 broker credential 写入 WebEnvoy core contract。
- 不触碰 `.github/workflows/`、`scripts/`、`.githooks/`、`AGENTS.md` 或 `code_review.md`。

## 测试与验证策略

- 文档/规约静态检查：
  - `bash scripts/docs-guard.sh`
  - `bash scripts/spec-guard.sh`
  - `bash scripts/spec-issue-sync-map.sh validate`
  - `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0050-cloakbrowser-persistent-descriptor/spec.md`
- PR 纯度检查：
  - `bash scripts/check-pr-purity.sh docs/1147-cloakbrowser-persistent-descriptor main`
- diff 检查：
  - `git diff --check origin/main...HEAD`
  - `git diff --stat origin/main...HEAD`
  - `git diff --name-only origin/main...HEAD`
- 语义自检：
  - 对照 issue #1147，确认只覆盖 persistent descriptor。
  - 对照 FR-0033/FR-0036/FR-0038，确认只消费 provider contract / registry / health carrier。
  - 对照 sibling #1146/#1148/#1149，确认没有直接定义 direct launch、cloakserve descriptor 或 capability matrix。

## TDD 范围

- 当前只冻结 formal descriptor contract，不进入实现代码 TDD。
- 本 PR 不新增 fixture，避免把 #1149 capability matrix 或 health issue 的数据边界提前写死。
- 后续 parser / fixture / implementation issue 应优先补以下测试：
  - descriptor parser 接受 `provider_id=cloakbrowser.persistent` 且要求 `variant_kind=persistent`。
  - descriptor parser 拒绝缺少 profile / extension workflow / native messaging / provider broker refs。
  - descriptor parser 拒绝内联 credentials、cookies、license secrets、broker credentials 或 raw sensitive paths。
  - capability matrix 不从 descriptor existence 推导 business action support。
  - health consumer 不从 descriptor refs 推导 doctor pass、runtime ready 或 live evidence ready。

## 并行 / 串行关系

- 可并行：
  - `#1146 cloakbrowser.direct Descriptor`，只要不共享同一 suite 或修改本 descriptor。
  - `#1148 cloakbrowser.cloakserve Descriptor`，只要不把 cloakserve lifecycle 写入 persistent descriptor。
  - 不触碰 FR-0050 suite 的普通本仓库文档整理。
- 串行 / 依赖：
  - 本 work item 依赖 `FR-0033 Browser Provider Contract`。
  - 后续 `#1149` 必须消费本 descriptor 与 FR-0035，不能在 #1147 中提前定义 matrix。
  - 后续 health issues 必须消费 FR-0038，不能从本 descriptor 推导 health schema。
  - 后续 fixtures 必须等待 descriptor、matrix 与 health owner 提供输入。

## 进入实现前条件

- FR-0050 spec review 通过。
- reviewer 确认 #1147 的关闭语义是 persistent descriptor complete，不是 runtime behavior complete。
- reviewer 确认 persistent profile / extension workflow / health requirement inputs 只以 refs 表达，没有写成 readiness 或 pass evidence。
- reviewer 确认 direct 差异边界清楚，未推进 #1146 direct launch / final args evidence。
- reviewer 确认本 suite 不暴露 CloakBrowser private patch schema 或 secret。
