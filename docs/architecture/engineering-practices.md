# Engineering practices

These practices are the default acceptance criteria for new and refactored
code. Rules marked **required** should be automated where practical. A temporary
exception must be documented in the pull request with a follow-up issue.

## File and function size

- **Required:** production source files must not exceed **300 logical lines of
  code**. The target is **200 lines or fewer**.
- Generated files, migrations, static data, and vendored code are exempt when
  clearly identified.
- Existing files over 300 lines are legacy hotspots: do not add a new
  responsibility to them, and reduce them when materially changed.
- Legacy hotspots are recorded in `scripts/architecture-baseline.json`. The
  file-size check rejects new files over 300 lines and any growth beyond a
  hotspot's recorded size. Reduce or remove baseline entries as slices migrate;
  adding an exception requires a documented follow-up issue.
- Functions should normally stay below 40 lines and components below 150 lines.
  Split by responsibility, not merely to satisfy a counter.
- One file should have one primary reason to change.

Line limits are architectural feedback, not permission to create meaningless
wrappers. Cohesion and readable flow take priority within the hard file limit.

## Modules, imports, and exports

- Use named exports. Default exports are reserved for framework-required entry
  points and lazy-loaded route boundaries.
- Use `import type` for type-only dependencies.
- A feature exposes a deliberate public API from its root `index.ts`.
- Cross-feature imports must use that public API. Never deep-import another
  feature's `domain`, `application`, `infrastructure`, or `presentation` files.
- Within a feature, import the concrete module directly. Do not use the feature
  barrel internally; this avoids cycles.
- Do not create broad `index.ts` files that re-export every file.
- Infrastructure implementations are exported only to the composition root.
- Avoid circular dependencies. Fix the ownership or introduce an inward-facing
  port instead of suppressing a cycle.
- Keep import groups in this order: external packages, cross-feature/public
  modules, same-feature modules, styles/assets. Let formatting tooling enforce
  ordering once configured.

## SOLID and design rules

- **Single responsibility:** a component, use case, adapter, or service has one
  cohesive purpose and one primary reason to change.
- **Open/closed:** prefer registries or strategies for genuine extension points
  such as commands and plugin contributions; avoid speculative abstraction.
- **Liskov substitution:** every adapter must honor its port's behavior and
  error contract. Use shared contract tests for multiple implementations.
- **Interface segregation:** define small ports around what a use case needs;
  do not inject a complete repository collection or application store.
- **Dependency inversion:** application code owns interfaces; infrastructure
  implements them. Concrete adapters are selected only by composition.

Prefer composition over inheritance. Prefer plain functions for stateless rules
and classes only when identity, lifecycle, or encapsulated mutable state makes
them clearer.

## TypeScript

- Do not use `any`; use `unknown` and narrow at boundaries.
- Model state variants with discriminated unions rather than correlated
  booleans or unsafe assertions.
- Validate external JSON, plugin messages, persisted payloads, and Tauri results
  before treating them as domain types.
- Keep types close to the behavior they describe. Do not add unrelated types to
  a global type file.
- Prefer immutable inputs/outputs and avoid mutating objects owned by callers.
- Exhaustively handle discriminated unions; unreachable cases should fail type
  checking.

## React and state

- Separate containers/controllers from presentational components when a view
  performs orchestration or I/O.
- Components receive explicit props and do not access repositories, Tauri,
  SQLite, workers, or the filesystem.
- Subscribe to the smallest state slice needed. Avoid broad whole-app
  subscriptions.
- Keep transient UI state local unless multiple distant consumers genuinely
  coordinate around it.
- Put business rules in domain/application code, not hooks, effects, or JSX.
- Effects synchronize with external systems; they are not a substitute for a
  use case or derived state.
- Maintain keyboard behavior, focus handling, and accessible names during UI
  decomposition.

## Use cases and side effects

- Name use cases with a verb and business object, such as `InstallPlugin` or
  `StartCombat`.
- Give each use case an explicit input and output.
- Inject the smallest required ports through construction or a factory.
- Make clock, ID, randomness, persistence, filesystem, and runtime operations
  explicit dependencies when they affect behavior.
- Do not import the global app store from domain/application code.
- Return typed application errors. Presentation owns error copy, notifications,
  and loading indicators.
- Workflows with partial side effects must define rollback or idempotency.

## Testing and delivery

- A bug fix includes a regression test at the lowest useful layer.
- A refactor first characterizes behavior that is not already protected.
- Test outcomes and public behavior rather than private implementation details.
- New ports with multiple adapters should have reusable contract tests.
- Every pull request must pass typecheck, lint, tests, and production build.
- Run all frontend gates locally with `npm run quality`. CI runs typecheck,
  ESLint and architecture checks, Prettier verification, coverage, tests, and
  the production frontend build. Rust tests run in the same workflow.
- `.prettierignore` records the transitional formatting baseline. New
  feature-first architecture roots are checked; remove legacy ignore entries as
  their slices are formatted instead of adding new source exclusions.
- Coverage thresholds in `vite.config.ts` baseline the current suite and block
  regressions. Raise them as each vertical slice gains focused tests.
- Keep commits and pull requests focused on one architectural step; avoid mixing
  broad moves with unrelated behavior changes.
- Performance changes require a measurement before and after.

## Definition of done for refactor issues

- Code follows the directory and dependency rules in the architecture guide.
- Touched production files meet the 300-line maximum, or a documented temporary
  exception has its own follow-up issue.
- Tests cover moved behavior at the appropriate layer.
- Obsolete code paths and compatibility adapters in scope are removed.
- Documentation is updated when a public contract or architectural decision
  changes.
- Typecheck, lint, tests, and build pass.
