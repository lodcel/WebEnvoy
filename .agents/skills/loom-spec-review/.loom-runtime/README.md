# Skills

Language: English | [中文版本](./README.zh-CN.md)

`skills/` is the generated, checked-in Loom skills install surface. The editable source truth lives in `src/skills/`.

When Loom is installed through Codex native skill discovery, a host plugin, or the npm installer, this directory is the user-facing execution surface. Each `skills/<skill-id>` directory is also a self-contained single-skill package. Methodology and architecture documents stay behind this layer; users should enter through skills instead of internal governance docs.

By default, start from `loom-init`. It is the unique root entry for Loom and is responsible for two things:

- initialize Loom or retrofit Loom into an existing repository
- route the operator to the correct scenario skill when no explicit skill was named

The `skills/` layer consumes the current strong-governance control plane with these fixed constraints:

- `Work Item` is the only formal execution entry
- tasks that hit the formal spec path must pass the `spec gate` first
- the release chain converges on `spec gate -> build gate -> review gate -> merge gate`
- `status control plane` only reads and summarizes fact-chain and host control-plane truth, and does not author a second source of truth
- profile maturity upgrades through `light -> standard -> strong`, while item maturity still advances through the governance state machine
- merge is controlled by GitHub or an equivalent host control plane; Loom only consumes and summarizes the prerequisites for GitHub controlled merge

## Skills Library

Loom exposes one root entry and ten scenario skills:

| Skill | Role |
| --- | --- |
| `loom-init` | Root entry; initializes and routes. |
| `loom-adopt` | Initializes a new repository or retrofits Loom into an existing one. |
| `loom-resume` | Restores context and continues execution. |
| `loom-build` | Runs a bounded implementation/build round and validates delegated output integration before review. |
| `loom-story` | Turns product context into a User Story and Story Readiness result before spec / plan consumption. |
| `loom-pre-review` | Checks readiness before formal review. |
| `loom-spec-review` | Reviews the formal spec path and produces the `spec gate` consumed by later gates. |
| `loom-review` | Runs formal review and records review output. |
| `loom-handoff` | Writes a handoff point and next-step state. |
| `loom-retire` | Cleans up or retires the current worksite. |
| `loom-merge-ready` | Performs the final `merge gate` summary before GitHub-controlled merge. |

## Entry Model

Loom supports two entry modes:

- Explicit entry: the user names a scenario skill directly.
- Routed entry: the user starts at `loom-init`, and `loom-init` selects the scenario from task signals.

If task signals are incomplete, ambiguous, or missing required execution inputs, route back to `loom-init` and ask for the smallest missing signal. Stable routing rules live in [route-matrix.md](./route-matrix.md).

Routing only decides the scene skill. It does not replace the stable control plane:

- execution entry stays on `Work Item`
- gates stay on the shared `gate chain`
- status reads stay on the shared `status control plane`
- merge stays on the host platform control plane

## Install Model

The primary install model is the complete Loom skills library:

```bash
git clone https://github.com/MC-and-his-Agents/Loom.git ~/.codex/loom
mkdir -p ~/.agents/skills
for skill in ~/.codex/loom/skills/loom-*; do
  ln -sfn "$skill" "$HOME/.agents/skills/$(basename "$skill")"
done
```

The npm installer can also install the complete plugin surface:

```bash
npx @mc-and-his-agents/loom-installer add plugin --host codex
npx @mc-and-his-agents/loom-installer add plugin --host claude
```

The npm installer is an adapter/helper path, not the Codex default.

## Advanced / Compatibility

Single-skill installation is supported for advanced compatibility, not as the default user journey:

```bash
npx @mc-and-his-agents/loom-installer add skill <skill-id> --host codex
npx @mc-and-his-agents/loom-installer add skill <skill-id> --host claude
```

A single installed skill only exposes that named skill to the host. It does not expose the full `loom-init` routing surface unless `loom-init` itself is installed, and it should not be presented as the complete Loom experience.

Every generated single-skill package contains `loom-package.json`, a package-internal `.loom-runtime/`, and a launcher that resolves runtime from inside the package.

## Internal Contracts

These files are part of the runtime contract and should remain stable:

- [registry.json](./registry.json)
- [install-layout.json](./install-layout.json)
- [upgrade-contract.json](./upgrade-contract.json)
- [distribution-and-adapter-contract.md](./distribution-and-adapter-contract.md)

Shared runtime scripts, assets, and references live under [shared/](./shared/). They are consumed by scenario skills and by release tooling when generating plugin or single-skill payloads.

Generated surface checks:

```bash
python3 tools/skills_surface.py generate
make skills-check
```
