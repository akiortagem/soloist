# Clean Architecture refactor plan

This is the canonical migration plan for issues #26–#33. Issue numbers follow
the required execution order: #26 is Phase 0 and #33 is Phase 7. Issues define bounded
deliverables; this document defines the shared pattern, order, and completion
conditions. Update this plan when sequencing or scope changes rather than
letting individual issues diverge.

## Desired outcome

Soloist is organized by feature, with domain rules and application use cases
independent of React, global state, Tauri, SQLite, workers, and the filesystem.
Infrastructure implements ports owned by application code, presentation stays
thin, and dependencies are assembled in one composition root.

The required placement and dependency rules are in the
[architecture guide](README.md). Code-level standards are in
[engineering practices](engineering-practices.md).

## Migration pattern for every feature

Every refactor issue uses the same vertical-slice sequence:

1. **Characterize** — add tests around current observable behavior.
2. **Model** — identify domain concepts, invariants, use-case input/output, and
   typed application errors.
3. **Define ports** — specify only the external behavior the use case needs.
4. **Implement use case** — coordinate domain logic without React/global state
   or concrete infrastructure.
5. **Adapt infrastructure** — implement ports for SQLite, Tauri, workers, or
   browser APIs and add contract/integration tests.
6. **Wire composition** — construct dependencies in `app/composition`.
7. **Adapt presentation** — make store actions/hooks/components invoke the use
   case and map results to UI state/messages.
8. **Remove legacy path** — delete duplicate logic, compatibility code, and
   obsolete exports within the issue's scope.
9. **Verify** — typecheck, lint, tests, build, and confirm touched files meet the
   engineering practices.

Do not perform a folder-only rewrite. A slice is complete when dependency
direction changes and the old execution path is gone.

## Delivery phases

### Phase 0 — Rules and safety net (#26)

Establish this documentation, linting/formatting, boundary checks, coverage, and
CI. Legacy violations may be baselined, but new violations must be blocked.

Exit conditions:

- Developers can determine where any new module belongs.
- Dependency rules and the 300-line maximum are automatically checked where
  practical.
- Test, typecheck, lint, and build run consistently in CI.

### Phase 1 — Dependency foundation (#27)

Create feature scaffolding, application ports, infrastructure adapters, and the
composition root. Prove the shape with one small end-to-end vertical slice.

Exit conditions:

- Dependencies are constructed once.
- A use case can run with in-memory ports in tests and concrete adapters in the
  app.
- New application code does not call `createRepositories()` or Tauri directly.

### Phase 2 — Plugin application use cases (#28)

Plugins are the first full migration because they cross persistence, Tauri,
workers, validation, registries, SDK contracts, and presentation. Extract the
application use cases and make the store a thin adapter for these workflows.

Target division:

```text
features/plugins/
  domain/            Plugin, manifest rules, contribution identity
  application/       install/enable/disable/uninstall/reload use cases + ports
  infrastructure/    SQLite repository, Tauri files, worker runtime, registries
  presentation/      settings UI, status view models, notifications
```

Exit conditions:

- Plugin workflows run without `appStore` in application tests.
- Install, enable, disable, uninstall, reload, and template reinstall use cases
  are covered with in-memory ports.

### Phase 3 — Plugin lifecycle and runtime (#29)

Decompose plugin lifecycle coordination and the script runtime after plugin
workflows have stable application boundaries.

Exit conditions:

- Activation rollback is explicit and tested.
- Worker transport, host dispatch, permission policy, validation, and lifecycle
  management have focused ownership.
- Host and SDK contracts cannot silently drift.

### Phase 4 — Command and editor slice (#30)

Introduce command execution ports/handlers, separate pure result construction
from effects, and split editor routing, persistence coordination, and slash-menu
interaction.

Target division:

```text
features/commands/   # May remain under editor if it has no independent owner
features/editor/
  domain/            Document/result concepts that are editor-owned
  application/       execute command, save document, editor-facing ports
  infrastructure/    Tiptap adapters and persistence adapters
  presentation/      editor views, slash menu, hooks
```

Exit conditions:

- Command execution has no global store import.
- Editor side effects are explicit and independently tested.
- `Editor.tsx` becomes a small composition/router component.

### Phase 5 — Store migration (#31)

As each use case moves, reduce store actions to presentation adapters. Separate
persisted/application state from transient UI state, migrate broad subscribers,
and finally remove compatibility aggregate synchronization.

Exit conditions:

- Store code constructs no repository and invokes no Tauri API.
- Components subscribe to focused slices.
- There is one authoritative representation of state.

### Phase 6 — Presentation decomposition (#32)

Decompose the app shell, character-template UI, combat UI, and remaining large
screens along responsibility boundaries. Do this after their workflows have a
stable application API to avoid extracting tightly coupled legacy logic.

Exit conditions:

- Touched UI files meet the 300-line maximum.
- Containers orchestrate; presentational components use explicit props.
- Accessibility and interaction behavior remain protected by tests.

### Phase 7 — Domain consolidation and delivery (#33)

Consolidate types and invariants during each prior slice, then finish remaining
domain cleanup. Analyze the bundle and lazy-load infrequent screens after stable
presentation boundaries exist.

Exit conditions:

- Every domain concept has one authoritative definition.
- Domain modules are framework/infrastructure-free.
- Bundle improvements are measured and documented.

## Issue dependency map

```text
#26 Guardrails
  └─ #27 Ports + composition root
       └─ #28 Plugin use cases
            └─ #29 Plugin lifecycle/runtime
                 └─ #30 Commands/editor
                      └─ #31 Store migration
                           └─ #32 UI decomposition
                                └─ #33 Domain finish + bundle work
```

Some domain consolidation in #33 should happen inside earlier slices rather
than waiting until the end. The final phase closes gaps and performs measured
delivery optimization.

## Pull request checklist

- [ ] The PR identifies its feature, layer, and owning refactor issue.
- [ ] The vertical-slice migration pattern was followed.
- [ ] Cross-feature imports use public APIs; internal imports do not use barrels.
- [ ] No new inward layer depends on presentation or concrete infrastructure.
- [ ] Touched source files comply with the file-size rule.
- [ ] Relevant characterization/unit/contract/integration tests were added.
- [ ] Old paths and temporary duplication in scope were removed.
- [ ] Typecheck, lint, tests, and production build pass.
