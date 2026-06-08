import { describe, expect, it } from "vitest";

import { buildOfficialChromeLaunchEvidenceRecord } from "../official-chrome-launch-evidence.js";

const buildLaunchResult = () => ({
  browserPath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  browserPid: 1234,
  controllerPid: 2345,
  launchArgs: [
    "--user-data-dir=/Users/example/Library/Application Support/WebEnvoy/private-profile",
    "--profile-directory=Default",
    "--lang=en-US",
    "about:blank"
  ],
  launchedAt: "2026-06-08T00:00:00.000Z",
  headless: false,
  executionSurface: "real_browser" as const,
  launchSurface: "macos_launchservices" as const,
  processOwnership: "external_persistent_app" as const
});

const buildReadyStatus = () => ({
  profile: "private-profile",
  runId: "run-official-launch-001",
  profileState: "ready",
  lockHeld: true,
  identityBindingState: "bound",
  transportState: "ready",
  bootstrapState: "ready",
  runtimeReadiness: "ready",
  headless: false,
  executionSurface: "real_browser"
});

const binding = {
  extensionId: "abcdefghijklmnopabcdefghijklmnop",
  nativeHostName: "com.webenvoy.host",
  browserChannel: "chrome" as const,
  manifestPath: "/Users/example/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.webenvoy.host.json"
};

describe("buildOfficialChromeLaunchEvidenceRecord", () => {
  it("maps official Chrome persistent launch data into provider evidence kernel v1", () => {
    const record = buildOfficialChromeLaunchEvidenceRecord({
      runId: "run-official-launch-001",
      commandRef: "command-envelope:run-official-launch-001",
      providerId: "official-chrome.persistent",
      providerContractRef: "provider-contract:official-chrome.persistent:v1",
      launchEnvelopeRef: "launch-envelope:run-official-launch-001:v1",
      profileRef: "/Users/example/Library/Application Support/WebEnvoy/private-profile",
      browserVersion: "Google Chrome 125.0.0.0",
      createdAt: "2026-06-08T00:00:00.000Z",
      collectedAt: "2026-06-08T00:00:01.000Z",
      launchResult: buildLaunchResult(),
      runtimeStatus: buildReadyStatus(),
      persistentExtensionBinding: binding,
      networkRegionalRef: "proxy://user:secret@example.invalid",
      fingerprintPolicyRef: "fingerprint-seed:private-value"
    });

    expect(record.identity.provider_evidence_contract_version).toBe("v1");
    expect(record.identity.evidence_scope).toBe("launch_admission");
    expect(record.selected_provider.provider_id).toBe("official-chrome.persistent");
    expect(record.launch_arguments.runtime_bindings).toEqual({
      extension_binding_mode: "persistent_profile_extension",
      native_messaging_mode: "required",
      runtime_bootstrap_required: true
    });
    expect(record.profile_reference.profile_lock_status).toBe("locked_by_current_run");
    expect(record.extension_status).toMatchObject({
      extension_required: true,
      extension_installation_status: "installed_in_profile",
      extension_runtime_status: "ready"
    });
    expect(record.native_messaging_status).toMatchObject({
      native_messaging_required: true,
      native_messaging_runtime_status: "ready"
    });
    expect(record.closeout_plan).toMatchObject({
      coverage_status: "complete",
      closeout_decision: "allow",
      blocking_reasons: []
    });
    expect(record.evidence_refs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "provider_contract_ref",
          source: "provider_contract",
          freshness: "current_record"
        }),
        expect.objectContaining({
          kind: "launch_config_snapshot",
          source: "runtime_admission",
          freshness: "current_launch",
          redaction_state: "redacted"
        }),
        expect.objectContaining({
          kind: "runtime_bootstrap_ref",
          source: "runtime_admission",
          status: "available"
        })
      ])
    );
  });

  it("fails closed when required persistent evidence is missing or unready", () => {
    const record = buildOfficialChromeLaunchEvidenceRecord({
      runId: "run-official-launch-002",
      commandRef: "command-envelope:run-official-launch-002",
      providerId: "official-chrome.persistent",
      providerContractRef: "provider-contract:official-chrome.persistent:v1",
      launchEnvelopeRef: "launch-envelope:run-official-launch-002:v1",
      profileRef: "profile:private-profile",
      createdAt: "2026-06-08T00:00:00.000Z",
      runtimeStatus: {
        profileState: "ready",
        lockHeld: true,
        identityBindingState: "missing",
        transportState: "not_connected",
        bootstrapState: "not_started",
        runtimeReadiness: "blocked"
      },
      launchResult: null,
      persistentExtensionBinding: null
    });

    expect(record.closeout_plan.closeout_decision).toBe("deny");
    expect(record.closeout_plan.blocking_reasons).toEqual(
      expect.arrayContaining([
        "launch_argument_snapshot_missing",
        "extension_status_unready",
        "native_messaging_status_unready",
        "version_evidence_missing",
        "redaction_invalid"
      ])
    );
    expect(record.closeout_plan.missing_evidence).toEqual(
      expect.arrayContaining([
        "launch_config_snapshot",
        "extension_binding_ref",
        "native_messaging_binding_ref",
        "runtime_bootstrap_ref",
        "browser_version"
      ])
    );
  });

  it("keeps private locators and raw launch arguments out of the evidence record", () => {
    const record = buildOfficialChromeLaunchEvidenceRecord({
      runId: "run-official-launch-003",
      commandRef: "command-envelope:run-official-launch-003",
      providerId: "official-chrome.persistent",
      providerContractRef: "provider-contract:official-chrome.persistent:v1",
      launchEnvelopeRef: "launch-envelope:run-official-launch-003:v1",
      profileRef: "/Users/example/Library/Application Support/WebEnvoy/private-profile",
      browserVersion: "Google Chrome 125.0.0.0",
      createdAt: "2026-06-08T00:00:00.000Z",
      launchResult: buildLaunchResult(),
      runtimeStatus: buildReadyStatus(),
      persistentExtensionBinding: binding
    });
    const serialized = JSON.stringify(record);

    expect(serialized).not.toContain("/Users/example");
    expect(serialized).not.toContain("--user-data-dir=");
    expect(serialized).not.toContain("NativeMessagingHosts");
    expect(record.launch_arguments.provider_launch_ref).toMatch(/^launch-snapshot:redacted:/);
    expect(record.profile_reference.profile_ref).toMatch(/^profile-ref:redacted:/);
    expect(record.native_messaging_status.native_host_manifest_ref).toMatch(
      /^native-manifest-ref:redacted:/
    );
  });
});
