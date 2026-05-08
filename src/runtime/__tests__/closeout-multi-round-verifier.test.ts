import { describe, expect, it } from "vitest";

import {
  verifyCloseoutMultiRoundEvidence,
  type CloseoutMultiRoundEvidenceRound,
  type CloseoutMultiRoundExpectedBinding
} from "../closeout-multi-round-verifier.js";

const expectedBinding = (): CloseoutMultiRoundExpectedBinding => ({
  latest_head_sha: "15a4e0bd5371178933fd23cac0311181db5bfde5",
  run_id: "run-closeout-evidence-001",
  artifact_identity: "artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-1",
  artifact_identities: [
    "artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-1",
    "artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-2"
  ],
  profile_ref: "profile/xhs_001",
  target_tab_id: 88,
  page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
  action_ref: "action/xhs.search/open_result_card"
});

const successRound = (
  artifactIdentity = "artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-1"
): CloseoutMultiRoundEvidenceRound => ({
  route_role: "primary",
  path_kind: "api",
  evidence_status: "success",
  evidence_class: "passive_api_capture",
  head_sha: "15a4e0bd5371178933fd23cac0311181db5bfde5",
  run_id: "run-closeout-evidence-001",
  artifact_identity: artifactIdentity,
  profile_ref: "profile/xhs_001",
  target_tab_id: 88,
  page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
  action_ref: "action/xhs.search/open_result_card"
});

const successRounds = (): CloseoutMultiRoundEvidenceRound[] => [
  successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-1"),
  successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-2")
];

