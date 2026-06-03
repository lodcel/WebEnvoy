# Subagent-Driven Execution

Subagent-driven execution is a bounded build mode inside the main Loom execution lane. It is not a worker daemon, queue lifecycle, review result, or second truth source.

Each delegated unit must declare `task_goal`, `context_locators`, `read_scope`, `write_ownership`, `non_goals`, `validation_expectation`, `output_format`, and `integration_target`.

Subagent output remains evidence until the main executor integrates it into implementation files, validation evidence, recovery/status carriers, and later review inputs. Unintegrated session output is a build/readiness blocker.

When multiple delegated units or repeated rounds report the same scope, design, or validation gap, Loom emits a repeated blocker signal and requires root-cause escalation in the main execution lane.
