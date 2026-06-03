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
    const blockers = [];
    const riskSignals = input.risk_signals ?? [];
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
    const stopSignalId = input.stop_signal?.stop_signal_id ?? null;
    const blockingStopSignalPresent = input.stop_signal?.severity === "blocking";
    const stopSignalCleanupMismatch = input.stop_signal !== null &&
        input.stop_signal !== undefined &&
        (input.stop_signal.cleanup_result_id !== cleanupResultId ||
            input.stop_signal.residual_record_id !== residualRecordId);
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
        (input.stop_signal?.severity === "blocking" && input.stop_signal.later_write_actions_blocked);
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
        cleanup_result_id: cleanupResultId,
        residual_record_id: residualRecordId,
        residual_record_required: residualRecordRequired,
        risk_signal_present: riskSignalPresent,
        blocking_risk_signal_count: blockingRiskSignalCount,
        stop_signal_id: stopSignalId,
        stop_signal_present: input.stop_signal !== null && input.stop_signal !== undefined,
        stop_signal_required: stopSignalRequired,
        stop_signal_satisfied: stopSignalSatisfied,
        blockers
    };
};
