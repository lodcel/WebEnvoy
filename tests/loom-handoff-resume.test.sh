#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

die() {
  echo "错误: $*" >&2
  exit 1
}

run_resume() {
  local target="$1"
  local output="$2"
  set +e
  PYTHONDONTWRITEBYTECODE=1 python3 "${target}/.loom/bin/loom_flow.py" flow resume --target "${target}" --item 706 >"${output}"
  local status=$?
  set -e
  return "${status}"
}

assert_jq() {
  local file="$1"
  local filter="$2"
  local message="$3"
  jq -e "${filter}" "${file}" >/dev/null || die "${message}"
}

set_recovery_field() {
  local target="$1"
  local label="$2"
  local value="$3"
  perl -0pi -e "s/^- \Q${label}\E: .*$/- ${label}: ${value}/m" "${target}/.loom/progress/706.md"
  perl -0pi -e "s/^- \Q${label}\E: .*$/- ${label}: ${value}/m" "${target}/.loom/status/current.md"
}

set_review_decision() {
  local target="$1"
  local decision="$2"
  local head="$3"
  local validation
  validation="$(awk -F': ' '/^- Latest Validation Summary:/ {print $2; exit}' "${target}/.loom/progress/706.md")"
  jq \
    --arg decision "${decision}" \
    --arg head "${head}" \
    --arg validation "${validation}" \
    '.decision=$decision
      | .summary=(if $decision == "allow" then "Implementation review approved." else .summary end)
      | .reviewer="loom-handoff-resume-test"
      | .reviewed_head=$head
      | .reviewed_validation_summary=$validation
      | .fallback_to=null
      | .findings=[]
      | .blocking_issues=[]
      | .follow_ups=[]' \
    "${target}/.loom/reviews/706.json" >"${target}/.loom/reviews/706.json.tmp"
  mv "${target}/.loom/reviews/706.json.tmp" "${target}/.loom/reviews/706.json"
}

commit_fixture_state() {
  local target="$1"
  git -C "${target}" add .
  git -C "${target}" commit -q -m "test: scenario state"
}

make_fixture() {
  local target
  target="$(mktemp -d "${TMPDIR:-/tmp}/webenvoy-loom-resume.XXXXXX")"
  mkdir -p "${target}"
  cp -R "${REPO_ROOT}/.loom" "${target}/.loom"
  rm -rf "${target}/.loom/runtime"
  cp -R "${REPO_ROOT}/.github" "${target}/.github"
  mkdir -p "${target}/scripts" "${target}/docs/dev"
  cp "${REPO_ROOT}/AGENTS.md" "${target}/AGENTS.md"
  cp "${REPO_ROOT}/code_review.md" "${target}/code_review.md"
  cp "${REPO_ROOT}/spec_review.md" "${target}/spec_review.md"
  cp "${REPO_ROOT}/docs/dev/AGENTS.md" "${target}/docs/dev/AGENTS.md"
  cp "${REPO_ROOT}/scripts/pr-guardian.sh" "${target}/scripts/pr-guardian.sh"
  cp "${REPO_ROOT}/scripts/merge-pr.sh" "${target}/scripts/merge-pr.sh"
  git -C "${target}" init -q -b work/706-loom-handoff-resume-recovery
  git -C "${target}" config user.email "loom-test@example.invalid"
  git -C "${target}" config user.name "loom test"
  git -C "${target}" remote add origin "https://github.com/MC-and-his-Agents/WebEnvoy.git"
  git -C "${target}" add .
  git -C "${target}" commit -q -m "test: fixture"
  printf '%s\n' "${target}"
}

