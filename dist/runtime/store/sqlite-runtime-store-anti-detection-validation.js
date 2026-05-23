import { mapAntiDetectionBaselineRegistryEntryRow, mapAntiDetectionBaselineSnapshotRow, mapAntiDetectionStructuredSampleRow, mapAntiDetectionValidationRecordRow, mapAntiDetectionValidationRequestRow, mapAntiDetectionValidationViewRow } from "./sqlite-runtime-store-helpers.js";
import { assertAntiDetectionValidationScopeKeyInput, assertInsertAntiDetectionBaselineSnapshotInput, assertInsertAntiDetectionStructuredSampleInput, assertInsertAntiDetectionValidationRecordInput, assertUpsertAntiDetectionBaselineRegistryEntryInput, assertUpsertAntiDetectionValidationRequestInput } from "./sqlite-runtime-store-validation.js";
const REQUEST_STATE_TRANSITIONS = {
    accepted: ["accepted", "sampling", "completed", "aborted"],
    sampling: ["sampling", "completed", "aborted"],
    completed: ["completed"],
    aborted: ["aborted"]
};
const antiDetectionScopeMatches = (actual, expected) => actual.target_fr_ref === expected.targetFrRef &&
    actual.validation_scope === expected.validationScope &&
    actual.profile_ref === expected.profileRef &&
    actual.browser_channel === expected.browserChannel &&
    actual.execution_surface === expected.executionSurface &&
    (actual.effective_execution_mode ?? actual.requested_execution_mode) ===
        expected.effectiveExecutionMode &&
    actual.probe_bundle_ref === expected.probeBundleRef;
