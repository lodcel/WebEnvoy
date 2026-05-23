import { buildReplayInputPayloadLocatorForContract } from "../../core/ability-validation.js";
const EXECUTION_LAYERS = new Set(["L3", "L2", "L1"]);
const VALIDATION_MODES = new Set(["smoke_validation", "replay_validation"]);
const RESULT_STATES = new Set(["verified", "broken", "stale"]);
const FAILURE_CLASSES = new Set([
    "page_changed",
    "auth_or_session_required",
    "gate_blocked",
    "environment_mismatch",
    "runtime_error"
]);
const asNonEmptyString = (value, fieldName, invalidInput) => {
    if (typeof value !== "string" || value.trim().length === 0) {
        invalidInput(`${fieldName} is required`);
    }
    return value.trim();
};
const asExecutionLayer = (value, fieldName, invalidInput) => {
    const normalized = asNonEmptyString(value, fieldName, invalidInput);
    if (!EXECUTION_LAYERS.has(normalized)) {
        invalidInput(`${fieldName} must be one of L3, L2, L1`);
    }
    return normalized;
};
const asJsonObject = (value, fieldName, invalidInput) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        invalidInput(`${fieldName} must be a JSON object`);
    }
    return JSON.parse(JSON.stringify(value));
};
const parseJsonObject = (value) => {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? parsed
        : {};
};
const parseJsonArray = (value) => {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
};
const mapLatestValidationRow = (row) => ({
    validation_mode: row.validation_mode,
    result_state: row.result_state,
    ...(row.failure_class ? { failure_class: row.failure_class } : {}),
    validated_at: row.validated_at,
    run_id: row.run_id,
    validated_execution_layer: row.validated_execution_layer,
    baseline_descriptor: parseJsonObject(row.baseline_descriptor_json),
    artifact_refs: parseJsonArray(row.artifact_refs_json)
});
const mapSnapshotRow = (row) => ({
    snapshot_ref: row.snapshot_ref,
    ability_ref: row.ability_ref,
    profile_ref: row.profile_ref,
    execution_layer: row.execution_layer,
    captured_input_contract_ref: row.captured_input_contract_ref,
    source_run_id: row.source_run_id,
    payload_locator: row.payload_locator,
    input_payload: parseJsonObject(row.input_payload_json),
    captured_at: row.captured_at,
    retired_at: row.retired_at
});
export class SQLiteRuntimeStoreAbilityValidationRepository {
    #db;
    #invalidInput;
    #isIsoLike;
    #toStoreDbError;
    constructor(input) {
        this.#db = input.db;
        this.#invalidInput = input.invalidInput;
        this.#isIsoLike = input.isIsoLike;
        this.#toStoreDbError = input.toStoreDbError;
    }
    async upsertAbilityLatestValidation(input) {
        const scope = this.#assertScope(input);
        const latest = input.latestValidation;
        if (!VALIDATION_MODES.has(latest.validation_mode)) {
            this.#invalidInput("latest validation_mode is invalid");
        }
        if (!RESULT_STATES.has(latest.result_state)) {
            this.#invalidInput("latest result_state is invalid");
        }
        if (latest.failure_class !== undefined &&
            latest.failure_class !== null &&
            !FAILURE_CLASSES.has(latest.failure_class)) {
            this.#invalidInput("latest failure_class is invalid");
        }
        if (latest.result_state === "verified" && latest.failure_class) {
            this.#invalidInput("verified latest must not include failure_class");
        }
        if (latest.result_state === "broken" && !latest.failure_class) {
            this.#invalidInput("broken latest requires failure_class");
        }
        if (!this.#isIsoLike(latest.validated_at)) {
            this.#invalidInput("latest validated_at must be ISO-like");
        }
        if (latest.validated_execution_layer !== scope.executionLayer) {
            this.#invalidInput("latest validated_execution_layer must match scope execution_layer");
        }
        if (latest.baseline_descriptor.profile_ref !== scope.profileRef) {
            this.#invalidInput("latest baseline profile_ref must match scope profile_ref");
        }
        try {
            const updatedAt = new Date().toISOString();
            this.#db
                .prepare(`
          INSERT INTO ability_latest_validation(
            ability_ref,
            profile_ref,
            execution_layer,
            validation_mode,
            result_state,
            failure_class,
            validated_at,
            run_id,
            validated_execution_layer,
            baseline_descriptor_json,
            artifact_refs_json,
            updated_at
          ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(ability_ref, profile_ref, execution_layer, validation_mode) DO UPDATE SET
            result_state = excluded.result_state,
            failure_class = excluded.failure_class,
            validated_at = excluded.validated_at,
            run_id = excluded.run_id,
            validated_execution_layer = excluded.validated_execution_layer,
            baseline_descriptor_json = excluded.baseline_descriptor_json,
            artifact_refs_json = excluded.artifact_refs_json,
            updated_at = excluded.updated_at
        `)
                .run(scope.abilityRef, scope.profileRef, scope.executionLayer, latest.validation_mode, latest.result_state, latest.failure_class ?? null, latest.validated_at, latest.run_id, latest.validated_execution_layer, JSON.stringify(latest.baseline_descriptor), JSON.stringify(latest.artifact_refs ?? []), updatedAt);
            return this.#getLatestValidation(scope, latest.validation_mode);
        }
        catch (error) {
            throw this.#toStoreDbError(error);
        }
    }
    async listAbilityLatestValidations(scopeInput) {
        const scope = this.#assertScope(scopeInput);
        try {
            const rows = this.#db
                .prepare(`
          SELECT validation_mode, result_state, failure_class, validated_at, run_id,
                 validated_execution_layer, baseline_descriptor_json, artifact_refs_json
          FROM ability_latest_validation
          WHERE ability_ref = ?
            AND profile_ref = ?
            AND execution_layer = ?
          ORDER BY CASE validation_mode
            WHEN 'smoke_validation' THEN 0
            WHEN 'replay_validation' THEN 1
            ELSE 9
          END ASC
        `)
                .all(scope.abilityRef, scope.profileRef, scope.executionLayer);
            return rows.map(mapLatestValidationRow);
        }
        catch (error) {
            throw this.#toStoreDbError(error);
        }
    }
    async insertAbilityReplayInputSnapshot(input) {
        const snapshot = input.snapshot;
        const scope = this.#assertScope({
            abilityRef: snapshot.ability_ref,
            profileRef: snapshot.profile_ref,
            executionLayer: snapshot.execution_layer
        });
        const payload = asJsonObject(input.inputPayload, "input_payload", this.#invalidInput);
        if (snapshot.payload_locator !== buildReplayInputPayloadLocatorForContract(snapshot.snapshot_ref)) {
            this.#invalidInput("snapshot payload_locator is invalid");
        }
        if (!this.#isIsoLike(snapshot.captured_at)) {
            this.#invalidInput("snapshot captured_at must be ISO-like");
        }
        try {
            this.#db
                .prepare(`
          INSERT INTO ability_replay_input_snapshot(
            snapshot_ref,
            ability_ref,
            profile_ref,
            execution_layer,
            captured_input_contract_ref,
            source_run_id,
            payload_locator,
            input_payload_json,
            captured_at,
            retired_at
          ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        `)
                .run(snapshot.snapshot_ref, scope.abilityRef, scope.profileRef, scope.executionLayer, snapshot.captured_input_contract_ref, snapshot.source_run_id, snapshot.payload_locator, JSON.stringify(payload), snapshot.captured_at);
            return this.#getReplayInputSnapshotByRef(snapshot.snapshot_ref);
        }
        catch (error) {
            throw this.#toStoreDbError(error);
        }
    }
    async getAbilityReplayInputSnapshot(snapshotRef) {
        const ref = asNonEmptyString(snapshotRef, "snapshot_ref", this.#invalidInput);
        try {
            return this.#getOptionalReplayInputSnapshotByRef(ref);
        }
        catch (error) {
            throw this.#toStoreDbError(error);
        }
    }
    async getLatestAbilityReplayInputSnapshot(scopeInput) {
        const scope = this.#assertScope(scopeInput);
        const capturedInputContractRef = asNonEmptyString(scopeInput.capturedInputContractRef, "captured_input_contract_ref", this.#invalidInput);
        try {
            const row = this.#db
                .prepare(`
          SELECT snapshot_ref, ability_ref, profile_ref, execution_layer,
                 captured_input_contract_ref, source_run_id, payload_locator,
                 input_payload_json, captured_at, retired_at
          FROM ability_replay_input_snapshot
          WHERE ability_ref = ?
            AND profile_ref = ?
            AND execution_layer = ?
            AND captured_input_contract_ref = ?
            AND retired_at IS NULL
          ORDER BY captured_at DESC, snapshot_ref DESC
          LIMIT 1
        `)
                .get(scope.abilityRef, scope.profileRef, scope.executionLayer, capturedInputContractRef);
            return row ? mapSnapshotRow(row) : null;
        }
        catch (error) {
            throw this.#toStoreDbError(error);
        }
    }
    #assertScope(input) {
        return {
            abilityRef: asNonEmptyString(input.abilityRef, "ability_ref", this.#invalidInput),
            profileRef: asNonEmptyString(input.profileRef, "profile_ref", this.#invalidInput),
            executionLayer: asExecutionLayer(input.executionLayer, "execution_layer", this.#invalidInput)
        };
    }
    #getLatestValidation(scope, mode) {
        const row = this.#db
            .prepare(`
        SELECT validation_mode, result_state, failure_class, validated_at, run_id,
               validated_execution_layer, baseline_descriptor_json, artifact_refs_json
        FROM ability_latest_validation
        WHERE ability_ref = ?
          AND profile_ref = ?
          AND execution_layer = ?
          AND validation_mode = ?
      `)
            .get(scope.abilityRef, scope.profileRef, scope.executionLayer, mode);
        if (!row) {
            this.#invalidInput("ability latest validation was not written");
        }
        return mapLatestValidationRow(row);
    }
    #getReplayInputSnapshotByRef(snapshotRef) {
        const record = this.#getOptionalReplayInputSnapshotByRef(snapshotRef);
        if (!record) {
            this.#invalidInput("ability replay input snapshot was not written");
        }
        return record;
    }
    #getOptionalReplayInputSnapshotByRef(snapshotRef) {
        const row = this.#db
            .prepare(`
        SELECT snapshot_ref, ability_ref, profile_ref, execution_layer,
               captured_input_contract_ref, source_run_id, payload_locator,
               input_payload_json, captured_at, retired_at
        FROM ability_replay_input_snapshot
        WHERE snapshot_ref = ?
      `)
            .get(snapshotRef);
        return row ? mapSnapshotRow(row) : null;
    }
}
