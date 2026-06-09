# FR-0060 Data Model

## 核心对象

### `cloakbrowser_docker_xvfb_doctor`

一次 Docker / Xvfb environment admission doctor 的 provider-specific record。

字段分组：

- `identity`：绑定 provider variant、run、environment kind、FR-0038 doctor report ref 与 artifact identity。
- `environment_inputs`：记录 container、binary、X server、DISPLAY、launch mode、font catalog 与 diagnostic command 的 redacted refs。
- `checks`：记录 binary、X server、DISPLAY、headed/headless policy、font readiness 与 diagnostic output 的机器可读结果。
- `outcome`：聚合 environment/provider blocker、admission verification level 与后续 gate。

## 生命周期

1. `declared_only`
   - 只有 descriptor / issue / admission input。
   - 不足以判断 Docker / Xvfb readiness。
2. `environment_checked`
   - 至少完成部分 environment probes。
   - 可能仍有 unknown、warn 或 blocker。
3. `docker_xvfb_doctor_checked`
   - Required Docker / Xvfb admission checks 均为 `pass|not_applicable`，且 diagnostic output 可消费、已脱敏。
   - 仍必须进入后续 `runtime_attestation`、`launch_evidence`、`target_tab_binding`、`live_evidence` 或 `capability_matrix` gate。

## Check 聚合规则

- provider-level binary fail / unknown：`provider_blocked=true`。
- X server / DISPLAY fail / unknown：`environment_blocked=true`。
- headless-only 与 CloakBrowser `headless_policy=forbidden` 冲突：`provider_blocked=true`。
- diagnostic artifact redaction invalid：受影响 required check 不能 pass。
- font readiness unknown：
  - diagnostic-only scope 可为 `warn`。
  - required headed rendering scope 必须 fail-closed。

## Redaction 模型

允许进入 public summary：

- check category
- status / severity / blocking
- redacted locator
- artifact identity
- stable diagnostic code
- high-level remediation hint

禁止进入 public summary、PR body、spec sample 或 reusable fixture：

- raw environment dump
- raw absolute host path
- registry credential
- license token
- account identifier
- cookie / token / proxy credential
- provider private patch payload
- raw font file inventory with sensitive host paths

## Consumer 边界

可消费：

- FR-0038 doctor report 的 provider-specific diagnostics。
- 后续 environment admission gate。
- 后续 capability matrix 的 environment prerequisite input。
- 后续 evidence owner 的 diagnostic artifact references。

不可消费为：

- provider capability support row。
- runtime ready。
- browser launched。
- target tab ready。
- live evidence success。
- anti-detection pass。
- account safety pass。

## Omission rationale

本 suite 不定义数据库表、CLI payload 或 implementation event stream。当前 scope 是 formal contract freeze；若后续 implementation 需要持久化或 stdout schema，必须在对应实现 issue 中消费本 data model，并按实现 blast radius 补 parser / storage tests。
