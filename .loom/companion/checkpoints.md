# Companion Checkpoints

- Admission: read the existing root rules and repo-native admission surface before entering implementation.
- Build: preserve retained host actions and repo-native carriers; do not assume Loom-owned recovery/status carriers exist.
- Merge-ready: consume companion extensions and host-owned gates without re-implementing the host lifecycle.
- Handoff: write only the active Loom recovery entry fields and derived status surface; never write GitHub issue/project state.
- Resume: read GitHub issue/PR/worktree binding, Loom recovery state, Loom review/spec/merge-ready records, and WebEnvoy repo locators; fail closed when required binding or authority records are missing, stale, or conflicting.
