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
export const evaluateFr0032ControlledUploadEvidence = (input) => {
    const blockers = [];
    const riskSignals = input.risk_signals ?? [];
    if (!entryGatePassed(input.entry_gate)) {
        pushBlocker(blockers, "ENTRY_GATE_NOT_GO", "FR-0032 upload validation requires fresh entry gate GO before any upload path can be trusted");
    }
    const artifact = input.upload_artifact_identity;
    if (!artifact) {
        pushBlocker(blockers, "UPLOAD_ARTIFACT_IDENTITY_MISSING", "upload artifact identity is required for controlled upload success");
    }
    else {
        if (!artifact.accepted_by_platform) {
            pushBlocker(blockers, "UPLOAD_PLATFORM_REJECTED", "platform must accept or stage the upload artifact");
        }
        if (!artifact.visible_in_editor) {
            pushBlocker(blockers, "UPLOAD_PREVIEW_NOT_VISIBLE", "editor preview visibility is required for upload success");
        }
    }
    if (input.submit_attempted === true) {
        pushBlocker(blockers, "SUBMIT_NOT_RUN", "#845 is a non-publish validation slice and must not submit or publish");
    }
    for (const riskSignal of riskSignals) {
        if (riskSignal.severity !== "blocking") {
            continue;
        }
        pushBlocker(blockers, riskSignal.kind === "account_safety" ? "ACCOUNT_SAFETY_SIGNAL" : "RISK_SIGNAL_BLOCKING", `blocking risk signal observed during upload validation: ${riskSignal.kind}`);
    }
    const upload_success = blockers.length === 0 &&
        artifact !== null &&
        artifact.accepted_by_platform === true &&
        artifact.visible_in_editor === true;
    const laterWriteActionsBlocked = input.submit_attempted !== true &&
        riskSignals.some((riskSignal) => riskSignal.severity === "blocking");
    return {
        decision: blockers.length === 0 ? "PASS" : "NO_GO",
        upload_success,
        full_live_write_success: false,
        non_publish_validation: true,
        later_write_actions_blocked: laterWriteActionsBlocked,
        cleanup_required: artifact !== null && (blockers.length > 0 || laterWriteActionsBlocked),
        blockers
    };
};
