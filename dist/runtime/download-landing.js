import { createHash } from "node:crypto";
import { mkdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { CliError } from "../core/errors.js";
import { resolveRuntimeWorktreeRoot } from "./worktree-root.js";
const TRUSTED_DOWNLOAD_SEGMENTS = [".webenvoy", "downloads"];
const MAX_BROWSER_ARTIFACT_BYTES = 25 * 1024 * 1024;
const MAX_BROWSER_ARTIFACT_BASE64_CHARS = Math.ceil(MAX_BROWSER_ARTIFACT_BYTES / 3) * 4;
const DEFAULT_FILE_SYSTEM = {
    mkdir,
    realpath,
    stat,
    writeFile,
    rename,
    rm
};
const cliDownloadError = (reason, abilityId, stage = "execution") => new CliError(stage === "input_validation" ? "ERR_CLI_INVALID_ARGS" : "ERR_EXECUTION_FAILED", "Download artifact landing failed", {
    details: {
        ability_id: abilityId,
        stage,
        reason
    }
});
const isInsideDirectory = (baseDir, candidatePath) => {
    const relativePath = relative(baseDir, candidatePath);
    return (relativePath === "" ||
        (!relativePath.startsWith(`..${"/"}`) &&
            !relativePath.startsWith(`..${"\\"}`) &&
            relativePath !== ".." &&
            !isAbsolute(relativePath)));
};
const normalizeNativePath = (input) => input.startsWith("/private/var/") ? input.slice("/private".length) : input;
export const resolveTrustedDownloadBaseForContract = (cwd) => resolve(resolveRuntimeWorktreeRoot(cwd), ...TRUSTED_DOWNLOAD_SEGMENTS);
const resolveDestinationDirectory = (trustedBase, destinationRoot, abilityId) => {
    const destinationDir = destinationRoot === "." ? trustedBase : resolve(trustedBase, destinationRoot);
    if (!isInsideDirectory(trustedBase, destinationDir)) {
        throw cliDownloadError("DESTINATION_ROOT_ESCAPES_TRUSTED_BASE", abilityId, "input_validation");
    }
    return destinationDir;
};
const assertActualDirectoryInsideTrustedBase = async (input) => {
    const realTrustedBase = normalizeNativePath(await input.fs.realpath(input.trustedBase));
    const realDestinationDir = normalizeNativePath(await input.fs.realpath(input.destinationDir));
    const normalizedTrustedBase = normalizeNativePath(resolve(input.trustedBase));
    if (realTrustedBase !== normalizedTrustedBase) {
        throw cliDownloadError("TRUSTED_DOWNLOAD_BASE_SYMLINK_UNSUPPORTED", input.abilityId, "input_validation");
    }
    if (!isInsideDirectory(realTrustedBase, realDestinationDir)) {
        throw cliDownloadError("DESTINATION_ROOT_ESCAPES_TRUSTED_BASE", input.abilityId, "input_validation");
    }
    return {
        realTrustedBase,
        realDestinationDir
    };
};
const assertActualFileInsideTrustedBase = async (input) => {
    const realFinalPath = normalizeNativePath(await input.fs.realpath(input.finalPath));
    if (!isInsideDirectory(input.trustedBase, realFinalPath)) {
        await input.fs.rm(input.finalPath, { force: true }).catch(() => undefined);
        throw cliDownloadError("RESOLVED_OUTPUT_PATH_ESCAPES_TRUSTED_BASE", input.abilityId, "input_validation");
    }
};
const sanitizeFileName = (fileNameHint) => {
    const source = fileNameHint && fileNameHint.trim().length > 0 ? fileNameHint.trim() : "download.bin";
    const leaf = basename(source.replace(/\\/gu, "/"));
    const sanitized = leaf
        .replace(/\0/gu, "")
        .replace(/[^A-Za-z0-9._-]+/gu, "_")
        .replace(/^\.+/u, "")
        .slice(0, 180);
    return sanitized.length > 0 ? sanitized : "download.bin";
};
const sanitizeToken = (value) => {
    const sanitized = value.replace(/[^A-Za-z0-9._-]+/gu, "_").slice(0, 120);
    return sanitized.length > 0 ? sanitized : "run";
};
const splitFileName = (fileName) => {
    const dotIndex = fileName.lastIndexOf(".");
    if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
        return { stem: fileName, extension: "" };
    }
    return {
        stem: fileName.slice(0, dotIndex),
        extension: fileName.slice(dotIndex)
    };
};
const exists = async (fs, path) => {
    try {
        await fs.stat(path);
        return true;
    }
    catch {
        return false;
    }
};
const resolveFinalPath = async (input) => {
    const initialPath = resolve(input.destinationDir, input.fileName);
    if (!isInsideDirectory(input.destinationDir, initialPath)) {
        throw cliDownloadError("RESOLVED_OUTPUT_PATH_ESCAPES_TRUSTED_BASE", input.abilityId, "input_validation");
    }
    if (input.conflictPolicy === "replace_existing") {
        return initialPath;
    }
    if (!(await exists(input.fs, initialPath))) {
        return initialPath;
    }
    if (input.conflictPolicy === "fail_if_exists") {
        throw cliDownloadError("DOWNLOAD_ARTIFACT_ALREADY_EXISTS", input.abilityId);
    }
    const { stem, extension } = splitFileName(input.fileName);
    for (let index = 1; index <= 1000; index += 1) {
        const candidate = resolve(input.destinationDir, `${stem}-${index}${extension}`);
        if (!isInsideDirectory(input.destinationDir, candidate)) {
            throw cliDownloadError("RESOLVED_OUTPUT_PATH_ESCAPES_TRUSTED_BASE", input.abilityId, "input_validation");
        }
        if (!(await exists(input.fs, candidate))) {
            return candidate;
        }
    }
    throw cliDownloadError("DOWNLOAD_ARTIFACT_NAME_CONFLICT_EXHAUSTED", input.abilityId);
};
const decodeBrowserArtifactContent = (contentBase64, abilityId) => {
    const normalized = contentBase64.trim();
    if (normalized.length > MAX_BROWSER_ARTIFACT_BASE64_CHARS) {
        throw cliDownloadError("BROWSER_ARTIFACT_SIZE_INVALID", abilityId, "output_mapping");
    }
    if (normalized.length === 0 || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(normalized)) {
        throw cliDownloadError("BROWSER_ARTIFACT_CONTENT_INVALID", abilityId, "output_mapping");
    }
    const content = Buffer.from(normalized, "base64");
    if (content.length === 0 || content.length > MAX_BROWSER_ARTIFACT_BYTES) {
        throw cliDownloadError("BROWSER_ARTIFACT_SIZE_INVALID", abilityId, "output_mapping");
    }
    return content;
};
const buildArtifactRef = (runId, checksumSha256) => `download-artifact://${sanitizeToken(runId)}/${checksumSha256.slice(0, 16)}`;
export const landBrowserDownloadArtifactForContract = async (input) => {
    const artifact = input.target.browser_artifact;
    if (!artifact) {
        throw cliDownloadError("BROWSER_ARTIFACT_MISSING", input.request.ability_ref, "output_mapping");
    }
    const fs = input.fs ?? DEFAULT_FILE_SYSTEM;
    const trustedDownloadBase = resolveTrustedDownloadBaseForContract(input.cwd);
    const destinationDir = resolveDestinationDirectory(trustedDownloadBase, input.request.output_policy.destination_root, input.request.ability_ref);
    const fileName = sanitizeFileName(input.target.file_name_hint);
    const content = decodeBrowserArtifactContent(artifact.content_base64, input.request.ability_ref);
    const checksumSha256 = createHash("sha256").update(content).digest("hex");
    await fs.mkdir(destinationDir, { recursive: true });
    const { realTrustedBase, realDestinationDir } = await assertActualDirectoryInsideTrustedBase({
        fs,
        trustedBase: trustedDownloadBase,
        destinationDir,
        abilityId: input.request.ability_ref
    });
    const finalPath = await resolveFinalPath({
        fs,
        destinationDir: realDestinationDir,
        fileName,
        conflictPolicy: input.request.output_policy.conflict_policy,
        abilityId: input.request.ability_ref
    });
    const tempPath = resolve(realDestinationDir, `.${basename(finalPath)}.${sanitizeToken(input.runId)}.${process.pid}.tmp`);
    try {
        await fs.writeFile(tempPath, content, { flag: "wx" });
        await fs.rename(tempPath, finalPath);
    }
    catch (error) {
        await fs.rm(tempPath, { force: true }).catch(() => undefined);
        if (error instanceof CliError) {
            throw error;
        }
        throw cliDownloadError("DOWNLOAD_ARTIFACT_WRITE_FAILED", input.request.ability_ref);
    }
    await assertActualFileInsideTrustedBase({
        fs,
        trustedBase: realTrustedBase,
        finalPath,
        abilityId: input.request.ability_ref
    });
    const artifactRef = buildArtifactRef(input.runId, checksumSha256);
    return {
        resolvedOutputPath: finalPath,
        trustedDownloadBase,
        fileName: basename(finalPath),
        sizeBytes: content.length,
        checksumSha256,
        savedArtifactRefs: [artifactRef],
        audit: {
            run_id: input.runId,
            artifact_ref: artifactRef,
            path_inside_trusted_base: true,
            conflict_policy: input.request.output_policy.conflict_policy,
            replace_existing_audited: input.request.output_policy.conflict_policy === "replace_existing",
            checksum_sha256: checksumSha256,
            size_bytes: content.length,
            cleanup_performed_on_failure: false,
            leakage_check: "passed"
        }
    };
};
