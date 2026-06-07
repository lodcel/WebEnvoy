# FR-0034 Contract: Command Envelope v2

## Ownership

This contract defines the future WebEnvoy Command Envelope v2 shape for CLI command outputs.

It is a WebEnvoy-local command result contract. It is adapter-consumable in shape, but it does not define Syvert normalized result, provider adapter payloads, live evidence gate metadata, or cross-repository shared output.

Canonical Issue: #1131

## CommandEnvelopeV2

```ts
type CommandEnvelopeV2 = {
  ok: boolean;
  command: string;
  run_id: string;
  data: Record<string, unknown>;
  operational: OperationalV2;
  evidence: EvidenceRefV2[];
  warnings: WarningV2[];
  errors: ErrorV2[];
};
```

Top-level constraints:

- `ok=true` requires `errors.length === 0`.
- `ok=false` requires `errors.length >= 1`.
- `command` and `run_id` inherit FR-0001 command context semantics.
- `data`, `operational`, `evidence`, `warnings` and `errors` must always be present.
- Arrays must be present even when empty.
- Objects must be present even when empty.

## OperationalV2

```ts
type OperationalV2 = {
  compat?: CompatV2;
  observability?: Record<string, unknown>;
  diagnosis?: DiagnosisIndexV2;
  timestamps: {
    started_at?: string;
    completed_at: string;
  };
  limits?: LimitDisclosureV2[];
  runtime?: {
    profile?: string;
    target_tab_id?: number;
    execution_surface?: string;
    browser_channel?: string;
  };
};
```

Constraints:

- `operational` carries runtime and diagnostic context, not business result.
- `observability` inherits FR-0004 sanitization and budget rules.
- `timestamps.completed_at` is required for every v1-convertible v2 envelope because current v1 output requires `timestamp`.
- `limits` must disclose truncation, redaction, budget clipping or partial observation when they affect returned fields.
- `runtime` fields are optional and command-dependent; absence must not be interpreted as runtime failure.

## DiagnosisIndexV2

```ts
type DiagnosisIndexV2 = {
  availability: "available" | "unavailable" | "not_applicable";
  primary_error_index?: number;
  classification?: string;
  failure_site?: ErrorDiagnosisV2["failure_site"];
  evidence_refs?: string[];
  summary?: string;
};
```

Constraints:

- `diagnosis` is optional on `OperationalV2`; omitted means the command does not expose a command-level diagnosis index.
- `availability=available` requires either `primary_error_index`, `classification`, `failure_site`, `evidence_refs` or `summary`.
- `availability=unavailable` means diagnosis was expected but could not be collected; the reason should appear in `warnings` or the primary `errors[*].diagnosis`.
- `availability=not_applicable` means the command has no diagnosis surface for this run.
- `primary_error_index`, when present, must point to `errors[primary_error_index]`.
- `evidence_refs` must reference `evidence[*].ref`; it must not inline raw evidence.
- `summary` must be short and sanitized.

Minimum example:

```ts
const diagnosisIndexExample: DiagnosisIndexV2 = {
  availability: "available",
  primary_error_index: 0,
  classification: "request_failed",
  evidence_refs: ["artifact://run-123/key-request-1"],
  summary: "Primary request failed after runtime link was ready"
};
```

## CompatV2

```ts
type CompatV2 = {
  output_version: "v2";
  compatible_with: "fr-0001.v1";
  v1_status?: "success" | "error";
  v1_summary?: Record<string, unknown>;
  v1_error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
};
```

Constraints:

- `compat` is for loss-minimized v1 mapping only.
- `compat` must not become a second business result surface.
- A v2 envelope must be convertible to current v1 success or error output.

## EvidenceRefV2

```ts
type EvidenceRefV2 = {
  kind:
    | "artifact"
    | "log"
    | "route_evidence"
    | "runtime_diagnostic"
    | "contract_specific"
    | "not_applicable";
  ref: string;
  status: "available" | "partial" | "unavailable" | "not_applicable";
  produced_by_run_id?: string;
  collected_at?: string;
  summary?: string;
};
```

Constraints:

- `ref` is a locator, not sensitive raw content.
- `produced_by_run_id`, when present, must refer to the run that produced or collected the evidence.
- `summary` must be short, sanitized and optional.
- `evidence` does not replace PR `live_evidence_record` when live evidence gate applies.

## WarningV2

```ts
type WarningV2 = {
  code: string;
  message: string;
  severity: "info" | "warning";
  related_evidence_ref?: string;
  related_limit_ref?: string;
};
```

Constraints:

- Warnings are non-blocking.
- A blocking condition must be represented in `errors`, not only in `warnings`.
- Warning messages must not include secrets, full request bodies, cookies, tokens or raw platform payloads.

## ErrorV2

```ts
type ErrorV2 = {
  code: string;
  message: string;
  retryable: boolean;
  category:
    | "cli"
    | "runtime"
    | "page"
    | "request"
    | "action"
    | "account"
    | "risk"
    | "evidence"
    | "environment"
    | "unknown";
  diagnosis?: ErrorDiagnosisV2;
  related_evidence_refs?: string[];
};
```

Constraints:

- `errors[0]` is the primary error when `ok=false`.
- `errors[0].code`, `message` and `retryable` must map to current v1 `error`.
- Additional errors are related errors; they must not change the primary cause.
- `diagnosis` inherits FR-0004 sanitization, clipping and evidence count limits.

## ErrorDiagnosisV2

```ts
type ErrorDiagnosisV2 = {
  classification?: string;
  failure_site?: {
    stage?: string;
    component?: string;
    target?: string;
    summary?: string;
  };
  evidence?: string[];
  truncated?: boolean;
};
```

Constraints:

- Diagnosis is optional.
- Missing diagnosis must not be replaced by invented data.
- Evidence strings must be short and sanitized.

## LimitDisclosureV2

```ts
type LimitDisclosureV2 = {
  limit_ref: string;
  kind: "redaction" | "truncation" | "budget_clip" | "partial_observation";
  affected_path: string;
  reason: string;
};
```

Constraints:

- Redaction and truncation must be disclosed when they affect consumer-visible output.
- Sensitive content must be redacted before truncation.

## v1 Conversion

### v1 success from v2

```ts
type V1SuccessFromV2 = {
  run_id: string;
  command: string;
  status: "success";
  summary: Record<string, unknown>;
  timestamp: string;
  observability?: Record<string, unknown>;
};
```

Conversion rules:

- `status` is `success` when `ok=true`.
- `summary` is derived from `data`; if no command-specific summary exists, use `operational.compat.v1_summary` or `{}`.
- `timestamp` is derived from required `operational.timestamps.completed_at`.
- `observability` is derived from `operational.observability`.

### v1 error from v2

```ts
type V1ErrorFromV2 = {
  run_id: string;
  command: string;
  status: "error";
  error: {
    code: string;
    message: string;
    retryable: boolean;
    diagnosis?: ErrorDiagnosisV2;
  };
  timestamp: string;
  observability?: Record<string, unknown>;
};
```

Conversion rules:

- `status` is `error` when `ok=false`.
- `error` is derived from `errors[0]`.
- `timestamp` is derived from required `operational.timestamps.completed_at`.
- `observability` is derived from `operational.observability`.

## Explicit Non-Contracts

This contract does not freeze:

- default CLI output version switching.
- command-specific `data` payload schemas.
- Syvert normalized result.
- provider adapter schema.
- live evidence PR metadata.
- persistent storage schema.
- SDK / API / daemon output shape.
