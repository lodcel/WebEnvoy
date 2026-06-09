# FR-0060 实施计划

## 实施目标

冻结 `#1157 Docker / Xvfb Doctor` 的 formal spec suite，定义 CloakBrowser Docker / Xvfb environment admission doctor 的 binary、X server、DISPLAY、headed/headless launch policy、font readiness 与 diagnostic output 边界，供后续 health doctor implementation、admission gate、capability matrix 与 evidence owner 消费。

本 PR 是 formal spec review carrier。合入后只冻结 `FR-0060` suite 与 #1157 sync-map；不自动关闭 #1157，不进入 runtime implementation、Docker/Xvfb command、workflow、capability matrix、fixture 或 live evidence closeout。

## 分阶段拆分

### 阶段 1：formal scope 冻结

- 产出：`spec.md`
- 重点：冻结 ownership、identity、environment inputs、required checks、non-proof semantics、GWT 验收场景与 fail-closed rules。

### 阶段 2：contract / data model 落成

- 产出：`contracts/cloakbrowser-docker-xvfb-doctor.md`、`data-model.md`
- 重点：把 Docker / Xvfb doctor schema、required check mapping、admission lifecycle、redaction model 与 consumer boundary 固定为可消费输入。

### 阶段 3：research / risks / review checklist

- 产出：`research.md`、`risks.md`、`TODO.md`
- 重点：确认本 FR 只消费上游 formal contracts，不执行外部 probe，并记录 environment doctor 被误作 runtime/live proof 的风险。

### 阶段 4：sync map 与 PR 准备

- 产出：`.github/spec-issue-sync-map.yml` 中 #1157 映射、parser-ready PR metadata、验证记录
- 重点：确保 PR 只包含 `FR-0060` suite 与单条 sync-map 映射，closing semantics 为 `Refs #1157`。

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0060-cloakbrowser-docker-xvfb-doctor/**`
  - `.github/spec-issue-sync-map.yml` 中 #1157 对应映射
- 不修改 runtime code、doctor command、Docker image/script、Xvfb launch behavior、workflow、capability matrix、fixtures、tests、GitHub workflows、githooks、`AGENTS.md` 或 `code_review.md`。
- 不修改 `FR-0038`、`FR-0049`、`FR-0050`、`FR-0051`、`FR-0058`、`FR-0059` 的字段 shape。
- 不触碰 #1149/#1150/#1151/#1152/#1153/#1154/#1155/#1156 的 formal suites 或 sync-map entries。
- 不执行 live/browser/profile/account/external-visible 动作。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity 与 hosted checks：

- `bash scripts/setup-git-hooks.sh`
- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0060-cloakbrowser-docker-xvfb-doctor/spec.md`
- `bash scripts/check-pr-purity.sh docs/1157-cloakbrowser-docker-xvfb-doctor main`
- `git diff --check origin/main...HEAD`
- closing semantics same-class search
- PR push 后等待 hosted GitHub checks

语义自检：

- 对照 issue #1157，确认 scope 只覆盖 Docker / Xvfb doctor formal suite。
- 对照 `FR-0038`，确认本 FR 是 provider-specific diagnostics，不重写 shared doctor report shape。
- 对照 CloakBrowser descriptor specs，确认 headed/headless policy 只作为 admission input，不改 descriptor。
- 对照 `FR-0016`，确认本 PR 不声明 fresh live evidence。
- 对照 forbidden scope，确认未进入 runtime behavior、Xvfb launch、Docker script、capability matrix、browser patching、XHS 或 Syvert。

## TDD 范围

当前 PR 不进入实现代码 TDD。

后续 implementation / consumer issue 应优先补：

- Docker / Xvfb doctor parser enum validation tests。
- Binary / X server / DISPLAY fail-closed tests。
- Headless-only path 与 CloakBrowser `headless_policy=forbidden` conflict tests。
- Diagnostic output redaction and machine-readable field validation tests。
- Font readiness warning / required-gate fail-closed tests。
- Consumer tests，确认 Docker / Xvfb doctor pass 不能满足 runtime/live/capability gates。

## 并行 / 串行关系

可并行：

- 不触碰 `FR-0060` suite 的普通文档整理或其他 CloakBrowser formal suite 只读审阅。
- 下游 health / capability / evidence owner 的只读 planning，可提前准备 consumption notes，但不得改写本 suite。

串行 / 依赖：

- 本 work item 依赖 `FR-0038 Provider Health / Doctor Contract` 与已冻结的 CloakBrowser descriptor / evidence policy inputs。
- 后续 Docker / Xvfb doctor implementation 必须消费本 suite，不能在实现期重新定义 headed/headless、DISPLAY、font readiness 或 diagnostic output 语义。
- 任何把 environment doctor pass 提升为 runtime/live/capability success 的实现，都必须另开 formal spec review 并不得在本 PR 中落地。

## 进入实现前条件

- FR-0060 spec review 通过。
- reviewer 确认 Docker / Xvfb doctor 只证明 environment/admission readiness。
- reviewer 确认 headless-only path 不能满足 CloakBrowser real-browser / live evidence route。
- reviewer 确认 diagnostic output redaction 与 fail-closed 规则足够阻断 secret/path leak。
- reviewer 确认本 suite 未混入 runtime、Docker/Xvfb command、workflow、capability matrix、fixtures、browser patching 或 live evidence。
- reviewer 确认 PR closing semantics 使用 `Refs #1157`，且 sync-map 只新增单条映射。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0060-cloakbrowser-docker-xvfb-doctor/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1157 的映射。由于本 PR 不实现 runtime 行为，不需要 container cleanup、Xvfb cleanup、profile cleanup、secret rotation、artifact cleanup 或 external rollback。
