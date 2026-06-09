# FR-0058 实施计划

## 实施目标

把 `#1155 Final Args Evidence` 冻结成一个窄 formal suite：定义 CloakBrowser variants 可共享消费的 final args evidence contract，覆盖 build-time assembled / reconstructed provenance、redaction boundary、non-proof semantics、variant-specific限制和 downstream fail-closed 行为，供后续 health/capability/evidence owners 消费。

本 PR 是 formal spec review carrier：合入后冻结 `FR-0058` formal suite，并为 `FR-0049` / `FR-0050` / `FR-0051`、`FR-0040` 以及后续 health/capability/limitation owner 提供输入；它不自动关闭 `#1155`，也不进入 runtime implementation。

## 分阶段拆分

### 阶段 1：shared contract shape 冻结

- 产出：`spec.md`、`contracts/cloakbrowser-final-args-evidence-contract.md`
- 重点：冻结 identity、provenance、args summary、redaction boundary、semantic conclusion、variant-specific boundary、consumer contract。

### 阶段 2：data model 与 fail-closed 语义落成

- 产出：`data-model.md`
- 重点：固定 build-time assembled 与 reconstructed evidence lifecycle、weak evidence status、required consumer behavior、shared slot naming。

### 阶段 3：风险与 review checklist 收口

- 产出：`risks.md`、`TODO.md`
- 重点：确认 secret/path leak、防止 final args 被误报为 readiness/live evidence、防止 direct/persistent/cloakserve scope 混写。

### 阶段 4：映射与 PR 元数据准备

- 产出：`.github/spec-issue-sync-map.yml` 中单条 `FR-0058 -> #1155` 映射、parser-ready PR body、验证记录
- 重点：确保 PR 只包含 FR-0058 suite 与单条 sync-map 映射；Closing semantics 固定为 `Refs #1155`。

## 实现约束

- 只允许写入 `docs/dev/specs/FR-0058-cloakbrowser-final-args-evidence/**` 与 `.github/spec-issue-sync-map.yml` 单条映射。
- 不修改 runtime、launch code、health doctor、capability matrix、limitation gate、native messaging bridge、official Chrome service worker、browser patching、Syvert、XHS、fixtures 或 tests。
- 不改动 `FR-0049` / `FR-0050` / `FR-0051` / `FR-0037` / `FR-0040` / `FR-0041` 的既有 contract 文本。
- 不定义 live evidence record、runtime readiness schema、doctor result schema、broker protocol 或 raw artifact payload。
- 不新增 `research.md`：当前 scope 已由上游 formal contract 与 sibling descriptor 收敛；若出现新未知项，必须另开 issue。

## 测试与验证策略

文档/规约静态检查：

- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0058-cloakbrowser-final-args-evidence/spec.md`

PR 纯度检查：

- `bash scripts/check-pr-purity.sh docs/1155-cloakbrowser-final-args-evidence main`

diff 检查：

- `git diff --check origin/main...HEAD`
- `git diff --stat origin/main...HEAD`
- `git diff --name-only origin/main...HEAD`

语义自检：

- 对照 issue #1155，确认只冻结 final args evidence formal suite，不进入 runtime / health / capability / limitation owner。
- 对照 `FR-0037`、`FR-0040`、`FR-0041`，确认 final args evidence 只消费 launch envelope、provider evidence kernel 与 redaction policy。
- 对照 `FR-0049` / `FR-0050` / `FR-0051`，确认 shared contract 没有重写 sibling descriptor 的 variant ownership。
- same-class 搜索 `Fixes #1155` / auto-close 语义，确认本 PR 保持 `Refs #1155`。

## TDD 范围

当前只冻结 formal evidence contract，不进入实现代码 TDD。

后续 implementation / parser / fixture issue 应优先补以下测试：

- final args evidence parser 接受 `build_time_assembled`、`reconstructed_from_provider_signal`、`reconstructed_from_artifact`，并拒绝未声明 provenance 的 record。
- redaction validator 拒绝 full local path、raw argv token stream、token、proxy credential、fingerprint seed value、private patch payload。
- descriptor / capability consumer 不把 final args evidence 误判为 runtime ready、health pass、browser honored args 或 live evidence。
- variant consumer 在 `historical_background`、`reconstructed_partial`、`unknown` 状态下命中 required evidence 时 fail-closed。

## 并行 / 串行关系

可并行：

- 不修改 FR-0058 suite 的其他本仓库文档整理。
- 后续 health / capability / limitation owner 可以基于本 suite 起草自己的 formal contract，但不得回写本 suite。

串行 / 依赖：

- 本 work item 依赖已冻结的 `FR-0037`、`FR-0040`、`FR-0041` 以及已落成的 `FR-0049` / `FR-0050` / `FR-0051` descriptor 输入。
- 后续 health/capability/evidence owner 必须消费本 suite，不能在实现期重新发明 final args evidence 语义。
- `#1149/#1152` 不在本 worker scope 内；它们后续只能读取本 suite 的 shared boundary。

## 进入实现前条件

- FR-0058 spec review 通过。
- reviewer 确认 `FR-0058` 只冻结 final args evidence contract，不隐式推进 runtime、health、capability 或 limitation gate。
- reviewer 确认 final args evidence 的 `does_not_prove` 覆盖 browser honored args、runtime ready、health pass、capability allowed、anti-detection pass 与 live evidence attested。
- reviewer 确认 build-time 与 reconstructed provenance 都有明确 fail-closed 规则和 redaction boundary。
- reviewer 确认 PR closing semantics 使用 `Refs #1155`，且 sync-map 只新增单条映射。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0058-cloakbrowser-final-args-evidence/**`，并移除 `.github/spec-issue-sync-map.yml` 中 `FR-0058 -> #1155` 的映射。由于本 PR 不实现 runtime 行为，不需要 profile 清理、artifact 清除、secret rotation 或 external runtime rollback。
