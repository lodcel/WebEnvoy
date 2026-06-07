# FR-0047 TODO

## Spec review checklist

- [ ] Confirm FR-0047 path and sync map use canonical issue #1142.
- [ ] Confirm service worker freshness health consumes FR-0038 and does not define a new health result schema.
- [ ] Confirm `extension_load` check mapping covers pass, warn, fail, unknown, severity and blocking.
- [ ] Confirm stateful runtime health matrix covers `healthy`, `disconnected`, `recoverable`, and `blocked`.
- [ ] Confirm recovery path covers same-run retry, browser start-stop recovery, orphan/background process recovery, and stale ready signal expiry.
- [ ] Confirm minimum regression matrix covers stale worker, disconnected worker, recoverable retry, orphan process conflict, stale ready signal, missing expected identity, and redaction invalid.
- [ ] Confirm contract examples include the full FR-0038 required `provider_doctor_report.identity` shape.
- [ ] Confirm expected / observed service worker identity fields are diagnostic inputs only, not new schema.
- [ ] Confirm evidence refs consume FR-0040 freshness / artifact identity and FR-0041 redaction policy.
- [ ] Confirm #1140 persistent extension identity health is out of scope.
- [ ] Confirm #1141 native messaging health is out of scope.
- [ ] Confirm #1139 capability matrix, #1143 launch evidence and #1144 fixtures are out of scope.
- [ ] Confirm no runtime/code/live/browser behavior is included.
- [ ] Confirm PR closing semantics use `Refs #1142`, because this formal spec carrier does not complete the runtime health work item.

## Post-review implementation candidates

- [ ] Add provider doctor contract validator coverage for `official_chrome_persistent_service_worker_freshness`.
- [ ] Add service worker expected / observed digest collection design under a separate implementation issue.
- [ ] Add fail-closed tests for stale, unknown, missing expected identity, missing observed identity and redaction invalid.
- [ ] Add redaction tests to prevent raw profile path, extension path, service worker source or secret disclosure.
- [ ] Add synthetic fixtures only after #1144 consumes this contract.

## Current PR scope

- [ ] Formal spec suite only.
- [ ] No runtime implementation.
- [ ] No live evidence.
- [ ] No browser/profile/account interaction.
- [ ] Scheduler owns guardian/formal review/merge gate.
