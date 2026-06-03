# Readiness Checklist

## Contract

- Schema marker: loom-full-suite-readiness/v1
- Consumes:
  - Suite index locator:
  - Spec locator:
  - Plan locator:
  - Research locator, or `not_applicable` rationale:
  - Contracts locator, or `not_applicable` rationale:
- Produces:
  - Readiness verdict:
  - Blocking gaps:
  - Evidence locators:
- Locator:
  - Readiness checklist locator:
- Provenance:
  - Source suite artifact locators:
  - Freshness rule:

## Readiness Verdict

- Verdict: ready | blocked | not_applicable
- Blocking gaps:
- Evidence locator:
- Freshness rule:

## Checklist

- [ ] Suite index is current.
- [ ] `spec.md` scenario ids / locators are present.
- [ ] `spec.md` acceptance ids / locators are present.
- [ ] `plan.md` maps every required scenario to automated, manual, structural, or `not_applicable` validation.
- [ ] `plan.md` maps every required acceptance item to test evidence, structural check, manual evidence, or `not_applicable`.
- [ ] Research decisions are resolved, deferred, or explicitly `not_applicable`.
- [ ] Contract deltas are declared, or explicitly `not_applicable`.
- [ ] Generated / skills integration needs are recorded for #1020 when relevant.
- [ ] This checklist does not author `next_step`, `blockers`, or `latest_validation_summary`.
