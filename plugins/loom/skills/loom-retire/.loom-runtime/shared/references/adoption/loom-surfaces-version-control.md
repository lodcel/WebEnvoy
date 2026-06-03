# Loom Surfaces Version Control Policy

Authoritative source: `plugins/loom/skills/shared/references/adoption/loom-surfaces-version-control.md`.

This mirrored reference exists for executable skills that need local shared adoption context. Do not extend this mirror with independent rules; update the authoritative adoption contract instead.

## Stable carriers must be Git-visible

When generated or enabled by the selected adoption profile, these `.loom` paths are stable carriers and must be visible to Git:

- `.loom/bootstrap/manifest.json`
- `.loom/bootstrap/init-result.json`
- `.loom/README.md`
- `.loom/companion/manifest.json`
- `.loom/companion/README.md`
- `.loom/companion/repo-interface.json`
- `.loom/companion/interop.json`
- `.loom/companion/**` repo companion locators allowed by the repo companion contract
- `.loom/bin/**` while the target repository uses vendored repo-local runtime
- `.loom/work-items/**` only after execution-control or strong-governance is explicitly enabled
- `.loom/progress/**` only after execution-control or strong-governance is explicitly enabled
- `.loom/reviews/**` only after execution-control, strong-governance, or Loom-authored review carriers are explicitly enabled
- `.loom/status/current.md` only after Loom-owned status surface is explicitly enabled
- `.loom/specs/**` only after Loom-authored spec truth is explicitly enabled
- `.loom/shadow/**` only when shadow evidence is enabled and the relevant Loom contract requires versioning

`attach-only` defaults to attach metadata, repo companion / interop read surfaces, repo-local verify entry, and required vendored runtime. It must not generate Loom-authored work item, progress, status, review, or spec truth unless adoption intent explicitly upgrades to execution-control.

## Runtime residue must stay unversioned

These paths are runtime scratch, cache, or local attempt residue and should not be committed:

- `.loom/runtime/**`
- `.loom/tmp/**`
- `.loom/cache/**`
- `.loom/attempts/**/raw-logs/**`
- `.loom/attempts/**/scratch/**`
- `.loom/local/**`
- host tokens, local credentials, machine caches, and one-off debug output

If a profile needs versioned attempt evidence, it must define a stable evidence schema and locator first. Raw logs and scratch directories are not stable carriers.

## `.gitignore` discipline

Target repositories must not hide the whole `.loom/` tree with blanket ignores such as:

```gitignore
.loom/
.loom/**
```

Ignore only runtime paths:

```gitignore
.loom/runtime/
.loom/tmp/
.loom/cache/
.loom/attempts/**/raw-logs/
.loom/attempts/**/scratch/
.loom/local/
.loom/bin/**/__pycache__/
.loom/bin/**/*.py[cod]
```

Bootstrap and verify must fail closed when a target repository already has a blanket `.loom/` ignore. Dry-run or blocked write output must provide a reviewable ignore repair, and explicit auto-repair may only narrow the blanket rule to runtime/cache scratch paths such as `.loom/runtime/`, `.loom/tmp/`, and `.loom/cache/`. Do not use `git add -f .loom` as the normal answer because it hides the stable-carrier/runtime-residue boundary.

## Verify failure guidance

When verify finds a stable carrier that is ignored, missing, or not visible, it must report:

- the concrete path
- the profile or capability that requires the path
- the reason: `missing`, `ignored`, `untracked`, or `unexpected runtime path`
- the suggested action: restore the missing carrier, remove or narrow ignore rules, run `git add <path>`, explicitly upgrade adoption intent, or remove a forbidden authored carrier

`missing` and `ignored` are blocking errors. `untracked` means the stable carrier is visible to Git but has not entered the index yet; verify must report the path that needs `git add`, but must not make a fresh bootstrap write+verify loop fail for that reason alone.

Runtime paths such as `.loom/runtime/`, `.loom/tmp/`, `.loom/cache/`, `.loom/local/`, `.loom/attempts/**/raw-logs/`, and `.loom/attempts/**/scratch/` must not be reported as required Git-visible carriers. `.loom/attempts/` must not be excluded wholesale; versioned attempt evidence still needs a stable schema and locator before it can be treated as a stable carrier.

## External runtime migration

During vendored repo-local runtime, `.loom/bin/**` is auditable runtime provenance and must be Git-visible.

After migration to versioned external runtime, `.loom/bin/**` may stop being committed only when the external runtime contract is satisfied: versioned locator, explicit fallback or rebootstrap path, Git-visible `.loom/companion` and `interop.json`, and rollback to a trusted runtime.
