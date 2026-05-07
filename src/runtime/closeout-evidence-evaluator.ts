import {
  verifyCloseoutMultiRoundEvidence,
  type CloseoutMultiRoundEvidenceRound
} from "./closeout-multi-round-verifier.js";

export type CloseoutEvidenceDecision = "PASS" | "FAIL";

export type CloseoutEvidenceBlockerCode =
  | "non_primary_route"
  | "non_api_path"
  | "evidence_not_success"
  | "dom_state_not_full_closeout"
  | "active_fetch_not_admitted"
  | "unsupported_evidence_class"
  | "missing_latest_head"
  | "stale_head"
  | "stale_run"
  | "stale_artifact"
  | "missing_profile_binding"
  | "missing_tab_binding"
  | "missing_page_binding"
  | "missing_action_binding"
  | "missing_multi_round_evidence";

export type CloseoutEvidenceBlockerLayer = "route" | "freshness" | "binding";

export interface EvaluateCloseoutEvidenceInput {
  expected: {
    latest_head_sha: string | null;
    run_id: string | null;
    artifact_identity: string | null;
    artifact_identities?: string[] | null;
    profile_ref: string | null;
    target_tab_id: number | null;
    page_url: string | null;
    action_ref: string | null;
  };
  evidence: {
    route_role: string | null;
    path_kind: string | null;
    evidence_status: string | null;
    evidence_class: string | null;
    reproduced_multi_round: boolean;
    head_sha: string | null;
    run_id: string | null;
    artifact_identity: string | null;
    profile_ref: string | null;
    target_tab_id: number | null;
    page_url: string | null;
    action_ref: string | null;
  };
  evidence_rounds?: CloseoutMultiRoundEvidenceRound[] | null;
}

export interface CloseoutEvidenceEvaluation {
  decision: CloseoutEvidenceDecision;
  passed: boolean;
  blockers: Array<{
    blocker_code: CloseoutEvidenceBlockerCode;
    blocker_layer: CloseoutEvidenceBlockerLayer;
    message: string;
  }>;
  evaluated_route: string;
  route_role: string | null;
  path_kind: string | null;
  evidence_status: string | null;
  evidence_class: string | null;
  reproduced_multi_round: boolean;
  freshness: {
    latest_head_available: boolean;
    latest_head_matches: boolean;
    run_matches: boolean;
    artifact_matches: boolean;
    expected_latest_head_sha: string | null;
    observed_head_sha: string | null;
    expected_run_id: string | null;
    observed_run_id: string | null;
    expected_artifact_identity: string | null;
    observed_artifact_identity: string | null;
  };
  bindings: {
    profile_bound: boolean;
    tab_bound: boolean;
    page_bound: boolean;
    action_bound: boolean;
    expected_profile_ref: string | null;
    observed_profile_ref: string | null;
    expected_target_tab_id: number | null;
    observed_target_tab_id: number | null;
    expected_page_url: string | null;
    observed_page_url: string | null;
    expected_action_ref: string | null;
    observed_action_ref: string | null;
  };
  multi_round: {
    accepted_round_count: number;
    unique_artifact_count: number;
    expected_artifact_observed: boolean;
  };
}

const normalizeString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const matchesExpectedString = (
  expected: string | null | undefined,
  observed: string | null | undefined
): boolean => {
  const normalizedExpected = normalizeString(expected);
  const normalizedObserved = normalizeString(observed);
  return normalizedExpected !== null && normalizedObserved !== null && normalizedExpected === normalizedObserved;
};

const matchesExpectedInteger = (
  expected: number | null | undefined,
  observed: number | null | undefined
): boolean => Number.isInteger(expected) && Number.isInteger(observed) && expected === observed;

const blocker = (
  blocker_code: CloseoutEvidenceBlockerCode,
  blocker_layer: CloseoutEvidenceBlockerLayer,
  message: string
): CloseoutEvidenceEvaluation["blockers"][number] => ({
  blocker_code,
  blocker_layer,
  message
});

