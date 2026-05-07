export type CloseoutMultiRoundVerifierDecision = "PASS" | "FAIL";

export type CloseoutMultiRoundVerifierBlockerCode =
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

export type CloseoutMultiRoundVerifierBlockerLayer = "route" | "freshness" | "binding";

export interface CloseoutMultiRoundExpectedBinding {
  latest_head_sha: string | null;
  run_id: string | null;
  artifact_identity: string | null;
  artifact_identities?: string[] | null;
  profile_ref: string | null;
  target_tab_id: number | null;
  page_url: string | null;
  action_ref: string | null;
}

export interface CloseoutMultiRoundEvidenceRound {
  route_role: string | null;
  path_kind: string | null;
  evidence_status: string | null;
  evidence_class: string | null;
  head_sha: string | null;
  run_id: string | null;
  artifact_identity: string | null;
  profile_ref: string | null;
  target_tab_id: number | null;
  page_url: string | null;
  action_ref: string | null;
}

export interface CloseoutMultiRoundVerification {
  decision: CloseoutMultiRoundVerifierDecision;
  passed: boolean;
  reproduced_multi_round: boolean;
  accepted_round_count: number;
  unique_artifact_count: number;
  expected_artifact_observed: boolean;
  blockers: Array<{
    blocker_code: CloseoutMultiRoundVerifierBlockerCode;
    blocker_layer: CloseoutMultiRoundVerifierBlockerLayer;
    message: string;
  }>;
}

const REQUIRED_SUCCESS_ROUNDS = 2;

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

const normalizeStringArray = (value: string[] | null | undefined): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => normalizeString(item))
        .filter((item): item is string => item !== null)
    : [];

const ARTIFACT_ROUND_SEGMENT_PATTERN = /^(round|attempt)-\d+$/;

const inferArtifactFamilyPrefix = (artifactIdentity: string | null): string | null => {
  if (artifactIdentity === null) {
    return null;
  }
  const lastSeparatorIndex = artifactIdentity.lastIndexOf("/");
  if (lastSeparatorIndex < 0) {
    return null;
  }
  const lastSegment = artifactIdentity.slice(lastSeparatorIndex + 1);
  if (!ARTIFACT_ROUND_SEGMENT_PATTERN.test(lastSegment)) {
    return null;
  }
  return artifactIdentity.slice(0, lastSeparatorIndex + 1);
};

const inferProviderScopedArtifactPrefix = (input: {
  expectedRunId: string | null;
  expectedArtifactIdentity: string | null;
}): string | null => {
  if (
    input.expectedRunId === null ||
    input.expectedArtifactIdentity === null ||
    !input.expectedArtifactIdentity.startsWith(`${input.expectedRunId}:`)
  ) {
    return null;
  }
  return `${input.expectedRunId}:`;
};

const matchesExpectedArtifactIdentity = (input: {
  explicitArtifactContract: boolean;
  expectedArtifactIdentities: Set<string>;
  expectedArtifactIdentity: string | null;
  expectedArtifactFamilyPrefix: string | null;
  expectedProviderScopedArtifactPrefix: string | null;
  observedArtifactIdentity: string | null;
}): boolean => {
  if (input.observedArtifactIdentity === null) {
    return false;
  }

  if (input.explicitArtifactContract) {
    return input.expectedArtifactIdentities.has(input.observedArtifactIdentity);
  }

  if (input.expectedArtifactIdentity === input.observedArtifactIdentity) {
    return true;
  }

  if (
    input.expectedProviderScopedArtifactPrefix !== null &&
    input.observedArtifactIdentity.startsWith(input.expectedProviderScopedArtifactPrefix) &&
    input.observedArtifactIdentity.length > input.expectedProviderScopedArtifactPrefix.length
  ) {
    return true;
  }

  if (input.expectedArtifactFamilyPrefix === null) {
    return false;
  }

  if (!input.observedArtifactIdentity.startsWith(input.expectedArtifactFamilyPrefix)) {
    return false;
  }

  return ARTIFACT_ROUND_SEGMENT_PATTERN.test(
    input.observedArtifactIdentity.slice(input.expectedArtifactFamilyPrefix.length)
  );
};

const blocker = (
  blocker_code: CloseoutMultiRoundVerifierBlockerCode,
  blocker_layer: CloseoutMultiRoundVerifierBlockerLayer,
  message: string
): CloseoutMultiRoundVerification["blockers"][number] => ({
  blocker_code,
  blocker_layer,
  message
});

const isRecognizedEvidenceClass = (evidenceClass: string | null): boolean =>
  evidenceClass === "passive_api_capture" ||
  evidenceClass === "humanized_action" ||
  evidenceClass === "dom_state_extraction" ||
  evidenceClass === "active_api_fetch_fallback";

