# Structured Event Evidence

本文件定义 Loom v0.8 的 structured event evidence 边界。

Event evidence 是执行、工具、验证、失败和 host tracker 观察的证据面。它用于证明 orchestration 行为发生过、结果是什么、由哪个 fake 或 host adapter 观察到，但不得成为第二套 authored truth。

## 1. 边界

Event evidence 只允许表达：

- `item_id`
- `session_id`
- `attempt_id`
- `event_id`
- `event_type`
- `source`
- `subject`
- `result`
- `summary`
- `observed_at`
- `provenance`

Event evidence 不允许表达：

- `next_step`
- `blockers`
- `latest_validation_summary`
- `current_checkpoint`
- `recovery`
- `authored_truth`

这些字段属于 Work Item、recovery entry、review record 或 closeout basis。事件只能引用这些载体的位置，不能复制或改写它们。

## 2. Schema

最小 schema 固定为 `loom-event-evidence/v1`。

```json
{
  "schema_version": "loom-event-evidence/v1",
  "item_id": "WI-576",
  "session_id": "session-1",
  "attempt_id": "attempt-1",
  "event_id": "event-1",
  "event_type": "agent.step",
  "source": {
    "kind": "fake_agent",
    "locator": "loom_check.fixture.fake_agent"
  },
  "subject": {
    "kind": "attempt",
    "locator": ".loom/runtime/attempts/WI-576/latest.json"
  },
  "result": "pass",
  "summary": "fake agent completed the step",
  "observed_at": "fixture",
  "provenance": {
    "authority": "event_evidence",
    "truth_boundary": "evidence_only"
  }
}
```

`event_type` 当前允许：

- `agent.step`
- `agent.tool`
- `tracker.state`
- `validation.result`
- `failure.observed`

`result` 当前允许：

- `pass`
- `fail`
- `block`
- `warn`
- `unavailable`

## 3. Fake Orchestration Fixtures

Loom core fixtures must prove orchestration behavior without real model calls or real trackers.

Fake agent fixtures cover:

- success
- failure
- tool failure

Fake tracker fixtures cover fake tracker state reads:

- active
- closed
- drift

Fixture events are blocking only for `orchestration-core` contract validity. They do not assert that a real external tracker is available.

## 4. Consumption Rules

Consumers may use event evidence to:

- explain why a flow passed, failed, or blocked
- connect attempt evidence to tool/validation/failure observations
- prove fake orchestration behavior in `loom_check`
- expose host tracker state as evidence

Consumers must not use event evidence to:

- author `next_step`
- close an issue
- replace recovery progress
- bypass review, merge-ready, or closeout
- invent scheduler state

If event evidence is malformed, missing required fields, or carries forbidden authored truth fields, `loom_check` must fail closed.
