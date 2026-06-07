# Provider Health / Doctor Contract

## 1. `provider_doctor_report`

```ts
interface ProviderDoctorReport {
  identity: ProviderDoctorReportIdentity
  input_contract_ref: ProviderDoctorInputContractRef
  checks: ProviderDoctorCheck[]
  outcome: ProviderDoctorOutcome
}
```

约束：

- `provider_doctor_report` 是一次 provider health / doctor 评估结果，不是 provider registry row、runtime status、launch envelope 或 live evidence record。
- consumer 必须先校验 `doctor_contract_version`、provider identity、check category、status、blocking 与 capability references，再进入 provider admission 或 selection。
- required check 缺失、unknown、invalid enum 或脱敏违规时，必须 fail-closed。

## 2. Report identity

```ts
interface ProviderDoctorReportIdentity {
  doctor_report_id: string
  doctor_contract_version: "v1"
  provider_id: string
  provider_contract_version: "v1"
  provider_version: string
  generated_at: string
  scope: "static" | "local_runtime" | "attach_target" | "capability"
}
```

约束：

- `provider_id`、`provider_contract_version`、`provider_version` 必须与 `FR-0033.browser_provider_contract.provider_identity` 对齐。
- `generated_at` 是 report 生成时间，不是 runtime attestation 或 live evidence 采集时间。
- `scope=capability` 时，report 必须至少包含一个 `capability_readiness` check。

## 3. Input contract ref

```ts
interface ProviderDoctorInputContractRef {
  provider_contract_spec: "FR-0033-browser-provider-contract"
  provider_contract_digest?: string
  capability_ids_requested: string[]
}
```

约束：

- `capability_ids_requested` 可为空；为空时 doctor 只表达 provider-level health。
- 非空时，每个 id 必须匹配 `FR-0033.capabilities[*].capability_id`。
- `provider_contract_digest` 可用于后续实现绑定具体 contract artifact；本 FR 不要求生成 digest。

## 4. Check category and status

```ts
type ProviderDoctorCheckCategory =
  | "binary"
  | "version"
  | "extension_load"
  | "native_messaging"
  | "display_mode"
  | "profile_persistence"
  | "capability_readiness"

type ProviderDoctorCheckStatus =
  | "pass"
  | "warn"
  | "fail"
  | "not_applicable"
  | "unknown"

type ProviderDoctorSeverity =
  | "info"
  | "warning"
  | "error"
  | "fatal"

type ProviderDoctorBlocking =
  | "none"
  | "capability_blocking"
  | "provider_blocking"
```

约束：

- unknown category 或 unknown status 视为 report invalid。
- `status=unknown` 影响 requested provider/capability 时必须阻断。
- `severity=fatal` 必须阻断 provider。
- `status=fail` 必须阻断 provider 或 capability，除非该 check 明确只影响未请求 optional capability。

## 5. Doctor check

```ts
interface ProviderDoctorCheck {
  check_id: string
  category: ProviderDoctorCheckCategory
  status: ProviderDoctorCheckStatus
  severity: ProviderDoctorSeverity
  blocking: ProviderDoctorBlocking
  capability_id: string | "N/A"
  summary: string
  diagnostics: ProviderDoctorDiagnostics
  evidence_refs: ProviderDoctorEvidenceRef[]
}
```

约束：

- provider-level checks 使用 `capability_id="N/A"`。
- `category="capability_readiness"` 必须使用具体 capability id。
- `summary` 可以给人读，但 gate 和 selection 不得只解析 summary。
- `diagnostics` 与 `evidence_refs` 是机器判定输入。

## 6. Diagnostics

```ts
interface ProviderDoctorDiagnostics {
  code: string
  observed?: string
  expected?: string
  remediation_hint?: string
  required_runtime_requirements?: BrowserProviderRuntimeRequirement[]
  satisfied_runtime_requirements?: BrowserProviderRuntimeRequirement[]
  unsatisfied_runtime_requirements?: BrowserProviderRuntimeRequirement[]
  minimum_next_verification_level?: "runtime_attested" | "live_evidence_attested" | "not_applicable"
}
```

约束：

