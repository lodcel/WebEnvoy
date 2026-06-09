# FR-0049 实施计划

## 实施目标

把 `#1146 cloakbrowser.direct Descriptor` 冻结成一个窄 formal suite：只定义 `cloakbrowser.direct` direct-launch descriptor facts，覆盖 direct CloakBrowser launch capability、extension path handling、final args evidence limits、provider contract references 和 limitation boundary，供 #1149 capability matrix 后续消费。

本 PR 是 formal spec review carrier：合入后冻结 `cloakbrowser.direct` direct descriptor formal suite，并为 #1149 capability matrix 提供输入；它不自动关闭 #1146。persistent descriptor、cloakserve descriptor、capability matrix、health schema、launch evidence、fixtures 与 runtime implementation 由后续 issue 承接。

## 分阶段拆分

### 阶段 1：direct descriptor shape 冻结

- 产出：`spec.md`、`contracts/cloakbrowser-direct-descriptor.md`
- 重点：冻结 identity、mode、engine、transport、profile semantics、extension path handling、final args evidence limits、fingerprint seed boundary、capability refs、limitation refs、evidence slots。

### 阶段 2：direct variant data model 落成

- 产出：`data-model.md`
- 重点：固定 extension path locator、redacted final args evidence、provider-managed fingerprint seed boundary 与 #1149 可消费 facts。

### 阶段 3：后续 owner 与禁止范围收口

- 产出：`risks.md`、`TODO.md`
- 重点：确认 #1147、#1148、#1149、health、launch evidence、fresh live evidence、fixtures、runtime implementation、CloakBrowser-as-core、Syvert 与 XHS semantics 全部保持 out of scope。

### 阶段 4：PR 与验证准备

- 产出：parser-friendly PR body、验证记录、纯度预检结果
- 重点：确保 PR 只包含 FR-0049 suite；若 scheduler 授权同步映射，再补 `.github/spec-issue-sync-map.yml` 中 #1146 对应映射。

## 实现约束

- 不修改 runtime、extension、native host、Playwright、provider selection、doctor、CLI、fixtures 或测试代码。
- 不定义 `cloakbrowser.persistent` 的 persistent profile、extension identity、native messaging readiness、profile lock 或 account safety delta。
- 不定义 `cloakbrowser.cloakserve` 的 service / broker / remote attach / health delta。
- 不定义 capability matrix semantics，不声明 direct variant 的 action/layer support matrix。
- 不定义 health result schema，不替代 `FR-0038`。
- 不定义 launch evidence record、fresh live evidence、runtime attestation 或 fixture payload。
- 不把 CloakBrowser 设为 WebEnvoy core、默认 provider、browser patching 主路径、Syvert provider adapter 或 XHS semantics owner。
- 不修改 `FR-0033`、`FR-0036`、`FR-0037` 已冻结基础契约。

## 测试与验证策略

文档/规约静态检查：

- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh resolve docs/dev/specs/FR-0049-cloakbrowser-direct-descriptor/spec.md`

PR 纯度检查：

- `bash scripts/check-pr-purity.sh docs/1146-cloakbrowser-direct-descriptor main`

diff 检查：

- `git diff --check origin/main...HEAD`
- `git diff --stat origin/main...HEAD`
- `git diff --name-only origin/main...HEAD`

语义自检：

- 对照 issue #1146 和 parent #1114，确认只覆盖 `cloakbrowser.direct` descriptor。
- 对照 FR-0033 / FR-0036 / FR-0037，确认本 suite 只消费基础 provider contract、registry shape 与 launch envelope extension path / evidence fields。
- 对照 #1147 / #1148 / #1149，确认没有抢占 persistent、cloakserve 或 capability matrix ownership。
- 对照 scope 禁止项，确认没有 runtime、fixtures、health、launch evidence、fresh live evidence、Syvert、XHS 或 provider private patch schema。

## TDD 范围

当前只冻结 formal descriptor contract，不进入实现代码 TDD。

后续 implementation、parser 或 fixture issue 应优先补以下测试：

- descriptor parser 接受 `descriptor_id=cloakbrowser.direct` 且要求 `common_shape_owner=#1146`。
- descriptor parser 拒绝 direct descriptor 中出现 persistent-only profile lock、native messaging readiness 或 cloakserve broker fields。
- launch admission parser 只接受 `FR-0037.launch_envelope.runtime_bindings.extension_paths` 中的 redacted extension locators。
- evidence parser 拒绝 final args snapshot 中的 full local path、secret、fingerprint seed value 或 private patch payload。
- registry consumer 不把 descriptor 存在误判为 runtime ready、default eligible 或 live evidence attested。
- capability matrix consumer 只能读取 descriptor facts，不从 descriptor 推断 supported actions。

## 并行 / 串行关系

可并行：

- #1147 `cloakbrowser.persistent` descriptor 可并行推进，但不得修改 FR-0049 direct descriptor facts。
- #1148 `cloakbrowser.cloakserve` descriptor 可并行推进，但不得把 service / broker delta 写入 FR-0049。
- 不触碰 FR-0049 suite 的普通本仓库文档整理。

串行 / 依赖：

- 本 work item 依赖 closed `FR-0033` / Browser Provider Contract、`FR-0036` / Provider Registry、`FR-0037` / Launch Envelope。
- #1149 必须等待 #1146/#1147/#1148 descriptor inputs 稳定后消费 matrix 输入。
- health / evidence / fixture owners 必须消费 descriptor 与 #1149，不得从 FR-0049 推导 runtime readiness。

## 进入实现前条件

- FR-0049 spec review 通过。
- reviewer 确认 #1146 的关闭语义是 direct descriptor facts complete，不是 runtime behavior complete。
- reviewer 确认 `cloakbrowser.direct` 不承诺 persistent profile、native messaging、login state reuse、runtime readiness 或 fresh live evidence。
- reviewer 确认 extension path handling 只使用 Launch Envelope locator，final args evidence 只允许 redacted future slot。
- reviewer 确认 #1147/#1148/#1149 与 health/evidence/fixture owner 边界清楚。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0049-cloakbrowser-direct-descriptor/**`，并在已获授权且已修改同步映射时移除 `.github/spec-issue-sync-map.yml` 中 #1146 的映射项。由于本 PR不实现 runtime 行为，不需要数据迁移、profile 清理、extension uninstall、secret rotation 或 external runtime rollback。
