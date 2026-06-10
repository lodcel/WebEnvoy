# FR-0056 实施计划

## 实施目标

把 `#1153 Extension Capability Gate` 冻结成一个窄 formal suite：只定义 CloakBrowser workflows 在依赖 WebEnvoy extension bridge、WebEnvoy relay bridge 或 Native Messaging bridge 前必须消费的 admission gate，明确 direct / persistent / cloakserve 三种 variant 的 fail-closed 规则、required evidence refs 与 downstream owner 边界。

本 PR 只冻结 `FR-0056` suite 与 #1153 sync-map mapping，使用 `Refs #1153` / refs-only 语义；runtime code、provider adapter behavior、extension/native host implementation、browser/live actions、guardian/formal review、controlled merge 和 issue closeout 不在本 PR 范围。

## 分阶段拆分

### 阶段 1：gate 边界冻结

- 产出：`spec.md`、`contracts/extension-capability-gate.md`
- 重点：确认 #1153 只拥有 extension capability/admission gate，不重写 FR-0052 matrix、FR-0054 health、FR-0055 limitation gate 或 FR-0057 doctor handoff。

### 阶段 2：input / output 与 decision policy 落成

- 产出：`data-model.md`
- 重点：定义 gate input、requested workflow、variant policy、minimum support state、blocking reasons 与 gate result。

### 阶段 3：风险与 evidence boundary 收口

- 产出：`risks.md`、`research.md`、`TODO.md`
- 重点：确认 health / doctor pass 不等于 runtime/live ready，direct / cloakserve extension bridge fail closed，persistent route 需要 current health / doctor / runtime refs。

### 阶段 4：PR 与验证准备

- 产出：parser-friendly PR body、验证记录、纯度预检结果
- 重点：确保 PR 只包含 FR-0056 suite 与 sync map，不混入 runtime、scripts、workflows、browser/live actions、#1145 closeout 或 issue closeout。

## 实现约束

- 不修改 runtime、extension、native host、provider adapter、Playwright、provider selection、doctor、CLI、fixtures、tests、scripts、workflows、githooks、`AGENTS.md` 或 `code_review.md`。
- 不修改 `FR-0052` capability matrix、`FR-0054` persistent profile health、`FR-0055` cloakserve limitation gate 或 `FR-0057` Native Messaging bridge doctor。
- 不触发 browser/runtime/live/Syvert/XHS/account actions。
- 不声明 extension bridge ready、Native Messaging ready、target-tab ready、runtime-ready、live evidence attested 或 #1153 closeout。
- 不触碰 #1145 closeout blocker、repo Loom carriers 或 live-evidence governance 冻结目标文件。

## 测试与验证策略

- 文档/规约静态检查：
  - `bash scripts/docs-guard.sh`
  - `bash scripts/spec-guard.sh`
  - `bash scripts/spec-issue-sync-map.sh validate`
  - `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0056-extension-capability-gate/spec.md`
- PR 纯度检查：
  - `bash scripts/check-pr-purity.sh work/1153-extension-capability-gate main`
- diff 检查：
  - `git diff --check origin/main...HEAD`
  - `git diff --stat origin/main...HEAD`
  - `git diff --name-only origin/main...HEAD`
- 语义自检：
  - 对照 issue #1153 和 parent #1114，确认只覆盖 extension capability/admission gate。
  - 对照 FR-0052，确认消费 capability rows，不改写 matrix。
  - 对照 FR-0054，确认 health inputs 只作为 prerequisite，不变成 runtime/live proof。
  - 对照 FR-0055，确认 cloakserve extension/native/relay workflow default blocked / deny。
  - 对照 FR-0057，确认 Native Messaging doctor owner 是 WebEnvoy bridge owner，doctor pass 不等于 runtime-ready。

## TDD 范围

- 当前只冻结 formal extension capability gate contract，不进入实现代码 TDD。
- 后续 implementation 或 parser issue 应优先补以下测试：
  - persistent extension bridge rejects missing/stale `FR-0054` extension health.
  - persistent Native Messaging workflow rejects missing/stale/non-WebEnvoy `FR-0057` bridge doctor.
  - health / doctor pass without runtime attestation cannot produce runtime/page workflow allow.
  - direct Native Messaging and extension bridge requests fail closed.
  - cloakserve extension / relay / Native Messaging workflow consumes `FR-0055` and defaults blocked / deny.
  - runtime ping, bootstrap ack, descriptor existence, stub/fake host success or historical artifact cannot satisfy this gate.

## 并行 / 串行关系

- 可并行：
  - 不触碰 FR-0056 suite 的普通本仓库文档整理。
  - 不消费 extension capability gate 的 runtime bugfix。
- 串行 / 依赖：
  - 本 work item 依赖 `FR-0052` capability matrix、`FR-0054` persistent profile health、`FR-0055` cloakserve limitation gate 与 `FR-0057` Native Messaging bridge doctor formal inputs。
  - Future runtime / provider selection owner must consume FR-0056 before admitting workflows requiring extension bridge.
  - Future page read/write/download owner must still provide runtime / target tab / observation / live evidence refs according to requested workflow minimum.
  - Future cloakserve experimental owner must consume both FR-0055 and FR-0056 before any downstream evaluation.

## 进入实现前条件

- FR-0056 spec review 通过。
- reviewer 确认本 PR 使用 `Refs #1153` / refs-only，且 GitHub `closingIssuesReferences=[]`。
- reviewer 确认 suite 只定义 extension capability/admission gate，不实现 runtime/source code 或 browser/live behavior。
- reviewer 确认 persistent route requires current health / doctor / runtime refs and direct / cloakserve fail closed where required.
- reviewer 确认 PR metadata 声明 formal spec/work-item PR、local_only integration、live evidence N/A、gate owner scheduler。
