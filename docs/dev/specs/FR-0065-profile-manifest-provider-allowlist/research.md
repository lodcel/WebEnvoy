# FR-0065 Research

## Inputs read

- `vision.md`: WebEnvoy is a CLI-first Web execution tool, not an Agent brain; browser-internal execution remains the HTTP boundary.
- `docs/dev/roadmap.md`: live/write gates are high-risk and must be staged through formal specs before implementation.
- `docs/dev/architecture/system-design.md`: browser process is the only HTTP outlet; provider/profile/runtime contracts must not bypass that boundary.
- `docs/dev/AGENTS.md`: high-risk FR/spec changes require formal suite, parser-friendly PR metadata, local validation and scheduler-owned gate.
- Issue #1175: `Profile Manifest Provider Allowlist`, OPEN, `kind:fr`, `area:live-write`, `risk:high`, `provider:generic`, `integration:local-only`, close semantics `fr-complete`.
- Issue #1123: CLOSED Browser Provider Contract baseline.
- Issue #1174: CLOSED Live-Write Capability Taxonomy.
- Issue #1178: CLOSED Operator Unlock.
- Issue #1181: CLOSED Live-Write Evidence Redaction.

## Dependency consumption

### FR-0033 / #1123 Browser Provider Contract

FR-0065 consumes provider identity, provider family, provider mode, capability and verification vocabulary. It does not redefine provider registry, provider selection or runtime doctor behavior.

### FR-0062 / #1174 Live-Write Capability Taxonomy

FR-0065 uses `read_only`, `write_admit`, `write_prepare` and `live_write_commit` as the only capability levels. Accepted manifest status does not unlock `live_write_commit`; it only clears the profile manifest allowlist blocker.

### FR-0064 / #1178 Operator Unlock

Operator unlock remains a distinct downstream requirement for `live_write_commit`. A profile manifest cannot be inferred from operator unlock, and operator unlock cannot be inferred from a profile manifest.

### FR-0041 / #1181 Redaction

Secret refs must be locators or handles. Account, profile, proxy, seed and other secret-bearing values must not be written as raw values in manifest samples, PR metadata, stdout summary or artifacts.

## Boundary decisions

- FR-0065 is a formal spec suite, not runtime implementation.
- Profile manifest allowlist is a prerequisite declaration, not provider requirement pass.
- Accepted manifest result is valid input to #1179/#1180/#1211, not a replacement for those gates.
- #835 closed state remains historical controlled-success context only.
- This suite is local-only and does not introduce Syvert normalized result or cross-repo shared contract.

## Numbering and mapping

The current spec map ends at `FR-0064-operator-unlock` mapped to issue #1178. FR-0065 is the next formal suite and maps to issue #1175.