const pushUniqueBlocker = (
  blockers: CloseoutMultiRoundVerification["blockers"],
  nextBlocker: CloseoutMultiRoundVerification["blockers"][number]
): void => {
  if (
    blockers.some(
      (existingBlocker) => existingBlocker.blocker_code === nextBlocker.blocker_code
    )
  ) {
    return;
  }
  blockers.push(nextBlocker);
};

export const verifyCloseoutMultiRoundEvidence = (input: {
  expected: CloseoutMultiRoundExpectedBinding;
  evidence_rounds: CloseoutMultiRoundEvidenceRound[] | null | undefined;
}): CloseoutMultiRoundVerification => {
  const expectedLatestHeadSha = normalizeString(input.expected.latest_head_sha);
  const expectedRunId = normalizeString(input.expected.run_id);
  const expectedArtifactIdentity = normalizeString(input.expected.artifact_identity);
  const explicitArtifactIdentities = normalizeStringArray(input.expected.artifact_identities);
  const explicitArtifactContract = explicitArtifactIdentities.length > 0;
  const expectedArtifactIdentities = new Set([
    ...explicitArtifactIdentities,
    ...(expectedArtifactIdentity === null ? [] : [expectedArtifactIdentity])
  ]);
  const expectedArtifactFamilyPrefix = inferArtifactFamilyPrefix(expectedArtifactIdentity);
  const expectedProviderScopedArtifactPrefix = inferProviderScopedArtifactPrefix({
    expectedRunId,
    expectedArtifactIdentity
  });
  const expectedProfileRef = normalizeString(input.expected.profile_ref);
  const expectedPageUrl = normalizeString(input.expected.page_url);
  const expectedActionRef = normalizeString(input.expected.action_ref);
  const evidenceRounds = input.evidence_rounds ?? [];
  const blockers: CloseoutMultiRoundVerification["blockers"] = [];
  const artifactIdentities = new Set<string>();
  let duplicateArtifactObserved = false;
  let expectedArtifactObserved = false;
  let acceptedRoundCount = 0;

  for (const evidenceRound of evidenceRounds) {
    const routeRole = normalizeString(evidenceRound.route_role);
    const pathKind = normalizeString(evidenceRound.path_kind);
    const evidenceStatus = normalizeString(evidenceRound.evidence_status);
    const evidenceClass = normalizeString(evidenceRound.evidence_class);
    const observedHeadSha = normalizeString(evidenceRound.head_sha);
    const observedRunId = normalizeString(evidenceRound.run_id);
    const observedArtifactIdentity = normalizeString(evidenceRound.artifact_identity);
    const observedProfileRef = normalizeString(evidenceRound.profile_ref);
    const observedPageUrl = normalizeString(evidenceRound.page_url);
    const observedActionRef = normalizeString(evidenceRound.action_ref);

    if (routeRole !== "primary") {
      pushUniqueBlocker(
        blockers,
        blocker("non_primary_route", "route", "multi-round closeout evidence must use the primary route")
      );
    }

    if (pathKind !== "api") {
      pushUniqueBlocker(
        blockers,
        blocker("non_api_path", "route", "multi-round closeout evidence must use an API path")
      );
    }

    if (evidenceStatus !== "success") {
      pushUniqueBlocker(
        blockers,
        blocker(
          "evidence_not_success",
          "route",
          "each multi-round closeout evidence round must report success"
        )
      );
    }

    if (evidenceClass === "dom_state_extraction") {
      pushUniqueBlocker(
        blockers,
        blocker(
          "dom_state_not_full_closeout",
          "route",
          "DOM or page-state extraction cannot satisfy multi-round closeout evidence"
        )
      );
    }

    if (evidenceClass === "active_api_fetch_fallback") {
      pushUniqueBlocker(
        blockers,
        blocker(
          "active_fetch_not_admitted",
          "route",
          "active API fetch fallback cannot satisfy multi-round closeout evidence"
        )
      );
    } else if (evidenceClass === null || !isRecognizedEvidenceClass(evidenceClass)) {
      pushUniqueBlocker(
        blockers,
        blocker(
          "unsupported_evidence_class",
          "route",
          "multi-round closeout evidence must use an admitted evidence_class"
        )
      );
    }

    if (expectedLatestHeadSha === null || observedHeadSha === null) {
      pushUniqueBlocker(
        blockers,
        blocker(
          "missing_latest_head",
          "freshness",
          "multi-round closeout evidence requires both the expected and observed head sha"
        )
      );
    } else if (expectedLatestHeadSha !== observedHeadSha) {
      pushUniqueBlocker(
        blockers,
        blocker(
          "stale_head",
          "freshness",
          "each multi-round closeout evidence round must be bound to the current latest head"
        )
      );
    }

    if (!matchesExpectedString(expectedRunId, observedRunId)) {
      pushUniqueBlocker(
        blockers,
        blocker(
          "stale_run",
          "freshness",
          "each multi-round closeout evidence round must be bound to the current run"
        )
      );
    }

    if (observedArtifactIdentity === null) {
      pushUniqueBlocker(
        blockers,
        blocker(
          "stale_artifact",
          "freshness",
          "each multi-round closeout evidence round must have an artifact identity"
        )
      );
    } else if (
      !matchesExpectedArtifactIdentity({
        explicitArtifactContract,
        expectedArtifactIdentities,
        expectedArtifactIdentity,
        expectedArtifactFamilyPrefix,
        expectedProviderScopedArtifactPrefix,
        observedArtifactIdentity
      })
    ) {
      pushUniqueBlocker(
        blockers,
        blocker(
          "stale_artifact",
          "freshness",
          "each multi-round closeout evidence round must use a current artifact identity"
        )
      );
    } else if (artifactIdentities.has(observedArtifactIdentity)) {
      duplicateArtifactObserved = true;
      pushUniqueBlocker(
        blockers,
        blocker(
          "stale_artifact",
          "freshness",
          "multi-round closeout evidence cannot reuse the same artifact identity"
        )
      );
    } else {
      artifactIdentities.add(observedArtifactIdentity);
    }

    if (
      expectedArtifactIdentity !== null &&
      observedArtifactIdentity === expectedArtifactIdentity
    ) {
      expectedArtifactObserved = true;
    }

    if (!matchesExpectedString(expectedProfileRef, observedProfileRef)) {
      pushUniqueBlocker(
        blockers,
        blocker(
          "missing_profile_binding",
          "binding",
          "each multi-round closeout evidence round must be bound to the expected profile"
        )
      );
    }

    if (!matchesExpectedInteger(input.expected.target_tab_id, evidenceRound.target_tab_id)) {
      pushUniqueBlocker(
        blockers,
        blocker(
          "missing_tab_binding",
          "binding",
          "each multi-round closeout evidence round must be bound to the expected tab"
        )
      );
    }

    if (!matchesExpectedString(expectedPageUrl, observedPageUrl)) {
      pushUniqueBlocker(
        blockers,
        blocker(
          "missing_page_binding",
          "binding",
          "each multi-round closeout evidence round must be bound to the expected page URL"
        )
      );
    }

    if (!matchesExpectedString(expectedActionRef, observedActionRef)) {
      pushUniqueBlocker(
        blockers,
        blocker(
          "missing_action_binding",
          "binding",
          "each multi-round closeout evidence round must be bound to the expected action"
        )
      );
    }

    if (
      routeRole === "primary" &&
      pathKind === "api" &&
      evidenceStatus === "success" &&
      (evidenceClass === "passive_api_capture" || evidenceClass === "humanized_action") &&
      expectedLatestHeadSha !== null &&
      expectedLatestHeadSha === observedHeadSha &&
      matchesExpectedString(expectedRunId, observedRunId) &&
      observedArtifactIdentity !== null &&
      matchesExpectedArtifactIdentity({
        explicitArtifactContract,
        expectedArtifactIdentities,
        expectedArtifactIdentity,
        expectedArtifactFamilyPrefix,
        expectedProviderScopedArtifactPrefix,
        observedArtifactIdentity
      }) &&
      matchesExpectedString(expectedProfileRef, observedProfileRef) &&
      matchesExpectedInteger(input.expected.target_tab_id, evidenceRound.target_tab_id) &&
      matchesExpectedString(expectedPageUrl, observedPageUrl) &&
      matchesExpectedString(expectedActionRef, observedActionRef)
    ) {
      acceptedRoundCount += 1;
    }
  }

  if (
    evidenceRounds.length < REQUIRED_SUCCESS_ROUNDS ||
    acceptedRoundCount < REQUIRED_SUCCESS_ROUNDS ||
    artifactIdentities.size < REQUIRED_SUCCESS_ROUNDS ||
    duplicateArtifactObserved
  ) {
    pushUniqueBlocker(
      blockers,
      blocker(
        "missing_multi_round_evidence",
        "route",
        "closeout evidence must include at least two distinct successful rounds"
      )
    );
  }

  if (
    expectedArtifactIdentity === null ||
    !expectedArtifactObserved
  ) {
    pushUniqueBlocker(
      blockers,
      blocker(
        "stale_artifact",
        "freshness",
        "multi-round closeout evidence must include the current artifact identity"
      )
    );
  }

  const passed = blockers.length === 0;

  return {
    decision: passed ? "PASS" : "FAIL",
    passed,
    reproduced_multi_round: passed,
    accepted_round_count: acceptedRoundCount,
    unique_artifact_count: artifactIdentities.size,
    expected_artifact_observed: expectedArtifactObserved,
    blockers
  };
};
