# FR-0035 Contract: Error and Exit Code Taxonomy

Canonical Issue: #1133

## Ownership

This contract defines the WebEnvoy-local error family and exit code taxonomy for CLI command outputs and Command Envelope v2.

It is adapter-consumable in shape, but it does not define Syvert normalized results, provider adapter payloads, live evidence PR metadata, or cross-repository shared output.

## ErrorFamilyV1V2

```ts
type ErrorFamilyV1V2 =
  | "validation"
  | "risk_gate_denied"
  | "provider_unavailable"
  | "runtime_failure"
  | "closeout_failure"
  | "schema_evidence_failure";
```

Constraints:

- Every blocking WebEnvoy command error introduced after this FR must choose one primary `ErrorFamilyV1V2`.
- `errors[0]` owns the primary family.
- Related errors may use different families, but they must not change the process exit code.

## ExitCodeClass

```ts
type ExitCodeClass =
  | 0 // success
  | 2 // validation
  | 3 // unknown_command
  | 4 // not_implemented
  | 5 // provider_unavailable
  | 6 // runtime_failure
  | 7 // risk_gate_denied
  | 8 // closeout_failure
  | 9; // schema_evidence_failure
```

Constraints:

- `0` to `6` preserve FR-0001 meanings.
- `7` to `9` are additive and only used by later implementation work.
- The process exit code is derived from the primary error family.

## ErrorTaxonomyEntry

```ts
type ErrorTaxonomyEntry = {
  family: ErrorFamilyV1V2;
  canonical_code:
    | "ERR_CLI_INVALID_ARGS"
    | "ERR_RISK_GATE_DENIED"
    | "ERR_PROVIDER_UNAVAILABLE"
    | "ERR_RUNTIME_UNAVAILABLE"
    | "ERR_EXECUTION_FAILED"
    | "ERR_CLOSEOUT_FAILED"
    | "ERR_SCHEMA_EVIDENCE_FAILED";
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
  exit_code: ExitCodeClass;
  retryable_default: boolean | "diagnosis_dependent";
};
```

Canonical table:

```ts
const errorTaxonomy: ErrorTaxonomyEntry[] = [
  {
    family: "validation",
    canonical_code: "ERR_CLI_INVALID_ARGS",
    category: "cli",
    exit_code: 2,
    retryable_default: false
  },
  {
    family: "risk_gate_denied",
    canonical_code: "ERR_RISK_GATE_DENIED",
    category: "risk",
    exit_code: 7,
    retryable_default: false
  },
  {
    family: "provider_unavailable",
    canonical_code: "ERR_PROVIDER_UNAVAILABLE",
    category: "environment",
    exit_code: 5,
    retryable_default: true
  },
  {
    family: "runtime_failure",
    canonical_code: "ERR_EXECUTION_FAILED",
    category: "runtime",
    exit_code: 6,
    retryable_default: "diagnosis_dependent"
  },
  {
    family: "closeout_failure",
    canonical_code: "ERR_CLOSEOUT_FAILED",
    category: "evidence",
    exit_code: 8,
    retryable_default: false
  },
  {
    family: "schema_evidence_failure",
    canonical_code: "ERR_SCHEMA_EVIDENCE_FAILED",
    category: "evidence",
    exit_code: 9,
    retryable_default: false
  }
];
```

## ErrorV2 Additive Fields

FR-0034 `ErrorV2` is extended by this FR as follows:

```ts
type ErrorV2WithTaxonomy = ErrorV2 & {
  family: ErrorFamilyV1V2;
  exit_code: ExitCodeClass;
};
```

Constraints:

- `family` and `exit_code` are required for v2 errors produced by post-FR-0035 implementation work.
- `errors[0].exit_code` must match the process exit code for normal CLI execution.
- v2 preview or sidecar outputs that do not control process exit must disclose the mismatch in `operational.compat`.
- v1 conversion still uses `code`, `message` and `retryable`.

## v1 Compatibility

```ts
type V1ErrorWithTaxonomy = {
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

- v1 `error.code` is derived from `errors[0].code`.
- v1 `error.retryable` is derived from `errors[0].retryable`.
- The process exit code is derived from `errors[0].exit_code`.
- Current v1 consumers are not required to parse `family` or `exit_code` inside stdout until a later explicit implementation FR adds those fields.

## Boundary Rules

- `provider_unavailable` means the required execution surface or provider is unavailable before command execution reaches the target action.
- `runtime_failure` means the command entered execution and failed in runtime, page, request, action, account or unknown execution stage.
- `closeout_failure` means a closeout/admission/gate/evaluator consumed evidence and rejected completion.
- `schema_evidence_failure` means output schema or required evidence was missing, malformed or not contract-compliant.
- `risk_gate_denied` means WebEnvoy-local risk controls rejected an action or escalation.

## Explicit Non-Contracts

This contract does not freeze:

- CLI implementation timing.
- default output-version switching.
- command-specific business payloads.
- Syvert normalized result fields.
- provider adapter schemas.
- GitHub PR live evidence metadata.
- runtime account safety procedures.