export const evaluateCloseoutEvidence = (
  input: EvaluateCloseoutEvidenceInput
): CloseoutEvidenceEvaluation => {
  const expectedLatestHeadSha = normalizeString(input.expected.latest_head_sha);
  const observedHeadSha = normalizeString(input.evidence.head_sha);
  const expectedRunId = normalizeString(input.expected.run_id);
  const observedRunId = normalizeString(input.evidence.run_id);
  const expectedArtifactIdentity = normalizeString(input.expected.artifact_identity);
  const observedArtifactIdentity = normalizeString(input.evidence.artifact_identity);
  const expectedProfileRef = normalizeString(input.expected.profile_ref);
  const observedProfileRef = normalizeString(input.evidence.profile_ref);
  const expectedPageUrl = normalizeString(input.expected.page_url);
  const observedPageUrl = normalizeString(input.evidence.page_url);
  const expectedActionRef = normalizeString(input.expected.action_ref);
  const observedActionRef = normalizeString(input.evidence.action_ref);
  const routeRole = normalizeString(input.evidence.route_role);
  const pathKind = normalizeString(input.evidence.path_kind);
  const evidenceStatus = normalizeString(input.evidence.evidence_status);
  const evidenceClass = normalizeString(input.evidence.evidence_class);

  const latestHeadAvailable = expectedLatestHeadSha !== null && observedHeadSha !== null;
  const latestHeadMatches = latestHeadAvailable && expectedLatestHeadSha === observedHeadSha;
  const runMatches = matchesExpectedString(expectedRunId, observedRunId);
  const artifactMatches = matchesExpectedString(expectedArtifactIdentity, observedArtifactIdentity);
  const profileBound = matchesExpectedString(expectedProfileRef, observedProfileRef);
  const tabBound = matchesExpectedInteger(
    input.expected.target_tab_id,
    input.evidence.target_tab_id
  );
  const pageBound = matchesExpectedString(expectedPageUrl, observedPageUrl);
  const actionBound = matchesExpectedString(expectedActionRef, observedActionRef);
  const multiRoundVerification = verifyCloseoutMultiRoundEvidence({
    expected: input.expected,
    evidence_rounds: input.evidence_rounds ?? [input.evidence]
  });

  const blockers: CloseoutEvidenceEvaluation["blockers"] = multiRoundVerification.blockers.map(
    (multiRoundBlocker) =>
      blocker(
        multiRoundBlocker.blocker_code,
        multiRoundBlocker.blocker_layer,
        multiRoundBlocker.message
      )
  );

  const passed = blockers.length === 0;

  return {
    decision: passed ? "PASS" : "FAIL",
    passed,
    blockers,
    evaluated_route: [
      routeRole ?? "unknown_route",
      pathKind ?? "unknown_path",
      evidenceClass ?? "unknown_class",
      evidenceStatus ?? "unknown_status"
    ].join(":"),
    route_role: routeRole,
    path_kind: pathKind,
    evidence_status: evidenceStatus,
    evidence_class: evidenceClass,
    reproduced_multi_round: multiRoundVerification.reproduced_multi_round,
    freshness: {
      latest_head_available: latestHeadAvailable,
      latest_head_matches: latestHeadMatches,
      run_matches: runMatches,
      artifact_matches: artifactMatches,
      expected_latest_head_sha: expectedLatestHeadSha,
      observed_head_sha: observedHeadSha,
      expected_run_id: expectedRunId,
      observed_run_id: observedRunId,
      expected_artifact_identity: expectedArtifactIdentity,
      observed_artifact_identity: observedArtifactIdentity
    },
    bindings: {
      profile_bound: profileBound,
      tab_bound: tabBound,
      page_bound: pageBound,
      action_bound: actionBound,
      expected_profile_ref: expectedProfileRef,
      observed_profile_ref: observedProfileRef,
      expected_target_tab_id: input.expected.target_tab_id,
      observed_target_tab_id: input.evidence.target_tab_id,
      expected_page_url: expectedPageUrl,
      observed_page_url: observedPageUrl,
      expected_action_ref: expectedActionRef,
      observed_action_ref: observedActionRef
    },
    multi_round: {
      accepted_round_count: multiRoundVerification.accepted_round_count,
      unique_artifact_count: multiRoundVerification.unique_artifact_count,
      expected_artifact_observed: multiRoundVerification.expected_artifact_observed
    }
  };
};
