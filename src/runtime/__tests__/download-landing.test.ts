import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  landBrowserDownloadArtifactForContract,
  resolveTrustedDownloadBaseForContract
} from "../download-landing.js";
import type {
  DownloadAbilityRequest,
  DownloadBrowserTarget
} from "../../core/download-ability.js";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

const createTempCwd = async (): Promise<string> => {
  const cwd = await mkdtemp(join(tmpdir(), "webenvoy-download-landing-"));
  tempDirs.push(cwd);
  return cwd;
};

const createRequest = (
  conflictPolicy: DownloadAbilityRequest["output_policy"]["conflict_policy"] = "rename_with_suffix"
): DownloadAbilityRequest => ({
  ability_ref: "generic.file.download.v1",
  download_source: {
    source_kind: "page_derived",
    derive_mode: "export_flow",
    trigger_hint: "click export"
  },
  profile_ref: "profile/default",
  download_goal: "single_file",
  output_policy: {
    destination_root: "exports/reports",
    file_name_policy: "preserve_source_name",
    conflict_policy: conflictPolicy
  },
  requested_execution_layer: "L2"
});

const createTarget = (fileNameHint = "report.pdf"): DownloadBrowserTarget => ({
  target_ref: "download-link",
  source_kind: "page_derived",
  source_url: "https://example.com/export/report.pdf?token=secret",
  file_name_hint: fileNameHint,
  content_descriptor: {
    content_kind: "file",
    mime_type: "application/pdf"
  },
  browser_artifact: {
    content_base64: Buffer.from("download artifact\n", "utf8").toString("base64")
  },
  trigger_status: "resolved",
  trigger_mode: "resolve_only",
  trigger_surface: "dom_button"
});

