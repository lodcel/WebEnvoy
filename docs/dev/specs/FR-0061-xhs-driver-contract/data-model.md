# FR-0061 Data Model

## 核心对象

### `xhs_driver_contract`

WebEnvoy-local XHS driver 的 formal contract。它只冻结 output envelope、runtime binding、provider requirement 与 downstream slicing input，不表达实现代码、runtime status、Syvert normalized result 或 live evidence。

字段分组：

- `identity`：绑定 XHS platform、WebEnvoy driver namespace、contract version 与 canonical issue。
- `output_envelope`：包含 `raw`、`operational`、`evidence` 三个输出 section。
- `runtime_binding`：记录 target domain/page/tab、page-local namespace、provider ref 与 binding status。
- `provider_requirements`：声明 driver 执行所需 provider requirement，并引用 provider/capability/evidence owner。
- `downstream_slicing_inputs`：为后续 #1159/#1160/#1161/#1163/#1164/#1165 分片提供最小输入。

### `xhs_driver_output.raw`

XHS 页面/API/状态来源的原始或近原始 payload 引用。

允许表达：

- API response artifact ref。
- Page state 或 DOM state ref。
- Request template observation ref。
- source route、capture kind、freshness、redaction 与 parse status。

禁止表达：

- Syvert normalized result。
- Syvert resource taxonomy。
- Syvert error taxonomy。
- Cookie、token、account identifier、private path、credential-bearing header 或 full page content 原文。

### `xhs_driver_output.operational`

WebEnvoy driver-local 的运行信息。

允许表达：

- ability id。
- operation / run id。
- request shape ref。
- route bucket。
- runtime binding ref。
- provider requirement refs。
- status 和 driver-local error boundary。

禁止表达：

- Syvert product resource type。
- Syvert error code taxonomy。
- runtime ready / target tab ready / live evidence accepted 结论。
- write enablement 或 default live-write commit。

### `xhs_driver_output.evidence`

Driver output 的 provenance、artifact refs、redaction、freshness、provider/runtime evidence refs 与 non-proof conclusion。

允许表达：

- raw payload evidence ref。
- runtime binding evidence ref。
- provider evidence ref。
- route evidence ref。
- redaction summary。
- blocking reasons 与 next required gates。

禁止表达：

- 真实 live evidence gate pass。
- provider capability allow。
- browser/account/profile/live 操作结果。
- 未脱敏 secret、account 或 private locator。

## 生命周期

1. `contract_declared`
   - `FR-0061` suite 已存在，定义 output/binding/requirement/slicing 边界。
   - 不代表任何 XHS read implementation 已存在。
2. `slice_prepared`
   - 下游 issue 选择 `ability_scope` 和 `allowed_output_sections`。
   - 仍不得执行 browser/account/live 操作。
3. `implementation_attempted`
   - 后续实现 issue 消费本 contract。
   - 必须独立提供 parser、runtime、provider、evidence 与 tests。
4. `evidence_consumed`
   - consumer 使用 `evidence_refs` 与 provider/runtime owner 的结果。
   - 只有适用 gate 明确接受，才能提升 support state。

## 聚合规则

- `raw` required 但 missing / partial / redaction invalid：consumer blocked。
- `operational.runtime_binding_ref` required 但 missing / unknown / stale：consumer blocked。
- provider requirement 无 formal provider verification ref：consumer blocked。
- evidence ref stale、partial、unavailable 或 redaction invalid：consumer blocked，除非后续 formal exception 明确允许 degraded path。
- `non_proofs` 缺失任一 v1 mandatory item：contract invalid。
- forbidden Syvert / live-write / JSON-RPC 字段出现：contract invalid。

## Redaction 模型

允许进入 public summary：

- contract ref。
- canonical issue ref。
- ability id。
- route bucket。
- status。
- run id / operation id。
- redacted artifact identity。
- stable blocking reason。

禁止进入 public summary、PR body、spec sample 或 reusable fixture：

- raw Cookie。
- token / credential。
- account identifier。
- raw profile path。
- raw browser tab URL containing private state。
- private absolute path。
- full page content。
- credential-bearing request header。

## Consumer 边界

可消费：

- 后续 XHS read implementation planning。
- 后续 XHS driver adapter / evidence / provider readiness 分片。
- WebEnvoy-local review 和 PR metadata same-class audit。

不可消费为：

- Syvert normalized result。
- Syvert resource or error taxonomy。
- JSON-RPC method authorization。
- runtime ready。
- live evidence success。
- live-write enablement。
- provider capability support row。

## Omission rationale

本 suite 不定义数据库表、CLI stdout schema、JSON-RPC payload、Native Messaging schema 或 artifact writer。当前 scope 是 formal contract freeze；后续实现如需要持久化、stdout、RPC 或 fixture，必须在对应 issue 中消费本 data model，并按实现风险补 parser / contract / runtime tests。
