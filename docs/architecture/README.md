# Soloist architecture guide

This document defines where code belongs and which dependencies are allowed. It
is the default for new code and the target for refactoring existing code. The
current repository is transitional; deviations should be reduced whenever a
feature is touched.

## Architectural style

Soloist uses **feature-first Clean Architecture**. Code is grouped first by
business capability and then by responsibility inside that capability. This
keeps a complete feature discoverable without weakening dependency boundaries.

```text
src/
  app/                         # Composition root and application shell
    composition/               # Construct adapters, services, and use cases
    presentation/              # Top-level routes, layout, and providers

  features/
    campaigns/
      domain/                  # Entities, value objects, policies, domain errors
      application/             # Use cases and ports
      infrastructure/          # SQLite/Tauri implementations of ports
      presentation/            # React components, hooks, and view models
      index.ts                 # Deliberate public API for other features
    combat/
    editor/
    character-sheets/
    plugins/
    oracle/

  shared/
    domain/                    # Truly cross-feature primitives only
    application/               # Shared application contracts
    infrastructure/            # Shared technical adapters
    presentation/              # Generic UI primitives and hooks

src-tauri/                     # Native Tauri host and commands
packages/                      # Independently consumable packages, including SDKs
```

Do not create a shared abstraction in anticipation of reuse. Keep it in its
owning feature until at least two features need the same stable concept.

## Layer responsibilities

### Domain

Contains business meaning and rules: entities, value objects, invariants,
policies, domain services, and domain errors. Domain code is deterministic and
framework-free.

Domain code may depend on other domain code. It must not import React, the app
store, Tauri, SQLite, browser globals, registries, workers, or filesystem code.

### Application

Contains use cases that coordinate domain behavior. It defines ports—the
interfaces required from persistence, clocks, IDs, dialogs, plugin runtimes,
and other external capabilities. Use cases return typed results and must not
format UI messages.

Application code may depend on domain code. It must not depend on presentation
or concrete infrastructure.

### Infrastructure

Implements application ports using SQLite, Tauri commands, web workers, browser
APIs, and the filesystem. It translates external data and errors at the
boundary. Infrastructure contains no UI state and no business policy.

Infrastructure may depend on application and domain contracts. Application and
domain code never import infrastructure implementations.

### Presentation

Contains React views, hooks, view models, route state, transient UI state, and
store adapters. It invokes application use cases and maps results to user-facing
messages. Components do not construct repositories or call Tauri/SQLite APIs.

### Composition root

The composition root is the only place that knows concrete implementations. It
constructs repositories and gateways once, wires use cases, and exposes the
application services required by presentation. Avoid module-level service
locators and mutable global registries.

## Dependency rule

```text
presentation ──> application ──> domain
       │               ▲
       └─ composition ─┤
                       │
infrastructure ────────┘
```

Dependencies point inward. Cross-feature calls go through the owning feature's
public API or an application port; they do not reach into another feature's
internal folders.

## How to place code

Use these questions in order:

1. Is it a business rule that works without I/O? Put it in `domain`.
2. Does it coordinate a user/system goal? Put it in an `application` use case.
3. Does it communicate with SQLite, Tauri, a worker, browser API, or filesystem?
   Put it in `infrastructure` behind an application port.
4. Does it render UI or manage interaction state? Put it in `presentation`.
5. Does it construct dependencies? Put it in `app/composition`.

For example, plugin installation is divided as follows:

```text
features/plugins/domain/
  Plugin.ts                    # Plugin concepts and invariants
  PluginManifest.ts            # Domain shape and validation rules
features/plugins/application/
  InstallPlugin.ts             # Workflow
  ports/PluginRepository.ts    # Required persistence behavior
  ports/PluginRuntime.ts       # Required activation behavior
features/plugins/infrastructure/
  SqlitePluginRepository.ts    # Port implementation
  TauriPluginFileGateway.ts    # Native filesystem boundary
  WorkerPluginRuntime.ts       # Worker boundary
features/plugins/presentation/
  PluginSettings.tsx           # View
  usePlugins.ts                # Presentation adapter
```

## Data and error flow

- Validate untrusted input at the boundary and enforce business invariants in
  the domain.
- Convert database, Tauri, worker, and filesystem failures into application
  errors before returning them to presentation.
- Prefer explicit input/output types for use cases over passing the entire
  application state.
- Keep persisted state separate from transient state such as open menus,
  resizing, drafts, and notifications.
- Side effects must be visible in a use case's injected dependencies; avoid
  hidden imports of `appStore`, singleton repositories, clocks, or random IDs.

## Testing by layer

- Domain: fast deterministic unit tests with no mocks for frameworks.
- Application: use-case tests using in-memory ports/fakes.
- Infrastructure: adapter contract and integration tests.
- Presentation: interaction tests at component boundaries.
- End to end: a small set of critical Tauri/plugin flows.

Tests normally live beside the code as `*.test.ts(x)`. Existing tests under
`src/tests` can migrate when their production module is moved.

## Transitional rule

Do not reorganize the whole tree in one mechanical commit. Migrate one vertical
slice at a time: add the target module, characterize current behavior, route the
existing entry point through it, then remove the obsolete path. Every migration
must leave tests and the production build passing.

See [Engineering practices](engineering-practices.md) for coding rules and the
[refactor plan](refactor-plan.md) for migration order.