describe("download artifact landing", () => {
  it("lands browser-produced bytes inside the trusted download base with checksum refs", async () => {
    const cwd = await createTempCwd();
    const result = await landBrowserDownloadArtifactForContract({
      cwd,
      runId: "run-download-landing-001",
      request: createRequest(),
      target: createTarget()
    });

    expect(result.resolvedOutputPath).toContain(
      join(".webenvoy", "downloads", "exports", "reports", "report.pdf")
    );
    expect(result.resolvedOutputPath.startsWith(resolveTrustedDownloadBaseForContract(cwd))).toBe(true);
    expect(await readFile(result.resolvedOutputPath, "utf8")).toBe("download artifact\n");
    expect(result.checksumSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.savedArtifactRefs).toEqual([
      `download-artifact://run-download-landing-001/${result.checksumSha256.slice(0, 16)}`
    ]);
    expect(JSON.stringify(result.audit)).not.toContain("token=secret");
  });

  it("renames conflicting files when requested", async () => {
    const cwd = await createTempCwd();
    const existingPath = join(
      resolveTrustedDownloadBaseForContract(cwd),
      "exports",
      "reports",
      "report.pdf"
    );
    await mkdir(join(resolveTrustedDownloadBaseForContract(cwd), "exports", "reports"), {
      recursive: true
    });
    await writeFile(existingPath, "existing\n", "utf8");

    const result = await landBrowserDownloadArtifactForContract({
      cwd,
      runId: "run-download-landing-rename",
      request: createRequest("rename_with_suffix"),
      target: createTarget()
    });

    expect(result.fileName).toBe("report-1.pdf");
    expect(await readFile(result.resolvedOutputPath, "utf8")).toBe("download artifact\n");
  });

  it("rejects fail_if_exists conflicts before claiming a downloaded result", async () => {
    const cwd = await createTempCwd();
    await landBrowserDownloadArtifactForContract({
      cwd,
      runId: "run-download-landing-initial",
      request: createRequest("fail_if_exists"),
      target: createTarget()
    });

    await expect(
      landBrowserDownloadArtifactForContract({
        cwd,
        runId: "run-download-landing-conflict",
        request: createRequest("fail_if_exists"),
        target: createTarget()
      })
    ).rejects.toMatchObject({
      code: "ERR_EXECUTION_FAILED",
      details: {
        reason: "DOWNLOAD_ARTIFACT_ALREADY_EXISTS"
      }
    });
  });

  it("keeps unsafe file name hints inside the trusted base", async () => {
    const cwd = await createTempCwd();
    const result = await landBrowserDownloadArtifactForContract({
      cwd,
      runId: "run-download-landing-sanitize",
      request: createRequest(),
      target: createTarget("../../outside.pdf")
    });

    expect(result.fileName).toBe("outside.pdf");
    expect(result.resolvedOutputPath.startsWith(resolveTrustedDownloadBaseForContract(cwd))).toBe(true);
  });

  it("rejects trusted-base symlink escapes before writing bytes", async () => {
    const cwd = await createTempCwd();
    const outside = await createTempCwd();
    await mkdir(join(cwd, ".webenvoy"), { recursive: true });
    await symlink(outside, resolveTrustedDownloadBaseForContract(cwd), "dir");

    await expect(
      landBrowserDownloadArtifactForContract({
        cwd,
        runId: "run-download-landing-symlink",
        request: createRequest(),
        target: createTarget()
      })
    ).rejects.toMatchObject({
      code: "ERR_CLI_INVALID_ARGS",
      details: {
        reason: "TRUSTED_DOWNLOAD_BASE_SYMLINK_UNSUPPORTED"
      }
    });
  });

  it("rejects destination-root symlink escapes before writing bytes", async () => {
    const cwd = await createTempCwd();
    const outside = await createTempCwd();
    const trustedBase = resolveTrustedDownloadBaseForContract(cwd);
    await mkdir(join(trustedBase, "exports"), { recursive: true });
    await symlink(outside, join(trustedBase, "exports", "reports"), "dir");

    await expect(
      landBrowserDownloadArtifactForContract({
        cwd,
        runId: "run-download-landing-destination-symlink",
        request: createRequest(),
        target: createTarget()
      })
    ).rejects.toMatchObject({
      code: "ERR_CLI_INVALID_ARGS",
      details: {
        reason: "DESTINATION_ROOT_ESCAPES_TRUSTED_BASE"
      }
    });
  });

  it("rejects oversized base64 payloads before writing bytes", async () => {
    const cwd = await createTempCwd();
    const writes: string[] = [];
    const maxBase64Chars = Math.ceil((25 * 1024 * 1024) / 3) * 4;
    const target = createTarget();
    target.browser_artifact = {
      content_base64: "A".repeat(maxBase64Chars + 4)
    };
    const fs = {
      mkdir: async () => undefined,
      realpath: async (path: string) => path,
      stat: async () => {
        throw new Error("missing");
      },
      writeFile: async (path: string) => {
        writes.push(path);
      },
      rename: async () => undefined,
      rm: async () => undefined
    };

    await expect(
      landBrowserDownloadArtifactForContract({
        cwd,
        runId: "run-download-landing-oversized",
        request: createRequest(),
        target,
        fs
      })
    ).rejects.toMatchObject({
      code: "ERR_EXECUTION_FAILED",
      details: {
        reason: "BROWSER_ARTIFACT_SIZE_INVALID"
      }
    });
    expect(writes).toHaveLength(0);
  });

  it("cleans temporary files when final rename fails", async () => {
    const cwd = await createTempCwd();
    const writes: string[] = [];
    const removed: string[] = [];
    const fs = {
      mkdir: async () => undefined,
      realpath: async (path: string) => path,
      stat: async () => {
        throw new Error("missing");
      },
      writeFile: async (path: string) => {
        writes.push(path);
      },
      rename: async () => {
        throw new Error("rename failed");
      },
      rm: async (path: string) => {
        removed.push(path);
      }
    };

    await expect(
      landBrowserDownloadArtifactForContract({
        cwd,
        runId: "run-download-landing-cleanup",
        request: createRequest(),
        target: createTarget(),
        fs
      })
    ).rejects.toMatchObject({
      code: "ERR_EXECUTION_FAILED",
      details: {
        reason: "DOWNLOAD_ARTIFACT_WRITE_FAILED"
      }
    });
    expect(writes).toHaveLength(1);
    expect(removed).toEqual(writes);
  });
});
