# FR-0061 Risks

## 风险 1：把 WebEnvoy raw output 误作 Syvert normalized result

- 影响：Syvert consumer 可能跳过自己的 normalization、resource mapping 与 error mapping，导致 product result ownership 混乱。
- 缓解：spec 和 contract 明确禁止 `normalized` 顶层 section，`raw` 不等于 Syvert normalized result。
- 回滚：如后续 consumer 误用，回滚 consumer 逻辑；本 FR 的 Syvert boundary 不放宽。

## 风险 2：runtime binding 被误报为 runtime / target tab ready

- 影响：read implementation、closeout 或 PR metadata 可能提前声明 browser runtime 成功。
- 缓解：`runtime_binding` 只表达 locator、expected page class 与 refs；runtime readiness 必须由 runtime owner evidence 证明。
- 回滚：撤回错误 evidence claim 或 PR metadata，重新收集适用 runtime evidence。

## 风险 3：provider requirement 被 XHS driver 自证

- 影响：provider capability gate 可能被绕过，declared-only provider 被用于业务 read。
- 缓解：provider requirements 必须消费 `FR-0033` / `FR-0035` / `FR-0040` / `FR-0041`；XHS driver 不拥有 provider verification policy。
- 回滚：修正 downstream provider selection / capability verification consumer。

## 风险 4：formal spec PR 混入 read implementation 或 live action

- 影响：spec review 与 implementation review 混杂，可能绕过 browser/account/live 门禁。
- 缓解：本 PR 只允许写 `FR-0061` suite 与单条 sync-map；不触碰 runtime/source/tests/fixtures/scripts/workflows。
- 回滚：拆分超范围改动到独立 implementation issue / PR。

## 风险 5：live-write 或 JSON-RPC scope creep

- 影响：#1174+ live-write lane 或 RPC surface 被提前授权，改变外部可见行为和风险面。
- 缓解：contract forbidden fields 包含 `live_write_commit`、`publish_result`、`jsonrpc_method`；出现即阻断。
- 回滚：移除超范围字段，按对应 live-write 或 RPC issue 重新走 formal spec review。

## 风险 6：evidence / raw payload 泄露账号或私有数据

- 影响：PR body、artifact 或 stdout summary 可能泄露 Cookie、token、account identifier、profile path、private path 或 full page content。
- 缓解：raw payload 与 evidence refs 只能使用 redacted locator、artifact ref、checksum 或 opaque handle；redaction invalid 必须 fail closed。
- 回滚：删除/替换泄露 artifact，必要时执行 secret rotation；后续实现必须补 redaction guard。

## 风险 7：downstream slicing 把 #1158 当成 implementation-ready

- 影响：#1159/#1160/#1161/#1163/#1164/#1165 可能未完成各自 spec/validation 就开始实现。
- 缓解：`downstream_slicing_inputs` 只提供分片输入，不表达 implementation-ready；plan/TODO 明确后续 slice 必须独立消费。
- 回滚：恢复下游 issue/PR 的正确依赖和 closing semantics。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0061-xhs-driver-contract/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1158 的映射。由于本 PR 不实现 runtime 行为，不需要 profile cleanup、browser cleanup、secret rotation、database migration、artifact cleanup 或 external rollback。
