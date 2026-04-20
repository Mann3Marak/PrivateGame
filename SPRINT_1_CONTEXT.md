## Sprint 1 (2026-03-16 to 2026-03-27): Establish deterministic local engine and resilient state restore
| Ticket | Estimate | Dependencies | Notes |
|---|---:|---|---|
| US-008 | 5 | None | Rehydrate + debounced autosave foundation for all stateful features |
| US-009 | 3 | US-008 | Corruption detection and deterministic reset path |
| US-001 | 5 | None | Core spin, fairness, alternation, and pause guard behavior |
| US-003 | 2 | US-008, US-001 | Pause/resume behavior with persistence across reload |
| **Sprint Total** | **15** |  |  |