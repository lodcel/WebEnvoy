import { createHash } from "node:crypto";
const opaqueRedactionRef = (kind, value) => {
    const digest = createHash("sha256").update(value).digest("hex").slice(0, 16);
    return `${kind}:redacted:${digest}`;
};
const safeRedactedPlaceholderPattern = /^<redacted:(?:proxy_credential|token|fingerprint_seed|account_identifier|path:(?:profile|source_media|private))>$/;
const redactedPlaceholderPattern = /^<redacted:([^>]+)>$/;
const alreadyRedacted = (value) => safeRedactedPlaceholderPattern.test(value) || /^[a-z-]+:redacted:[a-f0-9]{16}$/.test(value);
const unsafeRedactedPlaceholderContent = (value) => {
    if (alreadyRedacted(value)) {
        return null;
    }
    return redactedPlaceholderPattern.exec(value)?.[1] ?? null;
};
const privatePosixPathPattern = /(?:^|[\s"'=/])(?:\/Users\/|\/home\/|\/private\/var\/|\/var\/folders\/|\/Volumes\/)[^\r\n"']+/i;
const encodedPrivatePosixPathPattern = /(?:^|[\s"'=/:])(?:%2fUsers%2f|%2fhome%2f|%2fprivate%2fvar%2f|%2fvar%2ffolders%2f|%2fVolumes%2f)[^\r\n"']+/i;
const windowsPrivatePathPattern = /[A-Za-z]:\\(?:Users|Documents and Settings)\\[^\r\n"']+/i;
const privatePosixPathReplacePattern = /(?:\/Users\/|\/home\/|\/private\/var\/|\/var\/folders\/|\/Volumes\/)[^\r\n"']+/gi;
const encodedPrivatePosixPathReplacePattern = /(?:%2fUsers%2f|%2fhome%2f|%2fprivate%2fvar%2f|%2fvar%2ffolders%2f|%2fVolumes%2f)[^\r\n"']+/gi;
const windowsPrivatePathReplacePattern = /[A-Za-z]:\\(?:Users|Documents and Settings)\\[^\r\n"']+/gi;
const hasPrivatePath = (value) => privatePosixPathPattern.test(value) ||
    encodedPrivatePosixPathPattern.test(value) ||
    windowsPrivatePathPattern.test(value);
const pathRedactionKind = (path) => {
    if (path.endsWith(".profile_ref") || path.includes("profile")) {
        return "profile";
    }
    if (path.includes("source_media_ref")) {
        return "source_media";
    }
    return "private";
};
const secretHeaderReplacePatterns = [
    /\b((?:authorization|proxy-authorization)\s*[:=]\s*(?:bearer|basic|digest|token)\s+)(?!\s*<redacted:token>)[^\s"',;)]+/gi,
    /\b((?:authorization|proxy-authorization)\s*[:=])(?!(?:\s*(?:bearer|basic|digest|token)\s+)?\s*<redacted:token>)(\s*)[^\s"',;)]+/gi,
    /\b((?:x-api-key|x-api-token|api-key|api-token|x-auth-token|x-access-token|authorization-token|access-token|refresh-token)\s*[:=])(?!(?:\s*<redacted:token>))(\s*)[^\s"',;)]+/gi,
    /\b(set-cookie\s*[:=])(?!(?:\s*<redacted:token>))(\s*)[^\r\n"']+/gi,
    /(?<!-)\b(cookie\s*[:=])(?!(?:\s*<redacted:token>))(\s*)[^\r\n"']+/gi
];
const secretHeaderDetectPatterns = [
    /\b(?:authorization|proxy-authorization)\s*[:=]\s*(?:bearer|basic|digest|token)\s+(?!\s*<redacted:token>)[^\s"',;)]+/i,
    /\b(?:authorization|proxy-authorization)\s*[:=](?!(?:\s*(?:bearer|basic|digest|token)\s+)?\s*<redacted:token>)\s*[^\s"',;)]+/i,
    /\b(?:x-api-key|x-api-token|api-key|api-token|x-auth-token|x-access-token|authorization-token|access-token|refresh-token)\s*[:=](?!\s*<redacted:token>)\s*[^\s"',;)]+/i,
    /\bset-cookie\s*[:=](?!\s*<redacted:token>)\s*[^\r\n"']+/i,
    /(?<!-)\bcookie\s*[:=](?!\s*<redacted:token>)\s*[^\r\n"']+/i
];
const redactStringValue = (value, pathParts) => {
    const path = pathParts.join(".");
    if (alreadyRedacted(value)) {
        return { value, findings: [] };
    }
    const placeholderContent = unsafeRedactedPlaceholderContent(value);
    if (placeholderContent !== null) {
        const contentResult = redactStringValue(placeholderContent, pathParts);
        if (contentResult.findings.length > 0) {
            return contentResult;
        }
    }
    const findings = [];
    let redacted = value;
    const addFinding = (sensitivity, locator_kind, replacement) => {
        findings.push({
            path,
            sensitivity,
            locator_kind,
            redaction_state: "redacted",
            replacement
        });
    };
    if (path.endsWith(".profile_ref")) {
        redacted = opaqueRedactionRef("profile-ref", redacted);
        addFinding("sensitive", "private_locator", redacted);
        return { value: redacted, findings };
    }
    const proxyCredentialPattern = /\b(?:https?|socks5?|proxy):\/\/[^/\s:@]+:[^@\s/]+@[^\s"']+/gi;
    if (proxyCredentialPattern.test(redacted)) {
        redacted = redacted.replace(proxyCredentialPattern, "<redacted:proxy_credential>");
        addFinding("secret", "secret_handle", "<redacted:proxy_credential>");
    }
    const secretQueryPattern = /([?&](?:xsec_token|token|access_token|refresh_token|api_key|secret|password|cookie|auth|authorization)=)[^&#\s"']+/gi;
    if (secretQueryPattern.test(redacted)) {
        redacted = redacted.replace(secretQueryPattern, "$1<redacted:token>");
        addFinding("secret", "secret_handle", "<redacted:token>");
    }
    for (const pattern of secretHeaderReplacePatterns) {
        const nextRedacted = redacted.replace(pattern, (...match) => {
            const prefix = String(match[1]);
            const separator = typeof match[2] === "string" ? match[2] : "";
            return `${prefix}${separator}<redacted:token>`;
        });
        if (nextRedacted !== redacted) {
            redacted = nextRedacted;
            addFinding("secret", "secret_handle", "<redacted:token>");
        }
    }
    const seedPattern = /\b(?:fingerprint[-_ ]?seed|main_world_secret|bootstrap_secret|seed)[:=][^\s"',)]+/gi;
    if (seedPattern.test(redacted)) {
        redacted = redacted.replace(seedPattern, "<redacted:fingerprint_seed>");
        addFinding("secret", "secret_handle", "<redacted:fingerprint_seed>");
    }
    if (hasPrivatePath(redacted)) {
        const replacement = `<redacted:path:${pathRedactionKind(path)}>`;
        redacted = redacted
            .replace(privatePosixPathReplacePattern, replacement)
            .replace(encodedPrivatePosixPathReplacePattern, replacement)
            .replace(windowsPrivatePathReplacePattern, replacement);
        addFinding("sensitive", "private_locator", replacement);
    }
    const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
    if (emailPattern.test(redacted)) {
        redacted = redacted.replace(emailPattern, "<redacted:account_identifier>");
        addFinding("sensitive", "public_locator", "<redacted:account_identifier>");
    }
    const accountIdentifierPattern = /\b(?:account|account_id|user_id|uid|username|phone|mobile|tenant_id|workspace_id|organization_id)[:=][^\s"',)]+/gi;
    if (accountIdentifierPattern.test(redacted)) {
        redacted = redacted.replace(accountIdentifierPattern, "<redacted:account_identifier>");
        addFinding("sensitive", "public_locator", "<redacted:account_identifier>");
    }
    return { value: redacted, findings };
};
const redactEvidenceValue = (value, pathParts, findings) => {
    if (typeof value === "string") {
        const result = redactStringValue(value, pathParts);
        findings.push(...result.findings);
        return result.value;
    }
    if (Array.isArray(value)) {
        return value.map((item, index) => redactEvidenceValue(item, [...pathParts, String(index)], findings));
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [
            key,
            redactEvidenceValue(item, [...pathParts, key], findings)
        ]));
    }
    return value;
};
const hasUnredactedSensitiveString = (value) => {
    if (typeof value === "string") {
        if (alreadyRedacted(value)) {
            return false;
        }
        const valueToInspect = unsafeRedactedPlaceholderContent(value) ?? value;
        return (hasPrivatePath(valueToInspect) ||
            /\b(?:https?|socks5?|proxy):\/\/[^/\s:@]+:[^@\s/]+@[^\s"']+/i.test(valueToInspect) ||
            /\b(?:fingerprint[-_ ]?seed|main_world_secret|bootstrap_secret|seed)[:=][^\s"',)]+/i.test(valueToInspect) ||
            secretHeaderDetectPatterns.some((pattern) => pattern.test(valueToInspect)) ||
            /[?&](?:xsec_token|token|access_token|refresh_token|api_key|secret|password|cookie|auth|authorization)=((?!<redacted:)[^&#\s"']+)/i.test(valueToInspect) ||
            /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(valueToInspect) ||
            /\b(?:account|account_id|user_id|uid|username|phone|mobile|tenant_id|workspace_id|organization_id)[:=][^\s"',)]+/i.test(valueToInspect));
    }
    if (Array.isArray(value)) {
        return value.some(hasUnredactedSensitiveString);
    }
    if (value && typeof value === "object") {
        return Object.values(value).some(hasUnredactedSensitiveString);
    }
    return false;
};
export const redactFr0032LiveWriteEvidence = (input) => {
    const findings = [];
    const evidence = redactEvidenceValue(input, ["live_write_evidence"], findings);
    const redaction_state = hasUnredactedSensitiveString(evidence)
        ? "invalid"
        : findings.length > 0
            ? "redacted"
            : "not_required";
    return {
        evidence: evidence,
        redaction_state,
        redacted_field_count: new Set(findings.map((finding) => finding.path)).size,
        findings
    };
};
const pushBlocker = (blockers, blocker_code, message) => {
    if (blockers.some((blocker) => blocker.blocker_code === blocker_code)) {
        return;
    }
    blockers.push({ blocker_code, message });
};
const entryGatePassed = (entryGate) => entryGate.spec_review_state === "passed" &&
    entryGate.latest_head_sha !== null &&
    entryGate.readmission_decision === "GO" &&
    entryGate.runtime_readiness === "ready" &&
    entryGate.identity_binding_state === "bound" &&
    entryGate.target_binding_state === "verified" &&
    entryGate.account_safety_state === "clear" &&
    entryGate.validation_rows_state === "ready_verified_no_drift" &&
    entryGate.publish_visibility_scope !== null &&
    entryGate.publish_visibility_scope !== "unknown" &&
    entryGate.cleanup_policy_ref !== null;
const hasStablePublishIdentity = (identity) => identity.note_id !== null ||
    identity.published_url !== null ||
    identity.creator_result_url !== null ||
    identity.platform_record_ref !== null;
const cleanupOutcomeClosesAttempt = (cleanupResult, residualRecord) => {
    if (cleanupResult.cleanup_outcome === "deleted" ||
        cleanupResult.cleanup_outcome === "hidden" ||
        cleanupResult.cleanup_outcome === "draft_removed" ||
        cleanupResult.cleanup_outcome === "not_needed") {
        return true;
    }
    return residualRecord !== null || cleanupResult.residual_record !== null;
};
const cleanupOutcomeSuccessful = (cleanupResult) => cleanupResult.cleanup_outcome === "deleted" ||
    cleanupResult.cleanup_outcome === "hidden" ||
    cleanupResult.cleanup_outcome === "draft_removed" ||
    cleanupResult.cleanup_outcome === "not_needed";
const deriveAttemptState = (input) => {
    if (input.hasBlockingRisk) {
        return "stopped";
    }
    if (input.residualRecordRequired || input.blockerCount > 0) {
        return "failed";
    }
    if (input.cleanupSatisfied && !input.cleanupSuccess) {
        return "failed";
    }
    if (input.cleanupSuccess) {
        return "closed";
    }
    if (input.cleanupResult !== null) {
        return "cleanup_started";
    }
    if (input.publishSuccess) {
        return "published";
    }
    if (input.submitSuccess) {
        return "submitted";
    }
    if (input.uploadSuccess) {
        return "uploaded";
    }
    return "initialized";
};
export const evaluateFr0032LiveWriteEvidence = (input) => {
    const redaction = redactFr0032LiveWriteEvidence(input);
    const redactedInput = redaction.evidence;
    const blockers = [];
    const riskSignals = input.risk_signals ?? [];
    if (redaction.redaction_state === "invalid") {
        pushBlocker(blockers, "REDACTION_INVALID", "live-write evidence contains unredacted sensitive or secret-bearing values");
    }
    if (!entryGatePassed(input.entry_gate)) {
        pushBlocker(blockers, "ENTRY_GATE_NOT_GO", "fresh FR-0032 entry gate GO is required");
    }
    const uploadArtifact = input.upload_artifact_identity;
    if (!uploadArtifact) {
        pushBlocker(blockers, "UPLOAD_ARTIFACT_MISSING", "upload artifact identity is required");
    }
    else if (!uploadArtifact.accepted_by_platform || !uploadArtifact.visible_in_editor) {
        pushBlocker(blockers, "UPLOAD_NOT_ACCEPTED", "upload artifact must be accepted by the platform and visible in editor");
    }
    const submitEvidence = input.submit_evidence;
    if (!submitEvidence) {
        pushBlocker(blockers, "SUBMIT_EVIDENCE_MISSING", "submit evidence is required");
    }
    else if (submitEvidence.submit_result_state !== "accepted") {
        pushBlocker(blockers, "SUBMIT_NOT_ACCEPTED", "submit result state must be accepted");
        if (submitEvidence.submit_result_state === "blocked_by_risk") {
            pushBlocker(blockers, "SUBMIT_BLOCKED_BY_RISK", "submit was blocked by risk and later write actions must stop");
        }
    }
    const publishIdentity = input.publish_result_identity;
    if (!publishIdentity || !hasStablePublishIdentity(publishIdentity)) {
        pushBlocker(blockers, "PUBLISH_RESULT_IDENTITY_MISSING", "publish success requires a stable note id, URL, result page or platform record");
    }
    else {
        if (publishIdentity.publish_visibility_scope === "unknown") {
            pushBlocker(blockers, "PUBLISH_VISIBILITY_UNKNOWN", "publish visibility scope is required");
        }
        if (publishIdentity.verification_state !== "verified") {
            pushBlocker(blockers, "PUBLISH_RESULT_NOT_VERIFIED", "publish result identity must be verified");
        }
    }
    const cleanupResult = input.cleanup_result;
    if (!cleanupResult) {
        pushBlocker(blockers, "CLEANUP_RESULT_MISSING", "cleanup or rollback proof is required");
    }
    const inputResidualRecord = input.residual_record ?? null;
    const cleanupResidualRecord = cleanupResult?.residual_record ?? null;
    const residualRecord = inputResidualRecord ?? cleanupResidualRecord;
    const cleanupResultId = cleanupResult?.cleanup_result_id ?? null;
    const residualRecordId = residualRecord?.residual_record_id ?? null;
    const redactedCleanupResult = redactedInput.cleanup_result;
    const redactedInputResidualRecord = redactedInput.residual_record ?? null;
    const redactedCleanupResidualRecord = redactedCleanupResult?.residual_record ?? null;
    const redactedResidualRecord = inputResidualRecord !== null ? redactedInputResidualRecord : redactedCleanupResidualRecord;
    const outputCleanupResultId = redactedCleanupResult?.cleanup_result_id ?? null;
    const outputResidualRecordId = redactedResidualRecord?.residual_record_id ?? null;
    const residualRecordMismatch = inputResidualRecord !== null &&
        cleanupResidualRecord !== null &&
        inputResidualRecord.residual_record_id !== cleanupResidualRecord.residual_record_id;
    const cleanupSatisfied = cleanupResult !== null && cleanupOutcomeClosesAttempt(cleanupResult, residualRecord);
    const cleanupSuccess = cleanupResult !== null && cleanupOutcomeSuccessful(cleanupResult);
    const residualRecordRequired = cleanupResult !== null &&
        !cleanupOutcomeClosesAttempt(cleanupResult, null) &&
        residualRecord === null;
    const successWithResidual = cleanupResult !== null && !cleanupOutcomeSuccessful(cleanupResult) && residualRecord !== null;
    const noSafeCleanupAction = cleanupResult?.cleanup_action === "no_safe_cleanup_action";
    if (residualRecordRequired) {
        pushBlocker(blockers, "RESIDUAL_RECORD_REQUIRED", "cleanup failure, blocked cleanup or unsupported rollback requires residual record");
    }
    if (residualRecordMismatch) {
        pushBlocker(blockers, "RESIDUAL_RECORD_REQUIRED", "cleanup proof residual record and top-level residual record must identify the same residual");
    }
    const riskSignalPresent = riskSignals.length > 0;
    const hasBlockingRisk = riskSignals.some((riskSignal) => riskSignal.severity === "blocking");
    const blockingRiskSignalCount = riskSignals.filter((riskSignal) => riskSignal.severity === "blocking").length;
    const submitBlockedByRisk = submitEvidence?.submit_result_state === "blocked_by_risk";
    const stopSignalRequired = hasBlockingRisk || submitBlockedByRisk || noSafeCleanupAction;
    const stopSignal = input.stop_signal ?? null;
    const outputStopSignalId = redactedInput.stop_signal?.stop_signal_id ?? null;
    const blockingStopSignalPresent = stopSignal?.severity === "blocking";
    const stopSignalCleanupMismatch = stopSignal !== null &&
        (stopSignal.cleanup_result_id !== cleanupResultId ||
            stopSignal.residual_record_id !== residualRecordId);
    const stopSignalSatisfied = !stopSignalCleanupMismatch && (!stopSignalRequired || blockingStopSignalPresent);
    if (hasBlockingRisk) {
        pushBlocker(blockers, "RISK_SIGNAL_BLOCKING", "blocking risk signal stops live write");
    }
    if (!stopSignalSatisfied) {
        pushBlocker(blockers, "STOP_SIGNAL_REQUIRED", "blocking risk, risk-blocked submit or unsafe cleanup requires a matching blocking live write stop signal");
    }
    const uploadSuccess = uploadArtifact !== null &&
        uploadArtifact.accepted_by_platform === true &&
        uploadArtifact.visible_in_editor === true;
    const submitSuccess = submitEvidence?.submit_result_state === "accepted";
    const publishSuccess = publishIdentity !== null &&
        publishIdentity.verification_state === "verified" &&
        publishIdentity.publish_visibility_scope !== "unknown" &&
        hasStablePublishIdentity(publishIdentity);
    const laterWriteActionsBlocked = hasBlockingRisk ||
        submitBlockedByRisk ||
        noSafeCleanupAction ||
        (stopSignal?.severity === "blocking" && stopSignal.later_write_actions_blocked);
    const cleanupRequired = uploadSuccess || submitSuccess || publishIdentity !== null || hasBlockingRisk;
    const submitGateOpen = blockers.length === 0 && uploadSuccess && !laterWriteActionsBlocked;
    const publishGateOpen = submitGateOpen && submitSuccess && !laterWriteActionsBlocked;
    const cleanupGateOpen = cleanupRequired;
    const derivedAttemptState = deriveAttemptState({
        uploadSuccess,
        submitSuccess,
        publishSuccess,
        cleanupResult,
        cleanupSatisfied,
        cleanupSuccess,
        hasBlockingRisk,
        residualRecordRequired,
        blockerCount: blockers.length
    });
    const fullLiveWriteSuccess = blockers.length === 0 &&
        uploadSuccess &&
        submitSuccess &&
        publishSuccess &&
        cleanupSuccess &&
        !laterWriteActionsBlocked;
    return {
        decision: blockers.length === 0 && !laterWriteActionsBlocked ? "PASS" : "NO_GO",
        derived_attempt_state: derivedAttemptState,
        submit_gate_open: submitGateOpen,
        publish_gate_open: publishGateOpen,
        cleanup_gate_open: cleanupGateOpen,
        upload_success: uploadSuccess,
        submit_success: submitSuccess,
        publish_success: publishSuccess,
        cleanup_satisfied: cleanupSatisfied,
        cleanup_success: cleanupSuccess,
        success_with_residual: successWithResidual,
        full_live_write_success: fullLiveWriteSuccess,
        later_write_actions_blocked: laterWriteActionsBlocked,
        cleanup_required: cleanupRequired,
        cleanup_result_id: outputCleanupResultId,
        residual_record_id: outputResidualRecordId,
        residual_record_required: residualRecordRequired,
        risk_signal_present: riskSignalPresent,
        blocking_risk_signal_count: blockingRiskSignalCount,
        stop_signal_id: outputStopSignalId,
        stop_signal_present: stopSignal !== null,
        stop_signal_required: stopSignalRequired,
        stop_signal_satisfied: stopSignalSatisfied,
        redaction_state: redaction.redaction_state,
        redacted_field_count: redaction.redacted_field_count,
        redaction_findings: redaction.findings,
        blockers
    };
};
