# FR-0063 Data Model

## 核心对象

### `target_binding_state_machine`

WebEnvoy-local XHS target binding lifecycle contract。它只冻结状态、状态转移、snapshot、transition evidence 与 downstream handoff，不表达实现代码、runtime status、page ready、signed continuity、Syvert normalized result 或 live evidence。

字段分组：

- `identity`：绑定 XHS platform、contract version、owner ref 与 consumed FR-0061 contract。
- `state`：九个冻结状态之一。
- `observation_inputs`：target candidate、URL、DOM、runtime state、extension bridge、provider runtime、run/operation identity 与 freshness。
- `transition_evidence`：每次状态推进、stale、lost 或 reset 的 evidence ref。
- `target_binding_snapshot`：下游 #1162/#1171 可消费的当前状态视图。

### `target_binding_snapshot`

当前 candidate 的 target binding 状态输出。

允许表达：

- 当前 state。
- redacted target candidate ref。
- target scope / route bucket。
- run_id / operation_id。
- candidate / URL / DOM / runtime state / extension bridge evidence refs。
- blocking reasons。
- non-proof list。
- downstream handoff owners。

禁止表达：

- page ready 或 runtime ready pass。
- signed continuity accepted。
- read success。
- live evidence accepted。
- provider capability allowed。
- write enablement 或 default `live_write_commit`。
- Syvert normalized result 或 taxonomy。

### `target_binding_transition_evidence`

状态转移的可追溯 evidence ref。

允许表达：

- from/to state。
- transition reason。
- observed timestamp 或 formal sample 中的 `N/A`。
- redacted candidate ref。
- evidence refs 与 freshness。
- source owner。

禁止表达：

- 未脱敏 browser/profile/account locator。
- raw private URL、Cookie、token、credential-bearing header 或 full page content。
- downstream owner 尚未判定的 pass 结论。

## 生命周期

1. `state_machine_declared`
   - `FR-0063` suite 已冻结状态、转移和 consumer boundary。
   - 不代表任何 resolver 或 runtime implementation 已存在。
2. `candidate_observed`
   - 后续实现发现 redacted target candidate。
   - 只能进入 `candidate_found` 或 fail closed。
3. `binding_converged`
   - candidate、URL、DOM、runtime state 和 extension bridge evidence 在 current-run freshness 内一致。
   - 只能表达 `bound` target binding，不表达 #1162/#1171 pass。
4. `binding_invalidated`
   - 导航、freshness 过期、source owner mismatch、identity conflict 或 candidate lost。
   - 必须进入 `stale` 或 `lost`；后续必须先 reset 到 `unbound`，再重新 discovery。
5. `downstream_consumed`
   - #1162/#1171 或 read implementation owner 消费 snapshot / transition evidence。
   - 只有对应 owner 明确接受，才能提升 page/runtime ready、signed continuity 或 read support state。

## 聚合规则

- `state=bound` required 但任一 required evidence missing / partial / stale / redaction invalid：consumer blocked。
- `state=dom_ready` required by page ready consumer：consumer blocked or diagnostic only，等待 #1162。
- `state=runtime_state_detected` required by runtime ready consumer：consumer blocked or diagnostic only，等待 #1162。
- `state=extension_bridge_confirmed` required by target binding consumer：consumer blocked unless downstream owner explicitly accepts diagnostic handoff。
- `state=stale|lost`：consumer blocked，必须先 reset 到 `unbound`，再重新 discovery。
- `blocking_reasons` 非空时：consumer 只能 `blocked` / `deny` / `defer`。
- forbidden Syvert / live-write / JSON-RPC / ready-proof 字段出现：contract invalid。

## Redaction 模型

允许进入 public summary：

- contract ref。
- canonical issue ref。
- state。
- route bucket。
- run id / operation id。
- redacted candidate ref。
- redacted artifact identity。
- stable blocking reason。

禁止进入 public summary、PR body、spec sample 或 reusable fixture：

- raw Cookie。
- token / credential。
- account identifier。
- raw browser profile path。
- raw tab URL containing private state。
- private absolute path。
- credential-bearing request header。
- full page content。
- secret-bearing artifact payload。

## Consumer 边界

可消费：

- #1162 Page Ready / Runtime Ready Contract。
- #1171 Signed Continuity Binding。
- 后续 XHS read implementation planning。
- WebEnvoy-local review 和 PR metadata same-class audit。

不可消费为：

- Page ready pass。
- Runtime ready pass。
- Signed continuity accepted。
- Read success。
- Provider capability support row。
- Live evidence success。
- Live-write enablement。
- Syvert normalized result。
- Syvert resource or error taxonomy。

## Omission rationale

本 suite 不定义数据库表、CLI stdout schema、JSON-RPC payload、Native Messaging schema、content-script probe、signature algorithm 或 artifact writer。当前 scope 是 formal contract freeze；后续实现如需要持久化、stdout、RPC、runtime probe 或 fixture，必须在对应 issue 中消费本 data model，并按实现风险补 parser / contract / runtime tests。
