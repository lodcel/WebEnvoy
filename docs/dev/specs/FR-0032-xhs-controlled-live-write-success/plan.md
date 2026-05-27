# FR-0032 实施计划

## 实施目标

冻结并后续实现 XHS creator 受控 live upload / submit / publish 成功闭环。首个 PR 只落 formal spec suite，不执行真实写入；后续实现必须在 spec review 通过后按 #845/#846/#847 分阶段推进。

## 分阶段拆分

### 阶段 1：#842-A spec scaffold

- 产出：`spec.md`、`plan.md`、`TODO.md`。
- 重点：冻结 owner、scope、success bar、执行阶梯、非目标，以及不把 spec draft / dry-run / #779 GO 等同于 live write success。

### 阶段 2：#842-B GO validity snapshot

- 产出：`spec.md`、`research.md` 中的 GO baseline 固化。
- 重点：消费 #779/#834/#837/#838 的 latest-main GO/readmission/validation row evidence，并写清过期后的重跑要求。

### 阶段 3：#843-A evidence contracts

- 产出：`contracts/live-write-evidence.md`、`contracts/published-result-identity.md`、`contracts/cleanup-rollback-proof.md`、`contracts/live-write-stop-signal.md`。
- 重点：让 closeout evidence 不依赖自由文本，后续可由 evaluator 和 adapter 消费。

### 阶段 4：#843-B data model

- 产出：`data-model.md`。
- 重点：冻结 `live_write_attempt`、`upload_artifact_identity`、`publish_result_identity`、`cleanup_result`、`risk_signal`、`residual_record` 的字段、约束、生命周期。

### 阶段 5：#843-C risks / research

- 产出：`risks.md`、`research.md`。
- 重点：冻结账号安全、真实写入、公开发布、不可逆动作、cleanup failure、残留记录、stop policy、XHS creator 状态机和 cleanup/rollback 可行性。

### 阶段 6：#844 spec review

- 产出：Draft PR / review / guardian / merge-ready closeout。
- 重点：证明 FR-0032 suite 齐备、边界清晰、未夹带 runtime 实现、未执行 live write。

### 阶段 7：#845/#846/#847 implementation and live closeout

- 产出：后续实现 PR 与 latest-main controlled live evidence。
- 重点：#845 先做 controlled upload path non-publish validation；#846 做 submit/publish gate、state machine、evidence evaluator；#847 在 latest main/head 执行完整 controlled live upload -> submit -> publish closeout。

## 实现约束

- 本 suite PR 只能修改 `docs/dev/specs/FR-0032-xhs-controlled-live-write-success/`，以及为 `spec-guard` 绑定 canonical issue 所必需的 `.github/spec-issue-sync-map.yml` 映射项。
- 不实现 runtime 能力，不改 CLI、extension、adapter、Syvert 或 CloakBrowser provider 边界。
- 不执行真实 upload、submit、publish、file picker、DataTransfer、editor text write 或账号写入动作。
- 不把 #779 GO、dry-run、recon、non-write readiness、upload-only success 或 DOM/state extraction 写成 full live write success。
- 后续实现必须保持 browser-in-process HTTP 出口原则，不引入外部异构爬虫或外部签名服务作为核心运行时。
- 任何真实 live write 必须等 #844 spec review 通过、#845/#846 实现验证完成，并在 #847 latest-main/head fresh GO 后才允许。

## 测试与验证策略

规约阶段验证：

- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `git diff --check`
- 必要的 markdown/link/static validation
- GitHub issue comments for #842/#843/#835
- Project / issue status consistency check

后续实现阶段验证：

- static tests
- `runtime.status`
- `runtime.audit`
- `runtime.closeout_gate`
- `xhs.creator_publish.admit` dry-run
- creator validation row query
- recon / target confirmation
- route evidence evaluator
- controlled upload
- controlled submit
- controlled publish
- cleanup/rollback proof
- residual/risk closeout

## TDD 范围

- 本规约 PR 不改运行时代码，因此不新增 runtime tests。
- #845 必须先补 upload path contract/evaluator tests：
  - entry gate missing -> `NO_GO`
  - upload artifact identity missing -> upload not successful
  - upload accepted but submit not run -> not full success
  - account safety signal after upload -> stop and cleanup/residual policy
- #846 必须先补 submit/publish/evaluator tests：
  - publish success without result identity -> `published_identity_missing`
  - cleanup failed -> residual record required
  - high-risk signal -> later write actions blocked
  - full upload/submit/publish/evidence/cleanup path -> success candidate
- #847 必须只在 latest-main fresh GO 后执行 controlled live closeout，并保留 artifact identity。

## 并行 / 串行关系

串行：

- #842 必须先于 #843 的 contracts/data-model/risks/research closeout。
- #842 与 #843 必须先于 #844 spec review。
- #844 spec review 必须先于 #845/#846 implementation。
- #845/#846 必须先于 #847 latest-main controlled live closeout。
- #847 必须先于 #835 full closeout。

可并行：

- #843-A evidence contracts 可与 #843-B data model 并行起草，但 review 时必须互相一致。
- #843-C risks/research 可与 contracts/data model 同步补齐。
- #845 upload path 和 #846 state/evaluator 设计可并行准备，但实现不能绕过 #844。

## 进入实现前条件

- #844 spec review 通过并合入 main，或 review 明确允许后续实现分支按冻结输入推进。
- reviewer 确认 publish visibility scope 与 cleanup failure policy 已冻结。
- reviewer 确认 required contracts/data-model/risks/research 齐备。
- latest-head creator write admission 仍为 `GO`；若 GO snapshot 过期，重新执行 `runtime.status`、`runtime.audit`、`runtime.closeout_gate`、`xhs.creator_publish.admit` dry-run 和 validation row query。
- account safety 为 `clear`。
- runtime target binding 指向 current managed creator publish tab。
- implementation PR 明确不扩大到 adapter extraction、Syvert integration 或 CloakBrowser provider。
