# Plan

## Suite Contract

- Suite path consumed: minimal | full
- Suite index locator, or `not_applicable` rationale:
- Consumes:
  - Spec locator:
  - Scenario ids / locators:
  - Acceptance ids / locators:
  - Story Readiness consumed state:
  - Story Business Confirmation consumed state:
- Produces:
  - Validation strategy by scenario:
  - Test strategy by acceptance:
  - Fresh verification evidence expectation:
- Locator:
  - Plan locator:
- Provenance:
  - Source spec / issue / PR / doc locator:
  - Freshness rule:

## Implementation Goal

- What will be delivered in this change set?
- What is explicitly deferred?

## Deferred Items

### Deferred Item 1

- Locator:
- Reason:
- Activation condition:
- Does not currently block:
- Statement: deferred is not completed.

## Not Applicable Items

### Not Applicable Item 1

- Locator:
- Rationale:
- Recheck condition:
- Consumers that should not require it:

## Phases

### Phase 1

- Objective:
- Deliverable:
- Exit condition:

### Phase 2

- Objective:
- Deliverable:
- Exit condition:

## Constraints

- Architectural or governance constraints:
- Workspace / rollout constraints:
- Purity or scope constraints:

## Validation

- Automated checks:
- Manual checks:
- Runtime evidence:
- Behavior evidence:
- Story scenario to evidence mapping:
- Story readiness consumed:
- Story business confirmation locator or `not_applicable` rationale:
- Scenario validation mapping:
  - S1 -> automated | manual | structural | not_applicable:
  - S2 -> automated | manual | structural | not_applicable:
- Fresh verification evidence:
- Execution ledger plan locator:
- Execution ledger validation evidence locator:

## Test Strategy

- TDD or test-first expectation:
- Regression coverage to add or preserve:
- Cases that are intentionally not automated:
- How failing tests or equivalent checks will be introduced before implementation:
- How passing tests or equivalent checks will be captured as test evidence:
- Acceptance test mapping:
  - A1 -> test evidence | structural check | manual evidence | not_applicable:
  - A2 -> test evidence | structural check | manual evidence | not_applicable:
  - A3 -> test evidence | structural check | manual evidence | not_applicable:
  - A4 -> test evidence | structural check | manual evidence | not_applicable:
  - A5 -> test evidence | structural check | manual evidence | not_applicable:
- How User Story acceptance scenarios map to tests, checks, manual validation, or `not_applicable` evidence:
  - Do not create validation strategy from `pending` or `revision-requested` Story Readiness / Business Confirmation; record the blocking locator and return to story shaping.

## Subagent Output Integration

- Owned outputs:
- Integration owner:
- Required evidence from each subagent:
- Review or reconciliation needed before merge-ready:
- Handoff notes locator, or `not_applicable`:

## Dependencies

- Blocking inputs:
- Required coordination:
- Rollback boundary:

## Ready For Implementation

- [ ] Spec is stable enough to implement
- [ ] Scope and non-goals are clear
- [ ] Story Readiness is confirmed or explicitly `not_applicable`
- [ ] Story business semantics are confirmed or explicitly `not_applicable`
- [ ] Validation path is defined
- [ ] BDD outer-loop scenarios map to validation or `not_applicable`
- [ ] TDD inner-loop expectations map to test evidence
- [ ] Every required scenario / acceptance mapping is present, or has `not_applicable` rationale and recheck condition
- [ ] Risks and dependencies are explicit
