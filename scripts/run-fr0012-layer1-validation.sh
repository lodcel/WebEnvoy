#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

echo "[FR-0012] Layer 1 fingerprint/profile consistency validation baseline"
echo "[FR-0012] Scope: #736 -> #235 -> #265"
echo "[FR-0012] Deterministic gate covers profile bundle persistence, patch manifest wiring,"
echo "[FR-0012] profile/environment fail-closed behavior, launch-surface audit, and extension"
echo "[FR-0012] fingerprint patch contracts."
echo "[FR-0012] This baseline intentionally avoids build emission so it can be used as a"
echo "[FR-0012] repeatable regression gate without producing unrelated generated dist diffs."
echo "[FR-0012] Deferred boundaries are not claimed as complete: permissions API (#799),"
echo "[FR-0012] WebGL renderer/vendor (#801), worker/service-worker fingerprint coverage (#802),"
echo "[FR-0012] full client hints control, timezone/locale launch control, and WebRTC/network masking."

run_step() {
  local label="$1"
  shift
  echo
  echo "[FR-0012] >>> ${label}"
  "$@"
}

VITEST_FILES=(
  "src/runtime/__tests__/profile-store.test.ts"
  "src/runtime/__tests__/profile-store-linux-compat.test.ts"
  "src/runtime/__tests__/profile-runtime.test.ts"
  "src/runtime/__tests__/browser-launcher.test.ts"
  "src/runtime/__tests__/fingerprint-runtime.test.ts"
  "src/runtime/__tests__/anti-detection-validation.test.ts"
  "tests/main-world-bridge.contract.test.ts"
  "tests/content-script-handler.contract.test.ts"
  "tests/content-script.contract.test.ts"
  "tests/extension.contract.test.ts"
  "tests/extension.service-worker.contract.test.ts"
  "tests/fingerprint-runtime.integration.test.ts"
)

if [[ "${WEBENVOY_FR0012_REAL_BROWSER:-0}" == "1" ]]; then
  export WEBENVOY_REAL_BROWSER_TEST=1
  echo "[FR-0012] Optional real-browser integration is enabled via WEBENVOY_FR0012_REAL_BROWSER=1."
  echo "[FR-0012] The caller must provide the same readiness/admission evidence required by repo policy."
else
  unset WEBENVOY_REAL_BROWSER_TEST
  echo "[FR-0012] Optional real-browser integration is disabled. This run does not claim live/browser"
  echo "[FR-0012] detection-site evidence; skipped tests remain an explicit closeout boundary."
fi

run_step "runtime typecheck" npm run typecheck:runtime
run_step "extension typecheck" npm run typecheck:extension
run_step "targeted FR-0012 vitest baseline" npx vitest run "${VITEST_FILES[@]}"

echo
echo "[FR-0012] Validation baseline completed."