export class SQLiteRuntimeStoreAntiDetectionValidationRepository {
    #db;
    #invalidInput;
    #isIsoLike;
    #toStoreDbError;
    #notFound;
    constructor(input) {
        this.#db = input.db;
        this.#invalidInput = input.invalidInput;
        this.#isIsoLike = input.isIsoLike;
        this.#toStoreDbError = input.toStoreDbError;
        this.#notFound = input.notFound;
    }
    async upsertAntiDetectionValidationRequest(input) {
        assertUpsertAntiDetectionValidationRequestInput(input, {
            invalidInput: this.#invalidInput,
            isIsoLike: this.#isIsoLike
        });
        try {
            const existing = this.#getOptionalAntiDetectionValidationRequestByRef(input.requestRef);
            if (existing) {
                const immutableMismatch = existing.validation_scope !== input.validationScope ||
                    existing.target_fr_ref !== input.targetFrRef ||
                    existing.profile_ref !== input.profileRef ||
                    existing.browser_channel !== input.browserChannel ||
                    existing.execution_surface !== input.executionSurface ||
                    existing.sample_goal !== input.sampleGoal ||
                    existing.requested_execution_mode !== input.requestedExecutionMode ||
                    existing.probe_bundle_ref !== input.probeBundleRef ||
                    existing.requested_at !== input.requestedAt;
                if (immutableMismatch) {
                    this.#invalidInput("request_ref conflicts with an existing anti-detection request");
                }
                if (!REQUEST_STATE_TRANSITIONS[existing.request_state].includes(input.requestState)) {
                    this.#invalidInput("anti-detection request_state transition is not allowed");
                }
            }
            else if (input.requestState === "completed" || input.requestState === "aborted") {
                this.#invalidInput("anti-detection request_state terminal state requires an existing request");
            }
            this.#db
                .prepare(`
          INSERT INTO anti_detection_validation_request(
            request_ref,
            validation_scope,
            target_fr_ref,
            profile_ref,
            browser_channel,
            execution_surface,
            sample_goal,
            requested_execution_mode,
            probe_bundle_ref,
            request_state,
            requested_at
          ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(request_ref) DO UPDATE SET
            request_state = excluded.request_state
        `)
                .run(input.requestRef, input.validationScope, input.targetFrRef, input.profileRef, input.browserChannel, input.executionSurface, input.sampleGoal, input.requestedExecutionMode, input.probeBundleRef, input.requestState, input.requestedAt);
            return this.#getAntiDetectionValidationRequestByRef(input.requestRef);
        }
        catch (error) {
            throw this.#toStoreDbError(error);
        }
    }
    async insertAntiDetectionStructuredSample(input) {
        assertInsertAntiDetectionStructuredSampleInput(input, {
            invalidInput: this.#invalidInput,
            isIsoLike: this.#isIsoLike
        });
        try {
            const existing = this.#getOptionalAntiDetectionStructuredSampleByRef(input.sampleRef);
            if (existing) {
                this.#invalidInput("sample_ref conflicts with an existing anti-detection sample");
            }
            const request = this.#getAntiDetectionValidationRequestByRef(input.requestRef);
            if (!antiDetectionScopeMatches(request, input)) {
                this.#invalidInput("anti-detection structured sample scope does not match request scope");
            }
            this.#db
                .prepare(`
          INSERT INTO anti_detection_structured_sample(
            sample_ref,
            request_ref,
            target_fr_ref,
            validation_scope,
            profile_ref,
            browser_channel,
            execution_surface,
            effective_execution_mode,
            probe_bundle_ref,
            run_id,
            captured_at,
            structured_payload,
            artifact_refs
          ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
                .run(input.sampleRef, input.requestRef, input.targetFrRef, input.validationScope, input.profileRef, input.browserChannel, input.executionSurface, input.effectiveExecutionMode, input.probeBundleRef, input.runId, input.capturedAt, JSON.stringify(input.structuredPayload), JSON.stringify(input.artifactRefs));
            return this.#getAntiDetectionStructuredSampleByRef(input.sampleRef);
        }
        catch (error) {
            throw this.#toStoreDbError(error);
        }
    }
    async getAntiDetectionStructuredSample(sampleRef) {
        if (!sampleRef.trim()) {
            this.#invalidInput("sample_ref is required");
        }
        try {
            return this.#getOptionalAntiDetectionStructuredSampleByRef(sampleRef);
        }
        catch (error) {
            throw this.#toStoreDbError(error);
        }
    }
    async getAntiDetectionValidationRequest(requestRef) {
        if (typeof requestRef !== "string" || requestRef.trim().length === 0) {
            this.#invalidInput("missing required anti-detection request_ref");
        }
        try {
            return this.#getOptionalAntiDetectionValidationRequestByRef(requestRef);
        }
        catch (error) {
            throw this.#toStoreDbError(error);
        }
    }
    async insertAntiDetectionBaselineSnapshot(input) {
        assertInsertAntiDetectionBaselineSnapshotInput(input, {
            invalidInput: this.#invalidInput,
            isIsoLike: this.#isIsoLike
        });
        try {
            const existing = this.#getOptionalAntiDetectionBaselineSnapshotByRef(input.baselineRef);
            if (existing) {
                this.#invalidInput("baseline_ref conflicts with an existing anti-detection baseline");
            }
            for (const sampleRef of input.sourceSampleRefs) {
                const sample = this.#getAntiDetectionStructuredSampleByRef(sampleRef);
                if (!antiDetectionScopeMatches(sample, input)) {
                    this.#invalidInput("anti-detection baseline source sample scope does not match baseline scope");
                }
            }
            this.#db
                .prepare(`
          INSERT INTO anti_detection_baseline_snapshot(
            baseline_ref,
            target_fr_ref,
            validation_scope,
            probe_bundle_ref,
            profile_ref,
            browser_channel,
            execution_surface,
            effective_execution_mode,
            signal_vector,
            captured_at,
            source_sample_refs,
            source_run_ids
          ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
                .run(input.baselineRef, input.targetFrRef, input.validationScope, input.probeBundleRef, input.profileRef, input.browserChannel, input.executionSurface, input.effectiveExecutionMode, JSON.stringify(input.signalVector), input.capturedAt, JSON.stringify(input.sourceSampleRefs), JSON.stringify(input.sourceRunIds));
            return this.#getAntiDetectionBaselineSnapshotByRef(input.baselineRef);
        }
        catch (error) {
            throw this.#toStoreDbError(error);
        }
    }
    async upsertAntiDetectionBaselineRegistryEntry(input) {
        assertUpsertAntiDetectionBaselineRegistryEntryInput(input, {
            invalidInput: this.#invalidInput,
            isIsoLike: this.#isIsoLike
        });
        try {
            const activeBaseline = this.#getAntiDetectionBaselineSnapshotByRef(input.activeBaselineRef);
            if (!antiDetectionScopeMatches(activeBaseline, input)) {
                this.#invalidInput("anti-detection active baseline scope does not match registry scope");
            }
            for (const baselineRef of input.supersededBaselineRefs) {
                const supersededBaseline = this.#getAntiDetectionBaselineSnapshotByRef(baselineRef);
                if (!antiDetectionScopeMatches(supersededBaseline, input)) {
                    this.#invalidInput("anti-detection superseded baseline scope does not match registry scope");
                }
            }
            this.#db
                .prepare(`
          INSERT INTO anti_detection_baseline_registry_entry(
            target_fr_ref,
            validation_scope,
            profile_ref,
            browser_channel,
            execution_surface,
            effective_execution_mode,
            probe_bundle_ref,
            active_baseline_ref,
            superseded_baseline_refs,
            replacement_reason,
            updated_at
          ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(
            target_fr_ref,
            validation_scope,
            profile_ref,
            browser_channel,
            execution_surface,
            effective_execution_mode,
            probe_bundle_ref
          ) DO UPDATE SET
            active_baseline_ref = excluded.active_baseline_ref,
            superseded_baseline_refs = excluded.superseded_baseline_refs,
            replacement_reason = excluded.replacement_reason,
            updated_at = excluded.updated_at
        `)
                .run(input.targetFrRef, input.validationScope, input.profileRef, input.browserChannel, input.executionSurface, input.effectiveExecutionMode, input.probeBundleRef, input.activeBaselineRef, JSON.stringify(input.supersededBaselineRefs), input.replacementReason, input.updatedAt);
            return this.#getAntiDetectionBaselineRegistryEntry(input);
        }
        catch (error) {
            throw this.#toStoreDbError(error);
        }
    }
    async insertAntiDetectionValidationRecord(input) {
        assertInsertAntiDetectionValidationRecordInput(input, {
            invalidInput: this.#invalidInput,
            isIsoLike: this.#isIsoLike
        });
        try {
            const existing = this.#getOptionalAntiDetectionValidationRecordByRef(input.recordRef);
            if (existing) {
                this.#invalidInput("record_ref conflicts with an existing anti-detection record");
            }
            const request = this.#getAntiDetectionValidationRequestByRef(input.requestRef);
            if (!antiDetectionScopeMatches(request, input)) {
                this.#invalidInput("anti-detection validation record scope does not match request scope");
            }
            const sample = this.#getAntiDetectionStructuredSampleByRef(input.sampleRef);
            if (sample.request_ref !== input.requestRef) {
                this.#invalidInput("anti-detection validation record sample does not belong to request");
            }
            if (!antiDetectionScopeMatches(sample, input)) {
                this.#invalidInput("anti-detection validation record scope does not match sample scope");
            }
            if (input.baselineRef) {
                const baseline = this.#getAntiDetectionBaselineSnapshotByRef(input.baselineRef);
                if (!antiDetectionScopeMatches(baseline, input)) {
                    this.#invalidInput("anti-detection validation record scope does not match baseline scope");
                }
            }
            this.#db
                .prepare(`
          INSERT INTO anti_detection_validation_record(
            record_ref,
            request_ref,
            target_fr_ref,
            validation_scope,
            profile_ref,
            browser_channel,
            execution_surface,
            effective_execution_mode,
            probe_bundle_ref,
            sample_ref,
            baseline_ref,
            result_state,
            drift_state,
            failure_class,
            run_id,
            validated_at
          ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
                .run(input.recordRef, input.requestRef, input.targetFrRef, input.validationScope, input.profileRef, input.browserChannel, input.executionSurface, input.effectiveExecutionMode, input.probeBundleRef, input.sampleRef, input.baselineRef, input.resultState, input.driftState, input.failureClass, input.runId, input.validatedAt);
            return this.#getAntiDetectionValidationRecordByRef(input.recordRef);
        }
        catch (error) {
            throw this.#toStoreDbError(error);
        }
    }
    async getAntiDetectionValidationView(scope) {
        assertAntiDetectionValidationScopeKeyInput(scope, {
            invalidInput: this.#invalidInput,
            isIsoLike: this.#isIsoLike
        });
        const row = this.#db
            .prepare(`
        SELECT
          target_fr_ref,
          validation_scope,
          profile_ref,
          browser_channel,
          execution_surface,
          effective_execution_mode,
          probe_bundle_ref,
          latest_record_ref,
          baseline_status,
          current_result_state,
          current_drift_state,
          last_success_at
        FROM anti_detection_validation_view
        WHERE target_fr_ref = ?
          AND validation_scope = ?
          AND profile_ref = ?
          AND browser_channel = ?
          AND execution_surface = ?
          AND effective_execution_mode = ?
          AND probe_bundle_ref = ?
      `)
            .get(scope.targetFrRef, scope.validationScope, scope.profileRef, scope.browserChannel, scope.executionSurface, scope.effectiveExecutionMode, scope.probeBundleRef);
        return row ? mapAntiDetectionValidationViewRow(row) : null;
    }
    async getAntiDetectionBaselineRegistryEntry(scope) {
        assertAntiDetectionValidationScopeKeyInput(scope, {
            invalidInput: this.#invalidInput,
            isIsoLike: this.#isIsoLike
        });
        try {
            return this.#getOptionalAntiDetectionBaselineRegistryEntry(scope);
        }
        catch (error) {
            throw this.#toStoreDbError(error);
        }
    }
    async getAntiDetectionBaselineSnapshot(baselineRef) {
        if (typeof baselineRef !== "string" || baselineRef.trim().length === 0) {
            this.#invalidInput("missing required anti-detection baseline_ref");
        }
        try {
            return this.#getOptionalAntiDetectionBaselineSnapshotByRef(baselineRef);
        }
        catch (error) {
            throw this.#toStoreDbError(error);
        }
    }
    #getAntiDetectionValidationRequestByRef(requestRef) {
        const row = this.#getOptionalAntiDetectionValidationRequestByRef(requestRef);
        if (!row) {
            throw this.#notFound("anti-detection validation request not found");
        }
        return row;
    }
    #getOptionalAntiDetectionValidationRequestByRef(requestRef) {
        const row = this.#db
            .prepare(`
        SELECT
          request_ref,
          validation_scope,
          target_fr_ref,
          profile_ref,
          browser_channel,
          execution_surface,
          sample_goal,
          requested_execution_mode,
          probe_bundle_ref,
          request_state,
          requested_at
        FROM anti_detection_validation_request
        WHERE request_ref = ?
      `)
            .get(requestRef);
        return row ? mapAntiDetectionValidationRequestRow(row) : null;
    }
    #getAntiDetectionStructuredSampleByRef(sampleRef) {
        const row = this.#getOptionalAntiDetectionStructuredSampleByRef(sampleRef);
        if (!row) {
            throw this.#notFound("anti-detection structured sample not found");
        }
        return row;
    }
    #getOptionalAntiDetectionStructuredSampleByRef(sampleRef) {
        const row = this.#db
            .prepare(`
        SELECT
          sample_ref,
          request_ref,
          target_fr_ref,
          validation_scope,
          profile_ref,
          browser_channel,
          execution_surface,
          effective_execution_mode,
          probe_bundle_ref,
          run_id,
          captured_at,
          structured_payload,
          artifact_refs
        FROM anti_detection_structured_sample
        WHERE sample_ref = ?
      `)
            .get(sampleRef);
        return row ? mapAntiDetectionStructuredSampleRow(row) : null;
    }
    #getAntiDetectionBaselineSnapshotByRef(baselineRef) {
        const row = this.#getOptionalAntiDetectionBaselineSnapshotByRef(baselineRef);
        if (!row) {
            throw this.#notFound("anti-detection baseline snapshot not found");
        }
        return row;
    }
    #getOptionalAntiDetectionBaselineSnapshotByRef(baselineRef) {
        const row = this.#db
            .prepare(`
        SELECT
          baseline_ref,
          target_fr_ref,
          validation_scope,
          probe_bundle_ref,
          profile_ref,
          browser_channel,
          execution_surface,
          effective_execution_mode,
          signal_vector,
          captured_at,
          source_sample_refs,
          source_run_ids
        FROM anti_detection_baseline_snapshot
        WHERE baseline_ref = ?
      `)
            .get(baselineRef);
        return row ? mapAntiDetectionBaselineSnapshotRow(row) : null;
    }
    #getAntiDetectionBaselineRegistryEntry(scope) {
        const row = this.#getOptionalAntiDetectionBaselineRegistryEntry(scope);
        if (!row) {
            throw this.#notFound("anti-detection baseline registry entry not found");
        }
        return row;
    }
    #getOptionalAntiDetectionBaselineRegistryEntry(scope) {
        const row = this.#db
            .prepare(`
        SELECT
          target_fr_ref,
          validation_scope,
          profile_ref,
          browser_channel,
          execution_surface,
          effective_execution_mode,
          probe_bundle_ref,
          active_baseline_ref,
          superseded_baseline_refs,
          replacement_reason,
          updated_at
        FROM anti_detection_baseline_registry_entry
        WHERE target_fr_ref = ?
          AND validation_scope = ?
          AND profile_ref = ?
          AND browser_channel = ?
          AND execution_surface = ?
          AND effective_execution_mode = ?
          AND probe_bundle_ref = ?
      `)
            .get(scope.targetFrRef, scope.validationScope, scope.profileRef, scope.browserChannel, scope.executionSurface, scope.effectiveExecutionMode, scope.probeBundleRef);
        if (!row) {
            return null;
        }
        return mapAntiDetectionBaselineRegistryEntryRow(row);
    }
    #getAntiDetectionValidationRecordByRef(recordRef) {
        const row = this.#getOptionalAntiDetectionValidationRecordByRef(recordRef);
        if (!row) {
            throw this.#notFound("anti-detection validation record not found");
        }
        return row;
    }
    #getOptionalAntiDetectionValidationRecordByRef(recordRef) {
        const row = this.#db
            .prepare(`
        SELECT
          record_ref,
          request_ref,
          target_fr_ref,
          validation_scope,
          profile_ref,
          browser_channel,
          execution_surface,
          effective_execution_mode,
          probe_bundle_ref,
          sample_ref,
          baseline_ref,
          result_state,
          drift_state,
          failure_class,
          run_id,
          validated_at
        FROM anti_detection_validation_record
        WHERE record_ref = ?
      `)
            .get(recordRef);
        return row ? mapAntiDetectionValidationRecordRow(row) : null;
    }
}
