# Dynamic Tool Handshake

Dynamic tool handshake evidence is runtime evidence. It is not authored progress, not a retained host action result, and not a second status truth.

`dynamic_tool_locators` in `.loom/companion/repo-interface.json` remains declaration-time only. Retained host action results stay in `.loom/companion/interop.json`; attempt summaries stay in `execution_attempt`.

`python3 tools/loom_flow.py live-smoke dynamic-tool-availability --target <repo> [--surface <surface>]` is the live/profile-local evidence wrapper for this contract. It reads the same declarations and emits release-confidence evidence without executing the tool protocol itself.

Stable statuses:

- `advertised`
- `unavailable`
- `unsupported`
- `failed`

These values are nested under `tool_availability.declared_tools[*].status`; top-level command `result` remains `pass | warn | block`.

Required tool failure blocks the owning execution surface and uses `fallback_to`. Optional or advisory failure is displayed as advisory evidence and does not block core status.

`live-smoke dynamic-tool-availability` embeds that same `tool_availability` payload inside `loom-dynamic-tool-live-availability/v1`, keeps optional/advisory failures profile-local, and does not call the tool or define a tool-specific protocol.
