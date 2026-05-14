import { spawn } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
const sleep = async (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});
const isProcessAlive = (pid) => {
    if (!Number.isInteger(pid) || pid <= 0) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
};
const resolveMacosAppBundlePath = (browserPath) => {
    const marker = ".app/Contents/MacOS/";
    const index = browserPath.indexOf(marker);
    if (index < 0) {
        return null;
    }
    return browserPath.slice(0, index + ".app".length);
};
const shouldUseMacosLaunchServices = (args) => {
    if (process.env.WEBENVOY_BROWSER_FORCE_LAUNCHSERVICES === "1") {
        return true;
    }
    return (process.platform === "darwin" &&
        !args.launchArgs.includes("--headless=new") &&
        resolveMacosAppBundlePath(args.browserPath) !== null);
};
const buildBrowserSpawn = (args) => {
    if (!shouldUseMacosLaunchServices(args)) {
        return {
            file: args.browserPath,
            args: args.launchArgs,
            kind: "direct"
        };
    }
    const openPath = process.env.WEBENVOY_OPEN_PATH?.trim() || "/usr/bin/open";
    const appBundlePath = resolveMacosAppBundlePath(args.browserPath) ?? args.browserPath;
    return {
        file: openPath,
        args: ["-a", appBundlePath, "--args", ...args.launchArgs],
        kind: "macos_launchservices"
    };
};
const resolveBrowserPid = async (browser) => {
    const rawBrowserPid = browser.pid;
    if (typeof rawBrowserPid !== "number" || !Number.isInteger(rawBrowserPid) || rawBrowserPid <= 0) {
        throw new Error("failed to spawn browser child");
    }
    return rawBrowserPid;
};
const deleteFileQuietly = async (path) => {
    try {
        await unlink(path);
    }
    catch (error) {
        const nodeError = error;
        if (nodeError.code !== "ENOENT") {
            throw error;
        }
    }
};
const parseSupervisorArgs = (argv) => {
    const read = (name) => {
        const index = argv.indexOf(name);
        if (index < 0 || index + 1 >= argv.length) {
            throw new Error(`missing argument: ${name}`);
        }
        const value = argv[index + 1];
        if (value.trim().length === 0) {
            throw new Error(`empty argument: ${name}`);
        }
        return value;
    };
    const launchArgs = JSON.parse(Buffer.from(read("--launch-args-b64"), "base64").toString("utf8"));
    if (!Array.isArray(launchArgs) || !launchArgs.every((item) => typeof item === "string")) {
        throw new Error("invalid --launch-args-b64 payload");
    }
    return {
        browserPath: read("--browser-path"),
        launchArgs,
        stateFilePath: read("--state-file"),
        controlFilePath: read("--control-file"),
        launchToken: read("--launch-token"),
        profileDir: read("--profile-dir"),
        runId: read("--run-id")
    };
};
const readShutdownCommand = async (path) => {
    try {
        const raw = await readFile(path, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed.action !== "shutdown" || typeof parsed.launchToken !== "string") {
            return null;
        }
        return {
            action: "shutdown",
            launchToken: parsed.launchToken
        };
    }
    catch (error) {
        const nodeError = error;
        if (nodeError.code === "ENOENT") {
            return null;
        }
        return null;
    }
};
const run = async () => {
    const args = parseSupervisorArgs(process.argv.slice(2));
    await mkdir(dirname(args.stateFilePath), { recursive: true });
    await mkdir(dirname(args.controlFilePath), { recursive: true });
    await deleteFileQuietly(args.stateFilePath);
    await deleteFileQuietly(args.controlFilePath);
    const browserSpawn = buildBrowserSpawn(args);
    const browser = spawn(browserSpawn.file, browserSpawn.args, {
        detached: false,
        stdio: "ignore"
    });
    browser.unref();
    const browserPid = await resolveBrowserPid(browser);
    const launchSurface = browserSpawn.kind === "macos_launchservices" ? "macos_launchservices" : "direct_spawn";
    const processOwnership = browserSpawn.kind === "macos_launchservices" ? "external_persistent_app" : "owned_child";
    const state = {
        schemaVersion: 1,
        launchToken: args.launchToken,
        profileDir: args.profileDir,
        runId: args.runId,
        browserPath: args.browserPath,
        controllerPid: process.pid,
        browserPid,
        launchedAt: new Date().toISOString(),
        headless: args.launchArgs.includes("--headless=new"),
        executionSurface: args.launchArgs.includes("--headless=new")
            ? "headless_browser"
            : "real_browser",
        launchSurface,
        processOwnership
    };
    await writeFile(args.stateFilePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    let shuttingDown = false;
    const finalize = async () => {
        await deleteFileQuietly(args.stateFilePath);
        await deleteFileQuietly(args.controlFilePath);
    };
    const terminateBrowser = async () => {
        if (processOwnership === "external_persistent_app") {
            return;
        }
        if (!isProcessAlive(browserPid)) {
            return;
        }
        try {
            process.kill(browserPid, "SIGTERM");
        }
        catch (error) {
            const nodeError = error;
            if (nodeError.code !== "ESRCH") {
                throw error;
            }
            return;
        }
        for (let attempt = 0; attempt < 20; attempt += 1) {
            if (!isProcessAlive(browserPid)) {
                return;
            }
            await sleep(100);
        }
        if (!isProcessAlive(browserPid)) {
            return;
        }
        try {
            process.kill(browserPid, "SIGKILL");
        }
        catch (error) {
            const nodeError = error;
            if (nodeError.code !== "ESRCH") {
                throw error;
            }
        }
    };
    const shutdown = async (exitCode) => {
        if (shuttingDown) {
            return;
        }
        shuttingDown = true;
        try {
            await terminateBrowser();
            await finalize();
            process.exit(exitCode);
        }
        catch {
            process.exit(1);
        }
    };
    browser.once("error", async () => {
        await shutdown(1);
    });
    browser.once("exit", async (code) => {
        if (browserSpawn.kind === "direct" || code !== 0) {
            await shutdown(code === 0 || code === null ? 0 : 1);
        }
    });
    process.on("SIGTERM", () => {
        void shutdown(0);
    });
    process.on("SIGINT", () => {
        void shutdown(0);
    });
    while (!shuttingDown) {
        const command = await readShutdownCommand(args.controlFilePath);
        if (command && command.launchToken === args.launchToken) {
            await shutdown(0);
            return;
        }
        await sleep(100);
    }
};
void run().catch(async () => {
    process.exit(1);
});
