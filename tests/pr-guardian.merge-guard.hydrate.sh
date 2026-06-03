test_hydrate_dependencies_skips_when_target_node_modules_is_directory() {
  setup_hydrate_fixture "hydrate-skip-existing-directory"

  mkdir -p "${REPO_ROOT}/node_modules"
  mkdir -p "${WORKTREE_DIR}/node_modules"
  printf '%s\n' '{}' > "${WORKTREE_DIR}/package-lock.json"

  assert_pass hydrate_worktree_dependencies
  [[ -d "${WORKTREE_DIR}/node_modules" ]] || {
    echo "expected node_modules directory to remain" >&2
    exit 1
  }
  if [[ -L "${WORKTREE_DIR}/node_modules" ]]; then
    echo "did not expect node_modules to become symlink" >&2
    exit 1
  fi
  assert_file_empty "${MOCK_NPM_CALLS_LOG}"
}

test_hydrate_dependencies_links_repo_node_modules_when_lockfile_exists() {
  setup_hydrate_fixture "hydrate-lockfile-link-source-node-modules"

  mkdir -p "${REPO_ROOT}/node_modules"
  printf '%s\n' '{}' > "${WORKTREE_DIR}/package-lock.json"

  assert_pass hydrate_worktree_dependencies
  [[ -L "${WORKTREE_DIR}/node_modules" ]] || {
    echo "expected node_modules symlink fallback when lockfile exists" >&2
    exit 1
  }
  local linked_path
  linked_path="$(readlink "${WORKTREE_DIR}/node_modules")"
  if [[ "${linked_path}" != "${REPO_ROOT}/node_modules" ]]; then
    echo "unexpected symlink target: ${linked_path}" >&2
    exit 1
  fi
  assert_file_empty "${MOCK_NPM_CALLS_LOG}"
}

test_hydrate_dependencies_links_repo_node_modules_when_lockfile_missing() {
  setup_hydrate_fixture "hydrate-link-source-node-modules"

  mkdir -p "${REPO_ROOT}/node_modules"

  assert_pass hydrate_worktree_dependencies
  [[ -L "${WORKTREE_DIR}/node_modules" ]] || {
    echo "expected node_modules symlink in worktree" >&2
    exit 1
  }
  local linked_path
  linked_path="$(readlink "${WORKTREE_DIR}/node_modules")"
  if [[ "${linked_path}" != "${REPO_ROOT}/node_modules" ]]; then
    echo "unexpected symlink target: ${linked_path}" >&2
    exit 1
  fi
  assert_file_empty "${MOCK_NPM_CALLS_LOG}"
}

test_hydrate_dependencies_noop_when_no_lockfile_and_no_source_node_modules() {
  setup_hydrate_fixture "hydrate-no-source-node-modules"

  assert_pass hydrate_worktree_dependencies
  if [[ -e "${WORKTREE_DIR}/node_modules" ]]; then
    echo "did not expect node_modules to exist" >&2
    exit 1
  fi
  assert_file_empty "${MOCK_NPM_CALLS_LOG}"
}

test_hydrate_dependencies_falls_back_when_npm_missing() {
  setup_hydrate_fixture "hydrate-lockfile-npm-missing"

  mkdir -p "${REPO_ROOT}/node_modules"
  printf '%s\n' '{}' > "${WORKTREE_DIR}/package-lock.json"

  local original_path="${PATH}"
  local no_npm_bin="${TEST_TMP_DIR}/bin-no-npm"
  mkdir -p "${no_npm_bin}"
  PATH="${no_npm_bin}:/usr/bin:/bin"

  assert_pass hydrate_worktree_dependencies
  PATH="${original_path}"

  [[ -L "${WORKTREE_DIR}/node_modules" ]] || {
    echo "expected node_modules symlink fallback when npm is missing" >&2
    exit 1
  }
  local linked_path
  linked_path="$(readlink "${WORKTREE_DIR}/node_modules")"
  if [[ "${linked_path}" != "${REPO_ROOT}/node_modules" ]]; then
    echo "unexpected symlink target: ${linked_path}" >&2
    exit 1
  fi
  assert_file_empty "${MOCK_NPM_CALLS_LOG}"
}

test_hydrate_dependencies_falls_back_when_npm_ci_fails() {
  setup_hydrate_fixture "hydrate-lockfile-npm-ci-fails"

  mkdir -p "${REPO_ROOT}/node_modules"
  printf '%s\n' '{}' > "${WORKTREE_DIR}/package-lock.json"
  MOCK_NPM_FORCE_CI_FAIL=1
  export MOCK_NPM_FORCE_CI_FAIL

  assert_pass hydrate_worktree_dependencies
  unset MOCK_NPM_FORCE_CI_FAIL || true

  [[ -L "${WORKTREE_DIR}/node_modules" ]] || {
    echo "expected node_modules symlink fallback when npm ci fails" >&2
    exit 1
  }
  local linked_path
  linked_path="$(readlink "${WORKTREE_DIR}/node_modules")"
  if [[ "${linked_path}" != "${REPO_ROOT}/node_modules" ]]; then
    echo "unexpected symlink target: ${linked_path}" >&2
    exit 1
  fi
  assert_file_empty "${MOCK_NPM_CALLS_LOG}"
}