- `code` 必须稳定、机器可读，不得只写自然语言。
- `required_runtime_requirements` 等字段只在 `capability_readiness` 必需。
- `provider_doctor_passed` 只有在该 capability 的 required doctor checks 全部通过且无 provider / capability blocking 时，才能出现在 `satisfied_runtime_requirements` 中。
- `target_tab` 不得出现在 `satisfied_runtime_requirements` 中；doctor report 不能证明目标 tab 绑定、tab id 或页面上下文的新鲜 runtime evidence，声明该 requirement 时必须保留在 `unsatisfied_runtime_requirements` 并交给 `runtime_attestation` gate。
- `runtime_bootstrap_ready` 不得出现在 `satisfied_runtime_requirements` 中；`runtime_attested` 与 `live_evidence_attested` 是 verification level，不是 runtime requirement，也不得写入 runtime requirement arrays。
- 若 `unsatisfied_runtime_requirements` 非空，check 不得为 `status=pass`。

## 7. Evidence refs

```ts
type ProviderDoctorEvidenceKind =
  | "local_file_ref"
  | "command_output_ref"
  | "extension_state_ref"
  | "native_manifest_ref"
  | "profile_state_ref"
  | "doctor_artifact_ref"

type ProviderDoctorEvidenceStatus =
  | "available"
  | "partial"
  | "unavailable"
  | "not_applicable"

type ProviderDoctorEvidenceSensitivity =
  | "public"
  | "internal"
  | "sensitive"
  | "secret"

interface ProviderDoctorEvidenceRef {
  kind: ProviderDoctorEvidenceKind
  ref: string
  status: ProviderDoctorEvidenceStatus
  collected_at: string
  sensitivity: ProviderDoctorEvidenceSensitivity
}
```

约束：

- `ref` 必须是 artifact locator、redacted path、diagnostic id 或 report-local locator，不得包含 cookie、token、secret 或完整敏感 manifest 原文。
- required check 的唯一 evidence 为 `unavailable` 或 `partial` 时，该 check 不得为 `pass`。
- `sensitivity=secret` 的 evidence 只能以 redacted locator 表达，不得进入 stdout summary 或 PR body。

## 8. Outcome

```ts
interface ProviderDoctorOutcome {
  overall_status: "pass" | "warn" | "fail" | "unknown"
  provider_blocked: boolean
  blocked_capabilities: string[]
  doctor_verification_level: "declared_only" | "static_checked" | "doctor_checked"
  next_required_gates: Array<"runtime_attestation" | "live_evidence" | "provider_selection" | "manual_review">
}
```

约束：

- `doctor_verification_level` 不得高于 `doctor_checked`。
- `provider_blocked=true` 时，后续业务 selection 不得选择该 provider。
- `blocked_capabilities` 内每个 id 必须匹配 `capability_ids_requested` 或 provider contract capability。
- `next_required_gates` 只表达后续仍需通过的 gate，不表达 gate 已通过。

## 9. Required check mapping

| FR-0033 declaration | Required doctor category |
|---|---|
| provider executable / launcher entry / adapter binary from `provider_identity` | `binary` |
| `browser_version_range` | `version` |
| `extension_binding_support=required` | `extension_load` |
| capability requirement `extension_binding` | `extension_load` |
| `native_messaging_support=required` | `native_messaging` |
| capability requirement `native_messaging` | `native_messaging` |
| `headless_policy=forbidden` | `display_mode` |
| capability requirement `headless_forbidden` or `real_browser` | `display_mode` |
| `profile_binding_support=required` | `profile_persistence` |
| capability requirement `profile_binding` | `profile_persistence` |
| requested capability id | `capability_readiness` |

Required check 缺失时，受影响 provider 或 capability 必须 fail-closed。

## 10. 最小合法示例

