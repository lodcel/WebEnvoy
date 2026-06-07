const commandErrorCategoryByDiagnosis = {
    execution_interrupted: "runtime",
    page_changed: "page",
    request_failed: "request",
    runtime_unavailable: "runtime",
    unknown: "unknown"
};
const categoryForError = (code, diagnosis) => {
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
