# Complex Existing Authority Migration Playbook

本文定义成熟既有仓库从 attach-only 迁移到 Loom-governed execution 的阶段化 playbook。

目标不是把下游仓库的产品规则、guardian 脚本或 live evidence 语义复制进 Loom core，而是让 Loom 稳定接管通用执行与 verdict authority，同时让 adopted repo 继续持有 repo-specific rules、FR、live evidence、integration、CI 与 GitHub Issues/Projects。

## 1. 稳定不变量

每个阶段必须同时声明：

- `authority_before`
- `authority_after`
- rollback path
- validation entry
- no-dual-authority invariant

放行路径上不得让 Loom verdict 与 host verdict 同时作为独立 merge blocker。缺失、过期、schema drift、target mismatch、head mismatch 或 tracked file mutation 必须 fail closed。

## 2. Phase Sequence

| Phase | Authority before | Authority after | Validation | Rollback |
| --- | --- | --- | --- | --- |
| `phase-1` attach runtime | repo-native rules and host gates | repo-native rules and host gates; Loom only reads attach metadata | `loom-init verify` and repo-local runtime smoke | remove Loom attach metadata and keep host gates unchanged |
| `phase-1.1` repo-local skills baseline | host launcher and repo-native scripts | repo-local Loom launcher available; host still owns verdicts | repo-local `.loom/bin` verify and skills runtime parity | return to host scripts |
| `phase-2` review engine replacement | host semantic review execution | Loom review engine executes; host guardian remains compatibility blocker | adopted review engine adapter record with app-proof/fallback/fail-closed evidence | switch guardian back to host execution |
| `phase-3` implementation review authority | host implementation review verdict | Loom review record is the only implementation review verdict authority | `loom-review` record current-head allow and dual-authority negative fixture | mark Loom review advisory and restore host verdict as blocker |
| `phase-4` spec review authority | host or repo-native spec verdict | Loom spec review record is the only spec verdict authority | spec record binds PR/head/base/spec locator/reviewed scope | restore host spec gate as blocker |
| `phase-5` merge-ready authority | host merge readiness aggregation | Loom merge-ready result is the only merge-ready verdict authority | retained host signals consumed as inputs and controlled merge consumes Loom allow result | return wrapper to host aggregation |
| `phase-6` handoff/resume migration | repo-native recovery entry or GitHub issue notes | Loom handoff/resume orchestrates recovery; GitHub Issues/Projects remain progress truth | `loom-resume` / `loom-handoff` consume the same fact chain and ledger | use repo-native recovery entry |
| `phase-7` duplicate host cleanup | host duplicate mechanisms mirror Loom decisions | duplicate host mechanisms are adapter, renderer, or rollback-only | no retained host result is still an independent blocker | re-enable the last host blocker and mark Loom authority advisory |

## 3. Contract Landing

- Review engine adapter outputs `loom-adopted-review-engine-adapter/v1`.
- Implementation review migration outputs `loom-review-authority-migration/v1`.
- Spec review migration outputs `loom-spec-review-authority-migration/v1`.
- Retained host signals use `loom-retained-host-signal/v1` and remain repo-owned input evidence.
- Controlled merge wrappers consume `loom-controlled-merge-consumption/v1` and remain host-action adapters.

## 4. WebEnvoy-Style Validation

The synthetic validation fixture lives at `the upstream complex-existing-authority migration fixture`.

It covers the reusable WebEnvoy-style cases without promoting WebEnvoy product rules into Loom core:

- Codex App proof path, headless fallback, and tracked file mutation fail-closed.
- Current-head review/spec approval, stale head rejection, spec locator mismatch, and dual authority rejection.
- Retained host signal allow, stale head, schema drift, and head mismatch.
- Controlled merge clean consumption, missing allow result, and required checks drift.
