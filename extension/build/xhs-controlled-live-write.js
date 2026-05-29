const nowIso = () => new Date().toISOString();
const sourceMediaKind = (value) => value === "video" || value === "mixed" ? value : "image";
export const buildXhsControlledLiveWriteUnavailableResult = (input) => {
    const timestamp = nowIso();
    const uploadArtifactId = `upload-artifact/fr-0032/${input.run_id}/${input.source_media_digest.slice(7, 19)}`;
    const stopSignalId = `stop/fr-0032/${input.live_write_attempt_id}/executor-unavailable`;
    const evidenceRef = `live_write_evidence/${input.live_write_attempt_id}`;
    const stopSignal = {
        schema_version: "fr-0032.live_write_stop_signal.v1",
        stop_signal_id: stopSignalId,
        live_write_attempt_id: input.live_write_attempt_id,
        run_id: input.run_id,
        profile_ref: input.profile_ref ?? "unknown",
        target_tab_id: input.target_tab_id ?? 0,
        stopped_at: timestamp,
        stopped_step: "upload",
        blocker_layer: "upload",
        blocker_code: "CONTROLLED_LIVE_WRITE_EXECUTOR_UNAVAILABLE",
        severity: "blocking",
        later_write_actions_blocked: true,
        cleanup_required: false,
        cleanup_result_id: null,
        residual_record_id: null,
        required_recovery_action: "provide a page executor that can safely perform controlled media upload before submit/publish",
        evidence_ref: evidenceRef
    };
    const liveWriteEvidence = {
        schema_version: "fr-0032.live_write_evidence.v1",
        live_write_attempt_id: input.live_write_attempt_id,
        canonical_issue_ref: "#835",
        execution_phase: "upload",
        scope: {
            platform: "xhs",
            target_domain: "creator.xiaohongshu.com",
            target_page: "creator_publish_tab",
            browser_channel: "Google Chrome stable",
            execution_surface: "real_browser",
            requested_execution_mode: "live_write",
            profile_ref: input.profile_ref ?? "unknown",
            target_tab_id: input.target_tab_id ?? 0,
            probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
            run_id: input.run_id,
            artifact_identity: uploadArtifactId
        },
        entry_gate: null,
        stop_classification: {
            category: "capability_gap",
            evaluation_state: "not_evaluated",
            not_evaluated_reason: "controlled_live_write_executor_unavailable",
            latest_head_sha: input.latest_head_sha ?? null,
            publish_visibility_scope: input.publish_visibility_scope,
            cleanup_policy_ref: input.cleanup_policy_ref
        },
        upload_artifact_identity: {
            upload_artifact_id: uploadArtifactId,
            source_media_ref: input.source_media_ref,
            source_media_digest: input.source_media_digest,
            source_media_kind: sourceMediaKind(input.source_media_kind),
            platform_staging_ref: null,
            page_preview_locator: null,
            accepted_by_platform: false,
            visible_in_editor: false,
            captured_at: timestamp
        },
        submit_evidence: null,
        publish_result_identity: null,
        cleanup_result: null,
        risk_signals: [
            {
                risk_signal_id: `risk/fr-0032/${input.live_write_attempt_id}/upload-unavailable`,
                detected_at: timestamp,
                source: "upload",
                kind: "upload_failure",
                severity: "blocking",
                details_ref: "controlled_live_write_executor_unavailable"
            }
        ],
        stop_signal: stopSignal,
        residual_record: null,
        created_at: timestamp,
        updated_at: timestamp
    };
    return {
        live_write_action: "controlled_upload_submit_publish",
        target_page: "creator_publish_tab",
        live_write_evidence: liveWriteEvidence,
        live_write_evaluation: {
            schema_version: "fr-0032.live_write_evaluation.v1",
            decision: "NO_GO",
            full_live_write_success: false,
            upload_success: false,
            submit_success: false,
            publish_success: false,
            cleanup_success: false,
            later_write_actions_blocked: true,
            cleanup_required: false,
            blockers: [
                {
                    blocker_code: "CONTROLLED_LIVE_WRITE_EXECUTOR_UNAVAILABLE",
                    blocker_layer: "upload",
                    message: "No trusted page executor is available for controlled upload, so submit/publish are blocked."
                }
            ]
        },
        uploaded: false,
        submitted: false,
        published: false,
        cleanup_attempted: false,
        out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"]
    };
};
export const buildXhsControlledLiveWriteFromDiscovery = (input, discovery) => {
    if (discovery.controlled_upload_evidence?.upload_artifact_identity?.accepted_by_platform === true) {
        return {
            ...buildXhsControlledLiveWriteUnavailableResult(input),
            live_write_evaluation: {
                schema_version: "fr-0032.live_write_evaluation.v1",
                decision: "NO_GO",
                full_live_write_success: false,
                upload_success: true,
                submit_success: false,
                publish_success: false,
                cleanup_success: false,
                later_write_actions_blocked: true,
                cleanup_required: true,
                blockers: [
                    {
                        blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE",
                        blocker_layer: "submit",
                        message: "Upload evidence exists, but submit/publish executor is not available."
                    }
                ]
            }
        };
    }
    return buildXhsControlledLiveWriteUnavailableResult(input);
};