setup_merge_if_safe_fixture() {
  local case_name="$1"
  local pr_author="$2"
  local reviewer="$3"
  local review_state="$4"
  local review_commit="$5"
  local require_paginate="${6:-0}"

  setup_case_dir "${case_name}"

  HEAD_SHA="head-sha-123"
  BASE_REF="main"
  BASE_SHA="base-sha-123"
  MERGE_BASE_SHA="merge-base-sha-123"
  REVIEW_PROFILE="high_risk_impl_profile"
  REVIEW_BASIS_DIGEST="review-basis-digest-123"
  PROMPT_DIGEST="prompt-digest-123"
  PR_NUMBER="274"
  export HEAD_SHA BASE_REF BASE_SHA MERGE_BASE_SHA REVIEW_PROFILE REVIEW_BASIS_DIGEST PROMPT_DIGEST PR_NUMBER

  RESULT_FILE="${TMP_DIR}/review.json"
  LOOM_REVIEW_RECORD_FILE="${TMP_DIR}/loom-review-record.json"
  SPEC_LOOM_REVIEW_RECORD_FILE="${TMP_DIR}/loom-spec-review-record.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  printf '%s\n' '{"verdict":"APPROVE","safe_to_merge":true,"summary":"summary","findings":[],"required_actions":[]}' > "${RESULT_FILE}"
  write_loom_review_record_from_guardian_result "${RESULT_FILE}" "${LOOM_REVIEW_RECORD_FILE}"
  export RESULT_FILE LOOM_REVIEW_RECORD_FILE SPEC_LOOM_REVIEW_RECORD_FILE REVIEW_MD_FILE

  MOCK_GH_USER_LOGIN="${reviewer}"
  export MOCK_GH_USER_LOGIN

  PR_AUTHOR="${pr_author}"
  export PR_AUTHOR

  MOCK_GH_PR_VIEW_JSON="${TEST_TMP_DIR}/${case_name}/mock/pr-view.json"
  cat > "${MOCK_GH_PR_VIEW_JSON}" <<'EOF'
{
  "baseRefName": "main",
  "baseRefOid": "base-sha-123",
  "headRefName": "work/mock",
  "headRefOid": "head-sha-123",
  "mergeable": "MERGEABLE",
  "mergeStateStatus": "CLEAN",
  "isDraft": false,
  "body": "integration_check:\n  integration_applicable: no\n  integration_touchpoint: none\n  integration_ref: none\n  shared_contract_changed: no\n  external_dependency: none\n  merge_gate: local_only\n  contract_surface: none\n  joint_acceptance_needed: no\n  integration_status_checked_before_pr: yes\n  integration_status_checked_before_merge: yes\n\ngate_applicability:\n  review_lane: general_pr\n  governance_context_issue_ref: N/A\n  governance_scope_targets: N/A\n  in_scope: false\n  trigger_reasons: N/A\n  n_a_allowed: true\n\nlive_evidence_record: N/A\n\ncloseout_control:\n  issue_type: implementation\n  readiness_admission_status: static_and_gate_ready\n  readiness_matrix: N/A\n  live_validation_ladder: static tests\n  closeout_evidence: local validation\n  fallback_limitations: N/A\n  blocker_split_handling: N/A\n"
}
EOF
  export MOCK_GH_PR_VIEW_JSON

  MOCK_GH_CHECKS_JSON="${TEST_TMP_DIR}/${case_name}/mock/checks.json"
  printf '%s\n' '[{"name":"Run Tests","bucket":"pass","state":"SUCCESS","link":"https://example.test/tests"}]' > "${MOCK_GH_CHECKS_JSON}"
  export MOCK_GH_CHECKS_JSON

  MOCK_GH_REVIEWS_JSON="${TEST_TMP_DIR}/${case_name}/mock/reviews.json"
  printf '[[{"user":{"login":"%s"},"commit_id":"%s","state":"%s"}]]\n' "${reviewer}" "${review_commit}" "${review_state}" > "${MOCK_GH_REVIEWS_JSON}"
  export MOCK_GH_REVIEWS_JSON

  seed_repo_bootstrap_manifest_fixture

  if [[ "${require_paginate}" == "1" ]]; then
    MOCK_GH_REVIEWS_REQUIRE_PAGINATE=1
    export MOCK_GH_REVIEWS_REQUIRE_PAGINATE

    MOCK_GH_REVIEWS_FIRST_PAGE_JSON="${TEST_TMP_DIR}/${case_name}/mock/reviews-page-1.json"
    printf '%s\n' '[[{"user":{"login":"other-reviewer"},"commit_id":"older-sha","state":"APPROVED"}]]' > "${MOCK_GH_REVIEWS_FIRST_PAGE_JSON}"
    export MOCK_GH_REVIEWS_FIRST_PAGE_JSON
  fi
}