describe("closeout multi-round verifier", () => {
  it("passes when two successful rounds are bound to the same latest head and current artifacts", () => {
    expect(
      verifyCloseoutMultiRoundEvidence({
        expected: expectedBinding(),
        evidence_rounds: successRounds()
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      accepted_round_count: 2,
      unique_artifact_count: 2,
      expected_artifact_observed: true,
      blockers: []
    });
  });

  it("accepts humanized_action for deterministic multi-round closeout evidence", () => {
    const rounds = successRounds().map((round) => ({
      ...round,
      evidence_class: "humanized_action"
    }));

    expect(
      verifyCloseoutMultiRoundEvidence({
        expected: expectedBinding(),
        evidence_rounds: rounds
      })
    ).toMatchObject({
      decision: "PASS",
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("requires exact artifact matching when only singular expected artifact_identity is provided", () => {
    const expected = expectedBinding();
    delete expected.artifact_identities;

    expect(
      verifyCloseoutMultiRoundEvidence({
        expected,
        evidence_rounds: successRounds()
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      accepted_round_count: 1,
      unique_artifact_count: 1,
      expected_artifact_observed: true,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_artifact"
        })
      ])
    });
  });

  it("rejects sibling round artifacts when only singular expected artifact_identity is provided", () => {
    const expected = expectedBinding();
    delete expected.artifact_identities;

    expect(
      verifyCloseoutMultiRoundEvidence({
        expected,
        evidence_rounds: [
          successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-2"),
          successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-3")
        ]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      accepted_round_count: 0,
      unique_artifact_count: 0,
      expected_artifact_observed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_artifact"
        })
      ])
    });
  });

  it("honors explicit artifact_identities without requiring the legacy singleton artifact", () => {
    const expected = {
      ...expectedBinding(),
      artifact_identity: "artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-2",
        "artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-3"
      ]
    };

    expect(
      verifyCloseoutMultiRoundEvidence({
        expected,
        evidence_rounds: [
          successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-2"),
          successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-3")
        ]
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      accepted_round_count: 2,
      unique_artifact_count: 2,
      expected_artifact_observed: true,
      blockers: []
    });
  });

  it("does not re-add legacy artifact_identity when explicit artifact_identities are supplied", () => {
    const expected = {
      ...expectedBinding(),
      artifact_identity: "artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-2",
        "artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-3"
      ]
    };

    expect(
      verifyCloseoutMultiRoundEvidence({
        expected,
        evidence_rounds: [
          successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-1"),
          successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-2")
        ]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_artifact"
        })
      ])
    });
  });

  it("rejects stale artifact identities when only singular expected artifact_identity is provided", () => {
    const expected = expectedBinding();
    delete expected.artifact_identities;

    expect(
      verifyCloseoutMultiRoundEvidence({
        expected,
        evidence_rounds: [
          successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-1"),
          successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-old/round-2")
        ]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_artifact"
        })
      ])
    });
  });

  it("rejects provider-scoped sibling artifacts when only singular expected artifact_identity is provided", () => {
    const expected: CloseoutMultiRoundExpectedBinding = {
      ...expectedBinding(),
      run_id: "gha:23953203650:1",
      artifact_identity: "gha:23953203650:1:live-evidence-round-1.log",
      artifact_identities: undefined
    };
    const firstRound = {
      ...successRound("gha:23953203650:1:live-evidence-round-1.log"),
      run_id: "gha:23953203650:1"
    };
    const secondRound = {
      ...successRound("gha:23953203650:1:live-evidence-round-2.log"),
      run_id: "gha:23953203650:1"
    };

    expect(
      verifyCloseoutMultiRoundEvidence({
        expected,
        evidence_rounds: [firstRound, secondRound]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      accepted_round_count: 1,
      unique_artifact_count: 1,
      expected_artifact_observed: true,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_artifact"
        })
      ])
    });
  });

  it("rejects provider-scoped artifacts from a different run when only singular artifact_identity is provided", () => {
    const expected: CloseoutMultiRoundExpectedBinding = {
      ...expectedBinding(),
      run_id: "gha:23953203650:1",
      artifact_identity: "gha:23953203650:1:live-evidence-round-1.log",
      artifact_identities: undefined
    };
    const firstRound = {
      ...successRound("gha:23953203650:1:live-evidence-round-1.log"),
      run_id: "gha:23953203650:1"
    };
    const staleArtifactRound = {
      ...successRound("gha:23953203650:0:live-evidence-round-2.log"),
      run_id: "gha:23953203650:1"
    };

    expect(
      verifyCloseoutMultiRoundEvidence({
        expected,
        evidence_rounds: [firstRound, staleArtifactRound]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_artifact"
        })
      ])
    });
  });

  it("rejects unrelated provider-scoped artifacts even when they share the expected run prefix", () => {
    const expected: CloseoutMultiRoundExpectedBinding = {
      ...expectedBinding(),
      run_id: "gha:23953203650:1",
      artifact_identity: "gha:23953203650:1:live-evidence-round-1.log",
      artifact_identities: undefined
    };
    const firstRound = {
      ...successRound("gha:23953203650:1:live-evidence-round-1.log"),
      run_id: "gha:23953203650:1"
    };
    const unrelatedArtifactRound = {
      ...successRound("gha:23953203650:1:unrelated-runtime-log.txt"),
      run_id: "gha:23953203650:1"
    };

    expect(
      verifyCloseoutMultiRoundEvidence({
        expected,
        evidence_rounds: [firstRound, unrelatedArtifactRound]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_artifact"
        })
      ])
    });
  });

  it("does not count duplicate artifact rounds as accepted evidence", () => {
    expect(
      verifyCloseoutMultiRoundEvidence({
        expected: expectedBinding(),
        evidence_rounds: [successRound(), successRound()]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      accepted_round_count: 1,
      unique_artifact_count: 1,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "missing_multi_round_evidence"
        })
      ])
    });
  });

  it("keeps reproduced_multi_round true when extra non-admitted evidence adds blockers", () => {
    const expected = {
      ...expectedBinding(),
      artifact_identities: [
        "artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-1",
        "artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-2",
        "artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-3"
      ]
    };

    expect(
      verifyCloseoutMultiRoundEvidence({
        expected,
        evidence_rounds: [
          ...successRounds(),
          {
            ...successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-3"),
            head_sha: "deadbeef"
          }
        ]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      reproduced_multi_round: true,
      accepted_round_count: 2,
      unique_artifact_count: 3,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_head"
        })
      ])
    });
  });

  it.each([
    {
      name: "single round",
      rounds: () => [successRound()],
      blocker_code: "missing_multi_round_evidence"
    },
    {
      name: "stale head",
      rounds: () => [
        successRound(),
        {
          ...successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-2"),
          head_sha: "deadbeef"
        }
      ],
      blocker_code: "stale_head"
    },
    {
      name: "stale run",
      rounds: () => [
        successRound(),
        {
          ...successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-2"),
          run_id: "run-closeout-evidence-old"
        }
      ],
      blocker_code: "stale_run"
    },
    {
      name: "old artifact",
      rounds: () => [
        successRound(),
        successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-old/round-2")
      ],
      blocker_code: "stale_artifact"
    },
    {
      name: "duplicate artifact",
      rounds: () => [successRound(), successRound()],
      blocker_code: "stale_artifact"
    },
    {
      name: "cross profile evidence",
      rounds: () => [
        successRound(),
        {
          ...successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-2"),
          profile_ref: "profile/xhs_other"
        }
      ],
      blocker_code: "missing_profile_binding"
    },
    {
      name: "cross tab evidence",
      rounds: () => [
        successRound(),
        {
          ...successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-2"),
          target_tab_id: 99
        }
      ],
      blocker_code: "missing_tab_binding"
    },
    {
      name: "cross page evidence",
      rounds: () => [
        successRound(),
        {
          ...successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-2"),
          page_url: "https://www.xiaohongshu.com/explore?keyword=other"
        }
      ],
      blocker_code: "missing_page_binding"
    },
    {
      name: "cross action evidence",
      rounds: () => [
        successRound(),
        {
          ...successRound("artifact/xhs-closeout-evidence/run-closeout-evidence-001/round-2"),
          action_ref: "action/xhs.search/other_action"
        }
      ],
      blocker_code: "missing_action_binding"
    },
    {
      name: "DOM state evidence",
      rounds: () =>
        successRounds().map((round) => ({
          ...round,
          evidence_class: "dom_state_extraction"
        })),
      blocker_code: "dom_state_not_full_closeout"
    },
    {
      name: "active fetch fallback evidence",
      rounds: () =>
        successRounds().map((round) => ({
          ...round,
          evidence_class: "active_api_fetch_fallback"
        })),
      blocker_code: "active_fetch_not_admitted"
    }
  ])("fails closed for $name", ({ rounds, blocker_code }) => {
    expect(
      verifyCloseoutMultiRoundEvidence({
        expected: expectedBinding(),
        evidence_rounds: rounds()
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      reproduced_multi_round: false,
      blockers: expect.arrayContaining([expect.objectContaining({ blocker_code })])
    });
  });
});