```json
{
  "identity": {
    "doctor_report_id": "doctor-20260607-001",
    "doctor_contract_version": "v1",
    "provider_id": "official-chrome-stable",
    "provider_contract_version": "v1",
    "provider_version": "v1",
    "generated_at": "2026-06-07T00:00:00Z",
    "scope": "capability"
  },
  "input_contract_ref": {
    "provider_contract_spec": "FR-0033-browser-provider-contract",
    "capability_ids_requested": ["runtime-page-automation"]
  },
  "checks": [
    {
      "check_id": "provider-binary",
      "category": "binary",
      "status": "pass",
      "severity": "info",
      "blocking": "none",
      "capability_id": "N/A",
      "summary": "Provider executable or launcher entry is accessible.",
      "diagnostics": {
        "code": "provider_binary_ok",
        "observed": "accessible_redacted_locator",
        "expected": "accessible_executable_or_launcher"
      },
      "evidence_refs": [
        {
          "kind": "local_file_ref",
          "ref": "doctor://doctor-20260607-001/provider-binary",
          "status": "available",
          "collected_at": "2026-06-07T00:00:00Z",
          "sensitivity": "sensitive"
        }
      ]
    },
    {
      "check_id": "browser-version",
      "category": "version",
      "status": "pass",
      "severity": "info",
      "blocking": "none",
      "capability_id": "N/A",
      "summary": "Browser version satisfies declared range.",
      "diagnostics": {
        "code": "browser_version_ok",
        "observed": "Google Chrome stable 137",
        "expected": ">=137"
      },
      "evidence_refs": [
        {
          "kind": "command_output_ref",
          "ref": "doctor://doctor-20260607-001/browser-version",
          "status": "available",
          "collected_at": "2026-06-07T00:00:00Z",
          "sensitivity": "internal"
        }
      ]
    },
    {
      "check_id": "extension-load",
      "category": "extension_load",
      "status": "pass",
      "severity": "info",
      "blocking": "none",
      "capability_id": "N/A",
      "summary": "Required extension binding is present.",
      "diagnostics": {
        "code": "extension_binding_ok",
        "observed": "bound",
        "expected": "required"
      },
      "evidence_refs": [
        {
          "kind": "extension_state_ref",
          "ref": "doctor://doctor-20260607-001/extension-load",
          "status": "available",
          "collected_at": "2026-06-07T00:00:00Z",
          "sensitivity": "internal"
        }
      ]
    },
    {
      "check_id": "native-messaging",
      "category": "native_messaging",
      "status": "pass",
      "severity": "info",
      "blocking": "none",
      "capability_id": "N/A",
      "summary": "Required Native Messaging manifest and origin binding are present.",
      "diagnostics": {
        "code": "native_messaging_binding_ok",
        "observed": "manifest_and_origin_bound",
        "expected": "required"
      },
      "evidence_refs": [
        {
          "kind": "native_manifest_ref",
          "ref": "doctor://doctor-20260607-001/native-messaging",
          "status": "available",
          "collected_at": "2026-06-07T00:00:00Z",
          "sensitivity": "sensitive"
        }
      ]
    },
    {
      "check_id": "display-mode",
      "category": "display_mode",
      "status": "pass",
      "severity": "info",
      "blocking": "none",
      "capability_id": "N/A",
      "summary": "Display mode satisfies headed requirement.",
      "diagnostics": {
        "code": "display_mode_ok",
        "observed": "headed",
        "expected": "not_headless"
      },
      "evidence_refs": [
        {
          "kind": "doctor_artifact_ref",
          "ref": "doctor://doctor-20260607-001/display-mode",
          "status": "available",
          "collected_at": "2026-06-07T00:00:00Z",
          "sensitivity": "internal"
        }
      ]
    },
    {
      "check_id": "profile-persistence",
      "category": "profile_persistence",
      "status": "pass",
      "severity": "info",
      "blocking": "none",
      "capability_id": "N/A",
      "summary": "Required profile binding and persistence are present.",
      "diagnostics": {
        "code": "profile_persistence_ok",
        "observed": "persistent_profile_bound",
        "expected": "required"
      },
      "evidence_refs": [
        {
          "kind": "profile_state_ref",
          "ref": "doctor://doctor-20260607-001/profile-persistence",
          "status": "available",
          "collected_at": "2026-06-07T00:00:00Z",
          "sensitivity": "sensitive"
        }
      ]
    },
    {
      "check_id": "runtime-page-automation-readiness",
      "category": "capability_readiness",
      "status": "warn",
      "severity": "warning",
      "blocking": "none",
      "capability_id": "runtime-page-automation",
      "summary": "Doctor checks passed; runtime attestation is still required.",
      "diagnostics": {
        "code": "runtime_attestation_required",
        "required_runtime_requirements": ["profile_binding", "extension_binding", "native_messaging", "target_tab", "real_browser", "headless_forbidden", "provider_doctor_passed", "runtime_bootstrap_ready"],
        "satisfied_runtime_requirements": ["profile_binding", "extension_binding", "native_messaging", "real_browser", "headless_forbidden", "provider_doctor_passed"],
        "unsatisfied_runtime_requirements": ["target_tab", "runtime_bootstrap_ready"],
        "minimum_next_verification_level": "runtime_attested"
      },
      "evidence_refs": []
    }
  ],
  "outcome": {
    "overall_status": "warn",
    "provider_blocked": false,
    "blocked_capabilities": [],
    "doctor_verification_level": "doctor_checked",
    "next_required_gates": ["runtime_attestation", "provider_selection"]
  }
}
```
