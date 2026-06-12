import { describe, expect, it } from "vitest";

import {
  evaluateRiskEvidenceConsumerGate
} from "../../../shared/risk-evidence-gate.js";

const acceptedRiskEvidence = () => ({
  schema_version: "webenvoy-risk-evidence-boundary.v1",
  risk_state: "accepted",
  decision: "allow_input_to_1188",
  blocking_reasons: [],
  risk_evidence_ref: "risk-evidence://current-head/run-001",
  evidence_refs_consumed: ["provider-boundary://fr-0069", "runtime-binding://run-001"],
  evaluated_at: "2026-06-12T09:50:00.000Z",
  downstream_owner: "#1188"
});

describe("FR-0070 risk evidence consumer gate", () => {
  it("accepts current-scope risk evidence only as #1188 input, not read/write allow proof", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: acceptedRiskEvidence()
      })
    ).toMatchObject({
      required: true,
      accepted_risk_input: true,
      read_write_allow_proof: false,
      decision: "allow_input_to_consumer_gate",
      gate_reasons: [],
      risk_evidence_state: "accepted",
      risk_evidence_decision: "allow_input_to_1188"
    });
  });

  it("fails closed when required risk evidence is missing", () => {
    expect(evaluateRiskEvidenceConsumerGate({ risk_evidence_required: true })).toMatchObject({
      accepted_risk_input: false,
      decision: "blocked",
      gate_reasons: ["risk_evidence_missing"],
      risk_evidence_state: "missing"
    });
  });

  it("fails closed for unknown state, decision, and blocking reason", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: {
          risk_state: "maybe",
          decision: "allow",
          blocking_reasons: ["unknown_reason"],
          risk_evidence_ref: "risk-evidence://invalid",
          evidence_refs_consumed: ["provider-boundary://fr-0069"],
          downstream_owner: "#1188"
        }
      })
    ).toMatchObject({
      accepted_risk_input: false,
      decision: "blocked",
      gate_reasons: ["risk_evidence_unclassified"]
    });
  });

  it.each([
    ["stale", "risk_evidence_head_mismatch", "risk_evidence_head_mismatch"],
    ["scope_mismatch", "risk_evidence_profile_mismatch", "risk_evidence_profile_mismatch"],
    ["scope_mismatch", "risk_evidence_page_mismatch", "risk_evidence_page_mismatch"],
    ["scope_mismatch", "risk_evidence_provider_mismatch", "risk_evidence_provider_mismatch"],
    ["redaction_invalid", "risk_evidence_redaction_invalid", "risk_evidence_redaction_invalid"],
    [
      "provider_private_boundary_violation",
      "provider_private_patch_disclosed",
      "provider_private_patch_disclosed"
    ]
  ])("fails closed for %s / %s", (riskState, blocker, expectedReason) => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: {
          risk_state: riskState,
          decision: "deny",
          blocking_reasons: [blocker],
          risk_evidence_ref: "risk-evidence://blocked",
          evidence_refs_consumed: ["provider-boundary://fr-0069"],
          downstream_owner: "#1188"
        }
      }).gate_reasons
    ).toEqual(expect.arrayContaining([expectedReason]));
  });

  it.each([
    ["provider_doctor_pass", "provider_stealth_non_proof"],
    ["runtime_ping", "control_plane_only_signal"],
    ["runtime_bootstrap_ack", "control_plane_only_signal"],
    ["historical_artifact", "historical_or_stale_evidence"],
    ["same_head_historical_artifact", "historical_or_stale_evidence"],
    ["stub_or_fake_host", "stub_or_fake_host_evidence"],
    ["manual_disposition_present", "manual_disposition_not_accepted"],
    ["account_safety_issue_closed", "account_safety_required"]
  ])("does not accept %s as proof", (nonProof, expectedReason) => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        non_proofs_observed: [nonProof]
      })
    ).toMatchObject({
      accepted_risk_input: false,
      decision: "blocked",
      gate_reasons: [expectedReason],
      read_write_allow_proof: false
    });
  });

  it("does not accept allow_input_to_1188 when evidence refs are absent", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: {
          ...acceptedRiskEvidence(),
          risk_evidence_ref: null,
          evidence_refs_consumed: []
        }
      })
    ).toMatchObject({
      accepted_risk_input: false,
      decision: "blocked",
      gate_reasons: ["risk_evidence_missing"]
    });
  });
});
