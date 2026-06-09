#!/usr/bin/env bash

set -euo pipefail

user_data_dir=""
is_version_probe="0"
for arg in "$@"; do
  case "$arg" in
    --version)
      is_version_probe="1"
      ;;
    --user-data-dir=*)
      user_data_dir="${arg#--user-data-dir=}"
      ;;
  esac
done

if [[ -n "$user_data_dir" ]]; then
  mkdir -p "$user_data_dir/Default"
  printf '{}' > "$user_data_dir/Local State"
  printf '{}' > "$user_data_dir/Default/Preferences"
fi

if [[ -n "${WEBENVOY_BROWSER_MOCK_LOG:-}" ]]; then
  printf '{"pid":%d,"args":"%s"}\n' "$$" "$*" >> "${WEBENVOY_BROWSER_MOCK_LOG}"
fi

if [[ "$is_version_probe" == "1" ]]; then
  version="${WEBENVOY_BROWSER_MOCK_VERSION:-Chromium 146.0.0.0}"
  printf '%s\n' "$version"
  exit 0
fi

ttl="${WEBENVOY_BROWSER_MOCK_TTL:-2}"
trap 'exit 0' TERM INT
if [[ "${WEBENVOY_BROWSER_MOCK_CDP:-0}" == "1" && -n "$user_data_dir" ]]; then
  WEBENVOY_BROWSER_MOCK_USER_DATA_DIR="$user_data_dir" \
  WEBENVOY_BROWSER_MOCK_TTL="$ttl" \
  node >/dev/null 2>/dev/null <<'NODE'
const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const profileDir = process.env.WEBENVOY_BROWSER_MOCK_USER_DATA_DIR;
const ttlMs = Math.max(1, Number.parseInt(process.env.WEBENVOY_BROWSER_MOCK_TTL || "2", 10)) * 1000;
const extensionId = process.env.WEBENVOY_BROWSER_MOCK_EXTENSION_ID || "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const scriptPath = "build/background.js";
const scriptSource =
  `const WEBENVOY_EXTENSION_URL = "chrome-extension://${extensionId}/build/background.js";\n` +
  "globalThis.__webenvoyBuild = 'fresh';\n";
const targetUrl = `chrome-extension://${extensionId}/${scriptPath}`;

const sendFrame = (socket, value) => {
  const payload = Buffer.from(JSON.stringify(value), "utf8");
  const header = payload.length < 126
    ? Buffer.from([0x81, payload.length])
    : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff]);
  socket.write(Buffer.concat([header, payload]));
};

const readFrames = (buffer) => {
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const second = buffer[offset + 1];
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let headerLength = 2;
    if (length === 126) {
      if (offset + 4 > buffer.length) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      return { frames, rest: Buffer.alloc(0) };
    }
    const maskLength = masked ? 4 : 0;
    const frameEnd = offset + headerLength + maskLength + length;
    if (frameEnd > buffer.length) break;
    const mask = masked ? buffer.subarray(offset + headerLength, offset + headerLength + 4) : null;
    const payload = Buffer.from(buffer.subarray(offset + headerLength + maskLength, frameEnd));
    if (mask) {
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] ^= mask[index % 4];
      }
    }
    frames.push(payload.toString("utf8"));
    offset = frameEnd;
  }
  return { frames, rest: buffer.subarray(offset) };
};

const server = http.createServer((request, response) => {
  if (request.url === "/json/list") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify([{
      type: "service_worker",
      url: targetUrl,
      webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/devtools/page/webenvoy-service-worker`
    }]));
    return;
  }
  response.writeHead(404);
  response.end();
});

server.on("upgrade", (request, socket) => {
  const key = request.headers["sec-websocket-key"];
  if (typeof key !== "string") {
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  let pending = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    const parsed = readFrames(Buffer.concat([pending, chunk]));
    pending = parsed.rest;
    for (const frame of parsed.frames) {
      let message;
      try {
        message = JSON.parse(frame);
      } catch {
        continue;
      }
      if (message.method === "Debugger.enable") {
        sendFrame(socket, { id: message.id, result: {} });
        sendFrame(socket, {
          method: "Debugger.scriptParsed",
          params: { scriptId: "1", url: targetUrl }
        });
      } else if (message.method === "Debugger.getScriptSource") {
        sendFrame(socket, { id: message.id, result: { scriptSource } });
        setTimeout(() => {
          socket.write(Buffer.from([0x88, 0x00]));
          socket.end();
        }, 50);
      } else {
        sendFrame(socket, { id: message.id, result: {} });
      }
    }
  });
});

server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  fs.writeFileSync(path.join(profileDir, "DevToolsActivePort"), `${port}\n/devtools/browser/webenvoy-mock\n`);
});

setTimeout(() => process.exit(0), ttlMs).unref();
process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
NODE
  exit 0
fi
sleep "${ttl}" &
wait $!
