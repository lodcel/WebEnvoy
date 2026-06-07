# FR-0047 实施计划

## 实施目标

冻结 `#1142 Extension Service Worker Freshness Health` 的 formal spec suite，定义 official Chrome persistent active extension bundle freshness / service worker code identity health 如何消费 `FR-0038 Provider Health / Doctor Contract`。

本 PR 是 formal spec review carrier。合入后满足 #1142 的规约冻结输入；runtime implementation、doctor command、fixture、launch evidence 与 adjacent health issues 由后续事项承接。

## 分阶段拆分

### 阶段 1：health ownership 与 FR-0038 映射

- 产出：`spec.md`、`contracts/service-worker-freshness-health.md`
- 重点：冻结 `extension_load` check、status / severity / blocking、diagnostics code 与 fail-closed 映射。

### 阶段 2：evidence / redaction 消费

- 产出：`data-model.md`
- 重点：确认 evidence refs 只消费 FR-0038 / FR-0040 / FR-0041，不创建 launch evidence 或新 health schema。

### 阶段 3：边界与风险收敛

- 产出：`risks.md`、`TODO.md`
- 重点：把 #1140、#1141、#1139、#1143、#1144 与 runtime/live/browser actions 排除在本 FR 外。

### 阶段 4：spec review 准备

- 产出：formal spec review PR、验证记录、PR metadata
- 重点：只改 `.github/spec-issue-sync-map.yml` 与 `docs/dev/specs/FR-0047-service-worker-freshness-health/**`，等待 scheduler-owned gate。

## 实现约束

- 不修改 runtime、extension、native host、Playwright、CLI、doctor command、provider registry、fixtures、workflow 或脚本。
- 不定义新 health result schema；只消费 FR-0038。
- 不定义 #1140 persistent extension identity health。
- 不定义 #1141 native messaging health。
- 不定义 #1139 capability matrix。
- 不推进 #1143 launch evidence 或 #1144 fixtures。
- 不执行 live/browser/runtime/Syvert/CloakBrowser/XHS/account-touching 动作。

## 测试与验证策略

本 PR 的验证范围是文档、spec suite、sync map、PR 纯度与 hosted checks:

- `bash scripts/setup-git-hooks.sh`
- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh resolve docs/dev/specs/FR-0047-service-worker-freshness-health/spec.md`
- `git diff --check origin/main...HEAD`
- `bash scripts/check-pr-purity.sh docs/m3-1142-service-worker-freshness-health main`
- hosted GitHub checks after PR push

语义自检:

- 对照 FR-0038，确认只使用 `provider_doctor_report`、`extension_load`、status、severity、blocking、diagnostics 与 evidence refs。
- 对照 FR-0040 / FR-0041，确认 evidence freshness / artifact identity / redaction gap 只作为消费规则。
- 对照 FR-0043，确认只消费 `service_worker_readiness_ref`。
- 对照 #1140 / #1141 / #1139 / #1143 / #1144，确认没有抢占相邻 owner。

## TDD 范围

当前 PR 不进入实现代码 TDD。

后续实现应优先补:

- provider doctor parser 对 `official_chrome_persistent_service_worker_freshness` check 的 contract validation。
- stale / missing expected identity / missing observed identity / redaction invalid 的 fail-closed tests。
- evidence freshness stale 与 historical background 不可满足 current freshness 的 tests。
- secret / raw private path 不进入 diagnostics、stdout summary 或 PR metadata 的 tests。
- capability readiness 不把 service worker freshness 直接提升到 runtime/live attestation 的 tests。

## 并行 / 串行关系

可并行:

- 不触碰 FR-0047 suite 的 #1140 / #1141 / #1139 / #1143 / #1144 formal work。
- 不依赖 service worker freshness health 的纯文档或治理事项。

串行 / 依赖:

- 本 FR 依赖 FR-0038、FR-0040、FR-0041 与 FR-0043。
- doctor command / runtime admission implementation 必须等待本 FR spec review 通过。
- #1144 fixtures 若需要 service worker freshness sample，应等待本 FR 或消费 scheduler 明确冻结版本。

## 进入实现前条件

- FR-0047 spec review 通过。
- reviewer 确认 #1142 的 formal suite 没有定义新 health schema。
- reviewer 确认 stale / unknown / missing / redaction invalid 的 fail-closed 语义无歧义。
- reviewer 确认 evidence refs 与 redaction policy 只消费 FR-0040 / FR-0041。
- reviewer 确认本 suite 未抢占 #1140、#1141、#1139、#1143、#1144。
- 后续 implementation issue 明确 owner、target files、runtime admission boundary 与验证策略。
