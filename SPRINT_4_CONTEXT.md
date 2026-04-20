## Sprint 4 (2026-04-27 to 2026-05-08): Deliver accessibility, cloud backup/restore, and operational readiness
| Ticket | Estimate | Dependencies | Notes |
|---|---:|---|---|
| US-014 | 5 | US-015 | WCAG 2.2 AA compliance on gameplay and dashboard |
| US-010 | 3 | US-008, US-013 | Manual cloud push snapshot keyed by device ID |
| US-011 | 5 | US-010 | Manual cloud restore with atomic local apply and safe failure behavior |
| US-016 | 5 | US-007, US-010, US-011, US-012 | Sentry, structured API logs, web vitals, quota alerts, runbooks |
| **Sprint Total** | **18** |  |  |

## 3. Risks & Dependencies

### Cross-Sprint Dependency Chain
1. `US-008` -> `US-009`, `US-003`, `US-004`, `US-010` (state foundation).
2. `US-001` -> `US-002`, `US-012` (turn completion event source).
3. `US-004` -> `US-005` -> `US-006` -> `US-007` (config to media pipeline).
4. `US-015` -> `US-014` (CI + accessibility gate integration).
5. `US-010` -> `US-011` (snapshot contract compatibility).
6. `US-007/010/011/012` -> `US-016` (observability coverage on implemented paths).

### Key Risks and Mitigations
- Local-state corruption disrupts play: mitigated by delivering `US-008` and `US-009` in Sprint 1.
- External service instability (Supabase/API): mitigated by fail-open behavior in `US-007`, `US-010`, `US-011`, `US-012`.
- Security regressions from media/rules input: mitigated by `US-013` before cloud restore rollout.
- Accessibility drift during rapid UI iteration: mitigated by `US-015` gates before `US-014` final conformance.
- Operational blind spots at launch: mitigated by committing `US-016` within MVP plan (not post-MVP).

## 4. Execution Notes
- Definition of Done per sprint:
  1. Story acceptance criteria pass with required test types from backlog matrix.
  2. No gameplay-critical flow is blocked by backend or third-party outages.
  3. CI required checks pass for all merged work in that sprint.
- Test strategy by phase:
  1. Sprints 1-2 prioritize reducer/unit + core E2E gameplay flow stability.
  2. Sprint 3 expands security/integration and CI enforcement breadth.
  3. Sprint 4 finalizes accessibility conformance and production operations signals.
- Release approach:
  1. End of Sprint 2: internal MVP playable baseline (all core P0 local gameplay/config/persistence except upload).
  2. End of Sprint 3: feature-complete MVP with upload + security + quality gates.
  3. End of Sprint 4: launch-ready with accessibility, cloud backup/restore, and observability.