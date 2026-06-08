import { describe, expect, it } from "vitest";

import { buildOfficialChromeLaunchEvidenceRecord } from "../official-chrome-launch-evidence.js";

const buildLaunchResult = (
  overrides: Partial<ReturnType<typeof buildLaunchResultBase>> = {}
) => ({
  ...buildLaunchResultBase(),
  ...overrides
});

const buildLaunchResultBase = () => ({
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

const buildReadyStatus = (runId = "run-official-launch-001") => ({
  profile: "private-profile",
  runId,
  profileState: "ready",
  lockHeld: true,
  identityBindingState: "bound",
  transportState: "ready",
  bootstrapState: "ready",
  runtimeReadiness: "ready",
  headless: false,
  executionSurface: "real_browser",
  runtimeTakeoverEvidence: {
    observedRunId: runId,
    ownerConflictFree: true,
    identityBound: true
  }
});

const buildPersistentRecord = (
  overrides: Partial<Parameters<typeof buildOfficialChromeLaunchEvidenceRecord>[0]> = {}
): ReturnType<typeof buildOfficialChromeLaunchEvidenceRecord> => {
  const runId = overrides.runId ?? "run-official-launch-default-001";
  return buildOfficialChromeLaunchEvidenceRecord({
    runId,
    commandRef: `command-envelope:${runId}`,
    providerId: "official-chrome.persistent",
    providerContractRef: "provider-contract:official-chrome.persistent:v1",
    providerContractVerified: true,
    browserChannelVerified: true,
    launchEnvelopeRef: `launch-envelope:${runId}:v1`,
    profileRef: "profile:private-profile",
    browserVersion: "Google Chrome 125.0.0.0",
    launchResult: buildLaunchResult(),
    runtimeStatus: buildReadyStatus(runId),
    persistentExtensionBinding: binding,
    ...overrides
  });
};

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
      providerContractVerified: true,
      browserChannelVerified: true,
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
      providerContractVerified: true,
      browserChannelVerified: true,
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
      providerContractVerified: true,
      browserChannelVerified: true,
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

  it("fails closed for headless launch evidence even when other refs are ready", () => {
    const record = buildOfficialChromeLaunchEvidenceRecord({
      runId: "run-official-launch-headless-001",
      commandRef: "command-envelope:run-official-launch-headless-001",
      providerId: "official-chrome.persistent",
      providerContractRef: "provider-contract:official-chrome.persistent:v1",
      providerContractVerified: true,
      browserChannelVerified: true,
      launchEnvelopeRef: "launch-envelope:run-official-launch-headless-001:v1",
      profileRef: "profile:private-profile",
      browserVersion: "Google Chrome 125.0.0.0",
      launchResult: buildLaunchResult({ headless: true }),
      runtimeStatus: buildReadyStatus(),
      persistentExtensionBinding: binding
    });

    expect(record.launch_arguments.browser_mode).toMatchObject({
      real_browser_required: true,
      headless: true
    });
    expect(record.closeout_plan.closeout_decision).toBe("deny");
    expect(record.closeout_plan.blocking_reasons).toEqual(
      expect.arrayContaining(["provider_limitation_conflict", "runtime_attestation_required"])
    );
    expect(record.closeout_plan.missing_evidence).toContain("real_browser_launch_evidence");
  });

  it("fails closed when launch evidence lacks explicit headed attestation", () => {
    const { headless: _headless, ...launchResultWithoutHeadless } = buildLaunchResult();
    const record = buildOfficialChromeLaunchEvidenceRecord({
      runId: "run-official-launch-headless-missing-001",
      commandRef: "command-envelope:run-official-launch-headless-missing-001",
      providerId: "official-chrome.persistent",
      providerContractRef: "provider-contract:official-chrome.persistent:v1",
      providerContractVerified: true,
      browserChannelVerified: true,
      launchEnvelopeRef: "launch-envelope:run-official-launch-headless-missing-001:v1",
      profileRef: "profile:private-profile",
      browserVersion: "Google Chrome 125.0.0.0",
      launchResult: launchResultWithoutHeadless,
      runtimeStatus: buildReadyStatus("run-official-launch-headless-missing-001"),
      persistentExtensionBinding: binding
    });

    expect(record.launch_arguments.browser_mode).toMatchObject({
      real_browser_required: true,
      headed: false,
      headless: false
    });
    expect(record.closeout_plan.closeout_decision).toBe("deny");
    expect(record.closeout_plan.blocking_reasons).toEqual(
      expect.arrayContaining(["provider_limitation_conflict", "runtime_attestation_required"])
    );
    expect(record.closeout_plan.missing_evidence).toContain("real_browser_launch_evidence");
    expect(record.closeout_plan.next_required_gates).toContain("real_browser_launch_attestation");
  });

  it("fails closed for non-real-browser launch evidence", () => {
    const record = buildOfficialChromeLaunchEvidenceRecord({
      runId: "run-official-launch-surface-001",
      commandRef: "command-envelope:run-official-launch-surface-001",
      providerId: "official-chrome.persistent",
      providerContractRef: "provider-contract:official-chrome.persistent:v1",
      providerContractVerified: true,
      browserChannelVerified: true,
      launchEnvelopeRef: "launch-envelope:run-official-launch-surface-001:v1",
      profileRef: "profile:private-profile",
      browserVersion: "Google Chrome 125.0.0.0",
      launchResult: buildLaunchResult({ executionSurface: "headless_browser" }),
      runtimeStatus: buildReadyStatus(),
      persistentExtensionBinding: binding
    });

    expect(record.closeout_plan.closeout_decision).toBe("deny");
    expect(record.closeout_plan.blocking_reasons).toEqual(
      expect.arrayContaining(["provider_limitation_conflict", "runtime_attestation_required"])
    );
    expect(record.closeout_plan.next_required_gates).toContain("real_browser_launch_attestation");
  });

  it("fails closed when persistent native messaging manifest ref is missing", () => {
    const record = buildOfficialChromeLaunchEvidenceRecord({
      runId: "run-official-launch-native-missing-001",
      commandRef: "command-envelope:run-official-launch-native-missing-001",
      providerId: "official-chrome.persistent",
      providerContractRef: "provider-contract:official-chrome.persistent:v1",
      providerContractVerified: true,
      browserChannelVerified: true,
      launchEnvelopeRef: "launch-envelope:run-official-launch-native-missing-001:v1",
      profileRef: "profile:private-profile",
      browserVersion: "Google Chrome 125.0.0.0",
      launchResult: buildLaunchResult(),
      runtimeStatus: buildReadyStatus(),
      persistentExtensionBinding: {
        ...binding,
        manifestPath: null
      }
    });

    expect(record.native_messaging_status.native_host_manifest_ref).toBeNull();
    expect(record.evidence_refs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "native_messaging_binding_ref",
          ref: "native-binding:missing",
          status: "unavailable",
          redaction_state: "redaction_required"
        })
      ])
    );
    expect(record.closeout_plan.closeout_decision).toBe("deny");
    expect(record.closeout_plan.blocking_reasons).toEqual(
      expect.arrayContaining(["evidence_ref_unavailable", "redaction_invalid"])
    );
    expect(record.closeout_plan.missing_evidence).toContain("native_messaging_binding_ref");
  });

  it("fails closed when provider contract ref is unverified or mismatched", () => {
    const cases = [
      {
        label: "unverified",
        providerContractRef: "provider-contract:official-chrome.persistent:v1",
        providerContractVerified: false
      },
      {
        label: "provider-mismatch",
        providerContractRef: "provider-contract:official-chrome.direct:v1",
        providerContractVerified: true
      },
      {
        label: "provider-prefix",
        providerContractRef: "provider-contract:official-chrome.persistent-preview:v1",
        providerContractVerified: true
      },
      {
        label: "provider-suffix",
        providerContractRef: "provider-contract:preview-official-chrome.persistent:v1",
        providerContractVerified: true
      },
      {
        label: "version-prefix",
        providerContractRef: "provider-contract:official-chrome.persistent:v10",
        providerContractVerified: true
      },
      {
        label: "extra-version-fragment",
        providerContractRef: "provider-contract:official-chrome.persistent:v1:previous-v1",
        providerContractVerified: true
      },
      {
        label: "wrong-prefix",
        providerContractRef: "provider-contract-ref:official-chrome.persistent:v1",
        providerContractVerified: true
      }
    ];

    for (const { label, providerContractRef, providerContractVerified } of cases) {
      const record = buildOfficialChromeLaunchEvidenceRecord({
        runId: `run-official-launch-contract-${label}-001`,
        commandRef: `command-envelope:run-official-launch-contract-${label}-001`,
        providerId: "official-chrome.persistent",
        providerContractRef,
        providerContractVerified,
        browserChannelVerified: true,
        launchEnvelopeRef: `launch-envelope:run-official-launch-contract-${label}-001:v1`,
        profileRef: "profile:private-profile",
        browserVersion: "Google Chrome 125.0.0.0",
        launchResult: buildLaunchResult(),
        runtimeStatus: buildReadyStatus(`run-official-launch-contract-${label}-001`),
        persistentExtensionBinding: binding
      });

      expect(record.closeout_plan.closeout_decision).toBe("deny");
      expect(record.closeout_plan.blocking_reasons).toEqual(
        expect.arrayContaining(["provider_contract_version_mismatch", "source_conflict"])
      );
      expect(record.closeout_plan.next_required_gates).toContain(
        "provider_contract_match_verification"
      );
      expect(record.evidence_refs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "provider_contract_ref",
            status: "partial"
          })
        ])
      );
    }
  });

  it("fails closed when the persistent profile is not locked by the current run", () => {
    const record = buildPersistentRecord({
      runId: "run-official-launch-unlocked-001",
      commandRef: "command-envelope:run-official-launch-unlocked-001",
      runtimeStatus: {
        ...buildReadyStatus(),
        lockHeld: false
      }
    });

    expect(record.profile_reference.profile_lock_status).toBe("unlocked");
    expect(record.closeout_plan.closeout_decision).toBe("deny");
    expect(record.closeout_plan.blocking_reasons).toContain("profile_lock_unavailable");
    expect(record.closeout_plan.missing_evidence).toContain("profile_lock_status");
    expect(record.closeout_plan.next_required_gates).toContain("profile_lock_attestation");
  });

  it("fails closed when profile lock evidence belongs to a different run", () => {
    const record = buildPersistentRecord({
      runId: "run-official-launch-current-001",
      commandRef: "command-envelope:run-official-launch-current-001",
      runtimeStatus: {
        ...buildReadyStatus("run-official-launch-foreign-001"),
        lockHeld: true
      }
    });

    expect(record.profile_reference.profile_lock_status).toBe("stale_or_disconnected");
    expect(record.closeout_plan.closeout_decision).toBe("deny");
    expect(record.closeout_plan.blocking_reasons).toContain("profile_lock_unavailable");
    expect(record.closeout_plan.missing_evidence).toContain("profile_lock_status");
    expect(record.closeout_plan.next_required_gates).toContain("profile_lock_attestation");
  });

  it("fails closed for Chromium and Chrome for Testing channel attestations", () => {
    const chromium = buildPersistentRecord({
      runId: "run-official-launch-chromium-001",
      commandRef: "command-envelope:run-official-launch-chromium-001",
      browserChannel: "Chromium",
      browserVersion: "Chromium 125.0.0.0"
    });
    const chromeForTesting = buildPersistentRecord({
      runId: "run-official-launch-cft-001",
      commandRef: "command-envelope:run-official-launch-cft-001",
      browserChannel: "Google Chrome stable",
      browserVersion: "Chrome for Testing 125.0.0.0"
    });
    const googleChromeForTesting = buildPersistentRecord({
      runId: "run-official-launch-google-cft-001",
      commandRef: "command-envelope:run-official-launch-google-cft-001",
      browserChannel: "Google Chrome stable",
      browserVersion: "Google Chrome for Testing 125.0.0.0"
    });
    const googleChromeDev = buildPersistentRecord({
      runId: "run-official-launch-google-dev-001",
      commandRef: "command-envelope:run-official-launch-google-dev-001",
      browserChannel: "Google Chrome stable",
      browserVersion: "Google Chrome Dev 125.0.0.0"
    });

    for (const record of [chromium, chromeForTesting, googleChromeForTesting, googleChromeDev]) {
      expect(record.closeout_plan.closeout_decision).toBe("deny");
      expect(record.closeout_plan.blocking_reasons).toEqual(
        expect.arrayContaining(["provider_limitation_conflict", "runtime_attestation_required"])
      );
      expect(record.closeout_plan.missing_evidence).toContain("google_chrome_stable_attestation");
      expect(record.closeout_plan.next_required_gates).toContain("browser_channel_attestation");
      expect(record.evidence_refs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "browser_channel_attestation",
            status: "partial"
          })
        ])
      );
    }
  });

  it("fails closed when Google Chrome stable channel is not verified", () => {
    const record = buildPersistentRecord({
      runId: "run-official-launch-channel-unverified-001",
      commandRef: "command-envelope:run-official-launch-channel-unverified-001",
      browserChannelVerified: false
    });

    expect(record.closeout_plan.closeout_decision).toBe("deny");
    expect(record.closeout_plan.blocking_reasons).toEqual(
      expect.arrayContaining(["provider_limitation_conflict", "runtime_attestation_required"])
    );
    expect(record.closeout_plan.missing_evidence).toContain("google_chrome_stable_attestation");
    expect(record.evidence_refs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "browser_channel_attestation",
          ref: "browser-channel:Google Chrome stable",
          status: "partial"
        })
      ])
    );
  });
});
