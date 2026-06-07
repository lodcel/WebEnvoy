const commandErrorCategoryByDiagnosis = {
    execution_interrupted: "runtime",
    page_changed: "page",
    request_failed: "request",
    runtime_unavailable: "runtime",
    unknown: "unknown"
};
const EXIT_CODE_BY_ERROR = {
    ERR_CLI_INVALID_ARGS: 2,
    ERR_CLI_UNKNOWN_COMMAND: 3,
    ERR_CLI_NOT_IMPLEMENTED: 4,
    ERR_PROVIDER_UNAVAILABLE: 5,
    ERR_RISK_GATE_DENIED: 7,
    ERR_CLOSEOUT_FAILED: 8,
    ERR_SCHEMA_EVIDENCE_FAILED: 9,
    ERR_RUNTIME_UNAVAILABLE: 5,
    ERR_RUNTIME_BOOTSTRAP_PENDING: 5,
    ERR_RUNTIME_BOOTSTRAP_TRANSPORT_NOT_CONNECTED: 5,
    ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED: 5,
    ERR_RUNTIME_BOOTSTRAP_ACK_TIMEOUT: 5,
    ERR_RUNTIME_BOOTSTRAP_ACK_STALE: 5,
    ERR_RUNTIME_BOOTSTRAP_IDENTITY_MISMATCH: 5,
    ERR_RUNTIME_READY_SIGNAL_CONFLICT: 5,
    ERR_RUNTIME_IDENTITY_NOT_BOUND: 5,
    ERR_RUNTIME_IDENTITY_MISMATCH: 5,
    ERR_EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED: 5,
    ERR_EXECUTION_FAILED: 6,
    ERR_PROFILE_INVALID: 5,
    ERR_PROFILE_LOCKED: 5,
    ERR_PROFILE_OWNER_CONFLICT: 5,
    ERR_PROFILE_META_CORRUPT: 5,
    ERR_PROFILE_PROXY_CONFLICT: 5,
    ERR_BROWSER_LAUNCH_FAILED: 5,
    ERR_PROFILE_STATE_CONFLICT: 5
};
const categoryForError = (code, diagnosis) => {
    if (code === "ERR_PROVIDER_UNAVAILABLE") {
        return "environment";
    }
    if (code === "ERR_RISK_GATE_DENIED") {
        return "risk";
    }
    if (code === "ERR_CLOSEOUT_FAILED" || code === "ERR_SCHEMA_EVIDENCE_FAILED") {
        return "evidence";
    }
    if (code.startsWith("ERR_CLI_")) {
        return "cli";
    }
    if (code.startsWith("ERR_PROFILE_")) {
        return "account";
    }
    if (code.startsWith("ERR_RUNTIME_") ||
        code.startsWith("ERR_BROWSER_") ||
        code.startsWith("ERR_EXTENSION_")) {
        return "runtime";
    }
    if (diagnosis) {
        return commandErrorCategoryByDiagnosis[diagnosis.category];
    }
    return "unknown";
};
const familyForError = (code) => {
    if (code === "ERR_CLI_INVALID_ARGS" ||
        code === "ERR_CLI_UNKNOWN_COMMAND" ||
        code === "ERR_CLI_NOT_IMPLEMENTED") {
        return "validation";
    }
    if (code === "ERR_RISK_GATE_DENIED") {
        return "risk_gate_denied";
    }
    if (code === "ERR_PROVIDER_UNAVAILABLE" ||
        code === "ERR_RUNTIME_UNAVAILABLE" ||
        code.startsWith("ERR_RUNTIME_BOOTSTRAP_") ||
        code.startsWith("ERR_RUNTIME_IDENTITY_") ||
        code === "ERR_RUNTIME_READY_SIGNAL_CONFLICT" ||
        code === "ERR_EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED" ||
        code.startsWith("ERR_PROFILE_") ||
        code === "ERR_BROWSER_LAUNCH_FAILED") {
        return "provider_unavailable";
    }
    if (code === "ERR_CLOSEOUT_FAILED") {
        return "closeout_failure";
    }
    if (code === "ERR_SCHEMA_EVIDENCE_FAILED") {
        return "schema_evidence_failure";
    }
    if (code === "ERR_EXECUTION_FAILED") {
        return "runtime_failure";
    }
    return "provider_unavailable";
};
const sanitizeRefToken = (value) => value
    .trim()
    .replace(/[^a-zA-Z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
const pushEvidence = (items, item) => {
    if (!items.some((existing) => existing.ref === item.ref)) {
        items.push(item);
    }
};
const evidenceFromObservability = (runId, observability) => {
    const evidence = [];
    observability.key_requests.forEach((request, index) => {
        const requestRef = sanitizeRefToken(request.request_id);
        const status = request.outcome === "unknown" ? "partial" : "available";
        const statusCode = typeof request.status_code === "number" ? ` status=${request.status_code}` : "";
        pushEvidence(evidence, {
            kind: "route_evidence",
            ref: `run:${runId}:observability:key_request:${index + 1}:${requestRef}`,
            status,
            produced_by_run_id: runId,
            summary: `${request.method} ${request.url} outcome=${request.outcome}${statusCode}`
        });
    });
    if (observability.failure_site !== null) {
        pushEvidence(evidence, {
            kind: "runtime_diagnostic",
            ref: `run:${runId}:observability:failure_site`,
            status: "available",
            produced_by_run_id: runId,
            summary: observability.failure_site.summary
        });
    }
    return evidence;
};
const diagnosisEvidenceRefs = (runId, diagnosis, evidence) => {
    if (!diagnosis) {
        return [];
    }
    return diagnosis.evidence.map((item, index) => {
        const ref = `run:${runId}:diagnosis:evidence:${index + 1}`;
        pushEvidence(evidence, {
            kind: "runtime_diagnostic",
            ref,
            status: "available",
            produced_by_run_id: runId,
            summary: item
        });
        return ref;
    });
};
const limitsFromObservability = (observability) => {
    const limits = observability.truncation.fields.map((field) => ({
        limit_ref: `observability.truncation.${field}`,
        kind: "truncation",
        affected_path: `operational.observability.${field}`,
        reason: "current v1 observability payload reports this field as truncated"
    }));
    if (observability.coverage === "partial") {
        limits.push({
            limit_ref: "observability.coverage.partial",
            kind: "partial_observation",
            affected_path: "operational.observability",
            reason: "current v1 observability payload reports partial coverage"
        });
    }
    return limits;
};
const limitsFromEvidence = (evidence) => evidence
    .filter((item) => item.status === "partial")
    .map((item) => ({
    limit_ref: `evidence.partial.${sanitizeRefToken(item.ref)}`,
    kind: "partial_observation",
    affected_path: "evidence[*].status",
    reason: `evidence ref ${item.ref} is partial`
}));
const diagnosisIndexFromError = (response, evidenceRefs) => ({
    availability: "available",
    primary_error_index: 0,
    classification: response.error.diagnosis.category,
    failure_site: response.error.diagnosis.failure_site,
    ...(evidenceRefs.length > 0 ? { evidence_refs: evidenceRefs } : {}),
    summary: response.error.diagnosis.failure_site.summary
});
const errorFromResponse = (response, relatedEvidenceRefs) => ({
    code: response.error.code,
    message: response.error.message,
    retryable: response.error.retryable,
    category: categoryForError(response.error.code, response.error.diagnosis),
    family: familyForError(response.error.code),
    exit_code: EXIT_CODE_BY_ERROR[response.error.code],
    diagnosis: response.error.diagnosis,
    ...(relatedEvidenceRefs.length > 0 ? { related_evidence_refs: relatedEvidenceRefs } : {})
});
export const mapCurrentCliResponseToCommandEnvelopeV2 = (response) => {
    const evidence = evidenceFromObservability(response.run_id, response.observability);
    if (response.status === "success") {
        const limits = [
            ...limitsFromObservability(response.observability),
            ...limitsFromEvidence(evidence)
        ];
        return {
            ok: true,
            command: response.command,
            run_id: response.run_id,
            data: response.summary,
            operational: {
                compat: {
                    output_version: "v2",
                    compatible_with: "fr-0001.v1",
                    v1_status: response.status,
                    v1_summary: response.summary
                },
                observability: response.observability,
                timestamps: {
                    completed_at: response.timestamp
                },
                ...(limits.length > 0 ? { limits } : {})
            },
            evidence,
            warnings: [],
            errors: []
        };
    }
    const diagnosisRefs = diagnosisEvidenceRefs(response.run_id, response.error.diagnosis, evidence);
    const limits = [
        ...limitsFromObservability(response.observability),
        ...limitsFromEvidence(evidence)
    ];
    const primaryError = errorFromResponse(response, evidence.map((item) => item.ref));
    return {
        ok: false,
        command: response.command,
        run_id: response.run_id,
        data: {},
        operational: {
            compat: {
                output_version: "v2",
                compatible_with: "fr-0001.v1",
                v1_status: response.status,
                v1_error: {
                    code: response.error.code,
                    message: response.error.message,
                    retryable: response.error.retryable
                }
            },
            observability: response.observability,
            diagnosis: diagnosisIndexFromError(response, diagnosisRefs),
            timestamps: {
                completed_at: response.timestamp
            },
            ...(limits.length > 0 ? { limits } : {})
        },
        evidence,
        warnings: [],
        errors: [primaryError]
    };
};
