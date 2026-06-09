# FR-0051 Research Notes

Accessed: 2026-06-09

## Source inputs

- Upstream README: <https://github.com/CloakHQ/CloakBrowser>
- Upstream security advisory: <https://github.com/CloakHQ/CloakBrowser/security/advisories/GHSA-mf33-gv72-w2h5>
- Parent issue: #1114
- Work item issue: #1148

## Findings

1. Upstream documents `cloakserve` as a CDP server mode that can be reached through `connect_over_cdp`. This supports a provider-brokered CDP transport declaration, but does not prove WebEnvoy runtime readiness.
2. Upstream documents extension loading in launch / persistent-context workflows. This is not equivalent to WebEnvoy extension bridge, content script relay, service worker readiness or Native Messaging readiness.
3. Upstream documents persistent profile workflows separately from CDP server mode. #1148 therefore treats profile binding as unknown for `cloakbrowser.cloakserve` until a downstream owner supplies evidence.
4. A 2026-05-12 security advisory for `cloakserve` covered unauthenticated path traversal through the `fingerprint` parameter, leading to arbitrary directory deletion in versions `<=0.3.27`; the advisory lists `0.3.28` as patched. #1148 does not evaluate current safety. It freezes `cloakserve_cdp_endpoint_security_not_attested` so health / limitation / evidence owners must verify endpoint safety before admission.

## Decision

`cloakbrowser.cloakserve` is modeled as:

- `provider_mode=external_managed`
- `transport_kind=cdp`
- `attach_model=provider_brokered`
- `distribution_channel=experimental`
- WebEnvoy extension and Native Messaging disabled by default
- extension paths treated as experimental reference only

This keeps #1148 PR-ready without making runtime, health, fixture, limitation gate or live evidence claims.