main() {
  local fixture output head stale_head
  fixture="$(make_fixture)"
  output="${fixture}.resume.json"
  head="$(git -C "${fixture}" rev-parse HEAD)"
  stale_head="0000000000000000000000000000000000000000"

  run_resume "${fixture}" "${output}" || die "clean resume should pass before PR/review are required"
  assert_jq "${output}" '.result == "pass"' "clean resume did not pass"
  assert_jq "${output}" '.recovery_record.progress_authority == "GitHub Issues/Projects"' "progress authority drifted"
  assert_jq "${output}" '.recovery_record.pr_description_role == "human-readable evidence summary only"' "PR description became recovery authority"
  assert_jq "${output}" '.recovery_record.todo_role == "local implementation aid only"' "TODO role became project truth"
  assert_jq "${output}" '(.recovery_record | has("backlog") or has("sprint") or has("project_status") or has("issue_state") | not)' "recovery record created a second project state surface"

  cp -R "${fixture}" "${fixture}.missing-worktree"
  set_recovery_field "${fixture}.missing-worktree" "Workspace Entry" "missing-worktree"
  commit_fixture_state "${fixture}.missing-worktree"
  run_resume "${fixture}.missing-worktree" "${fixture}.missing-worktree.resume.json" && die "missing worktree should block"
  assert_jq "${fixture}.missing-worktree.resume.json" '.missing_inputs | map(tostring) | any(test("workspace"))' "missing worktree was not reported"

  cp -R "${fixture}" "${fixture}.missing-pr"
  set_recovery_field "${fixture}.missing-pr" "Current Checkpoint" "merge checkpoint"
  set_recovery_field "${fixture}.missing-pr" "Current Lane" "merge-ready"
  commit_fixture_state "${fixture}.missing-pr"
  set_review_decision "${fixture}.missing-pr" "allow" "$(git -C "${fixture}.missing-pr" rev-parse HEAD)"
  commit_fixture_state "${fixture}.missing-pr"
  run_resume "${fixture}.missing-pr" "${fixture}.missing-pr.resume.json" && die "missing PR should block at merge-ready checkpoint"
  assert_jq "${fixture}.missing-pr.resume.json" '.recovery_record.host_binding.pr.status == "required_missing"' "missing PR was not fail-closed"

  cp -R "${fixture}" "${fixture}.missing-review"
  set_recovery_field "${fixture}.missing-review" "Current Checkpoint" "merge checkpoint"
  set_recovery_field "${fixture}.missing-review" "Current Lane" "merge-ready"
  rm "${fixture}.missing-review/.loom/reviews/706.json"
  commit_fixture_state "${fixture}.missing-review"
  run_resume "${fixture}.missing-review" "${fixture}.missing-review.resume.json" && die "missing review record should block"
  assert_jq "${fixture}.missing-review.resume.json" '.recovery_record.authority_records.missing_inputs | map(tostring) | any(test("missing implementation review"))' "missing review record was not reported"

  cp -R "${fixture}" "${fixture}.stale-head"
  set_recovery_field "${fixture}.stale-head" "Current Checkpoint" "merge checkpoint"
  set_recovery_field "${fixture}.stale-head" "Current Lane" "merge-ready"
  commit_fixture_state "${fixture}.stale-head"
  set_review_decision "${fixture}.stale-head" "allow" "${stale_head}"
  commit_fixture_state "${fixture}.stale-head"
  run_resume "${fixture}.stale-head" "${fixture}.stale-head.resume.json" && die "stale review head should block"
  assert_jq "${fixture}.stale-head.resume.json" '.recovery_record.authority_records.missing_inputs | map(tostring) | any(test("review HEAD comparison failed|stale|different HEAD"))' "stale head was not reported"

  cp -R "${fixture}" "${fixture}.missing-merge-ready"
  set_recovery_field "${fixture}.missing-merge-ready" "Current Checkpoint" "merge checkpoint"
  set_recovery_field "${fixture}.missing-merge-ready" "Current Lane" "merge-ready"
  commit_fixture_state "${fixture}.missing-merge-ready"
  set_review_decision "${fixture}.missing-merge-ready" "allow" "$(git -C "${fixture}.missing-merge-ready" rev-parse HEAD)"
  commit_fixture_state "${fixture}.missing-merge-ready"
  run_resume "${fixture}.missing-merge-ready" "${fixture}.missing-merge-ready.resume.json" && die "missing merge-ready record should block"
  assert_jq "${fixture}.missing-merge-ready.resume.json" '.recovery_record.authority_records.merge_ready.result == "block"' "missing merge-ready record was not fail-closed"

  cp -R "${fixture}" "${fixture}.blocked"
  set_recovery_field "${fixture}.blocked" "Blockers" "Need explicit blocker proof."
  commit_fixture_state "${fixture}.blocked"
  run_resume "${fixture}.blocked" "${fixture}.blocked.resume.json" && die "blocked state should block"
  assert_jq "${fixture}.blocked.resume.json" '.state_check.result == "block" or (.missing_inputs | map(tostring) | any(test("blocker|Need explicit blocker")))' "blocked state was not reported"
}

main "$@"
