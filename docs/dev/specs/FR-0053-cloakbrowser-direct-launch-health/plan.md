# FR-0053 实施计划

## 实施目标

冻结 `#1150 Direct Launch Health` 的 formal spec suite，定义 `cloakbrowser.direct` 启动健康检查的版本证据、transport readiness、启动参数、二进制、环境探测、可选 extension 状态与 fail-closed 输出边界，供后续 doctor/admission、runtime、capability 与 launch evidence owner 消费。

本 PR 是 formal spec review carrier。合入后只冻结 `FR-0053` suite 与 #1150 sync-map；PR 使用 `Refs #1150`，不进入 runtime implementation、doctor command、launch behavior、capability matrix、limitation gate、native messaging bridge、browser patching、Syvert、XHS 或 live evidence closeout。

## 分阶段拆分

### 阶段 1：formal scope 与 contract 冻结

- 产出：`spec.md`、`contracts/cloakbrowser-direct-launch-health.md`
- 重点：冻结 `cloakbrowser_direct_launch_health_report` identity、input refs、check categories、evidence refs、outcome、next gates 与 non-proof semantics。

### 阶段 2：data model 与 research notes

- 产出：`data-model.md`、`research.md`
- 重点：固定 health/admission evidence lifecycle、required check mapping、deferred runtime/live unknowns 与相邻 FR 消费关系。

### 阶段 3：risk / TODO / review checklist 收口

- 产出：`risks.md`、`TODO.md`
- 重点：确认 health pass 不等于 runtime/live success，transport readiness 不越界，optional extension 不升级为 persistent identity，redaction fail-closed。

### 阶段 4：sync map 与 PR metadata 准备

- 产出：`.github/spec-issue-sync-map.yml` 中单条 `FR-0053 -> #1150` 映射、parser-ready PR body、验证记录
- 重点：确保 PR 只包含 FR-0053 suite 与单条 sync-map 映射，closing semantics 固定为 `Refs #1150`。

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0053-cloakbrowser-direct-launch-health/**`
  - `.github/spec-issue-sync-map.yml` 中 #1150 对应映射
- 不修改 runtime code、doctor command、launch behavior、capability matrix、limitation gate、native messaging bridge、provider adapter、fixtures、tests、scripts、GitHub workflows、githooks、`AGENTS.md` 或 `code_review.md`。
- 不触碰 #1149/#1151/#1152/#1153/#1154/#1155/#1156/#1157 spec suites 或 sync-map entries。
- 不修改 `FR-0038`、`FR-0049`、`FR-0058`、`FR-0059` 的字段 shape。
- 不执行 live/browser/profile/account/external-visible 动作。
- 不把 health/admission evidence 写成 runtime attestation、live evidence、capability allow 或 business action success。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity、closing semantics 与 hosted checks：

- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0053-cloakbrowser-direct-launch-health/spec.md`
- `bash scripts/check-pr-purity.sh docs/1150-cloakbrowser-direct-launch-health main`
- `git diff --check origin/main...HEAD`
- `git diff --stat origin/main...HEAD`
- `git diff --name-only origin/main...HEAD`
- same-class search for #1150 auto-close wording
- PR push 后等待 hosted GitHub checks

语义自检：

- 对照 issue #1150，确认 scope 只覆盖 direct launch health formal contract。
- 对照 `FR-0038`，确认 provider doctor semantics 没有被重写或升级为 runtime/live proof。
- 对照 `FR-0049`，确认 direct descriptor 的 Native Messaging none、ephemeral profile、optional extension 与 final args limitation 被保留。
- 对照 `FR-0058`，确认 final args evidence 只证明 input shape。
- 对照 `FR-0059`，确认 fingerprint seed / hash / private patch 不进入 public surface。
- 对照 forbidden scope，确认未进入 runtime、health implementation、capability matrix、limitation gate、browser patching、Syvert、XHS 或 live evidence execution。

## TDD 范围

当前 PR 不进入实现代码 TDD。

后续 implementation / parser / fixture issue 应优先补：

- direct launch health report schema enum validation。
- required check mapping tests for binary/version/final args/environment/transport/optional extension。
- fail-closed tests for missing / unknown / stale / redaction invalid required evidence。
- transport readiness tests proving it cannot satisfy target tab ready or page automation success。
- optional extension tests proving not-required extension absence is warn / not applicable, not provider blocking。
- redaction tests rejecting raw path、raw argv、env dump、token、seed、private patch payload。
- consumer tests proving health pass cannot satisfy runtime_attested / live_evidence_attested / capability_allowed。

## 并行 / 串行关系

可并行：

- 不触碰 `FR-0053` suite 的普通文档整理。
- 下游 owner 的只读 planning 可以提前准备 health/capability/runtime consumption notes，但不得改写本 suite。

串行 / 依赖：

- 本 work item 依赖已冻结的 `FR-0038 Provider Health / Doctor Contract` 与 `FR-0049 cloakbrowser.direct Descriptor`。
- 本 work item 消费 `FR-0058 Final Args Evidence` 与 `FR-0059 Fingerprint Seed Evidence Policy`，不能重定义它们的证据 shape。
- 后续 capability matrix / runtime implementation / launch evidence owner 必须消费本 suite，不能在实现期重新发明 direct launch health 语义。
- #1149/#1152/#1153 不在本 worker scope 内。

## 进入实现前条件

- FR-0053 spec review 通过。
- reviewer 确认 direct launch health 只提供 health/admission evidence，不提供 runtime/live/capability success。
- reviewer 确认 required check mapping 覆盖 binary、version、launch args、environment、transport、optional extension 与 admission summary。
- reviewer 确认 Native Messaging 在 direct variant 中保持 not applicable。
- reviewer 确认 final args、fingerprint seed、transport 与 extension status 的 non-proof / redaction / fail-closed 边界完整。
- reviewer 确认 PR closing semantics 使用 `Refs #1150`，且 sync-map 只新增单条 #1150 映射。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0053-cloakbrowser-direct-launch-health/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1150 的映射。由于本 PR 不实现 runtime 行为，不需要 profile 清理、secret rotation、artifact cleanup、extension uninstall 或 external runtime rollback。
