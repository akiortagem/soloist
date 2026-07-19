# Soloist Plugin Package Format

Soloist plugin packages are `.soloist-plugin` files. A `.soloist-plugin` file is
a zip archive with a `plugin.json` manifest at the package root.

Soloist supports data plugins and compiled-JavaScript script plugins. Data
plugins contribute declarative content such as slash commands, random tables,
oracle tables, and character sheet templates. Script plugins run from a compiled
JavaScript entry file in a Worker. The Worker keeps plugin work off the React
thread, but it is not a security sandbox. See [Script plugin security](SCRIPT_PLUGIN_SECURITY.md).

Soloist publishes its public, type-only TypeScript surface as
`@soloist/plugin-sdk`. In this repository it is installable from
`packages/soloist-plugin-sdk`. Authors import from that package and never from
Soloist's `src/` tree. Installed packages contain compiled JavaScript; Soloist
does not transpile or load TypeScript source.

SDK major versions map directly to manifest API majors: SDK `1.x` is for
`"soloistApiVersion": "1"`. Minor and patch SDK releases are backward
compatible. A breaking contract requires a new SDK major and manifest opt-in.

The public SDK is intentionally narrow. It exposes slash command registration,
plugin-local storage, notifications, status
updates, and safe command context values such as command arguments, chaos
factor, plugin id, and a selected-text placeholder for future document-aware
commands. It does not expose app internals such as the app store, repositories,
SQLite access, Tiptap editor objects, or raw Tauri invoke.

## Package Layout

The archive must contain `plugin.json` at the root:

```text
my-plugin.soloist-plugin
├── plugin.json
└── dist/
    └── plugin.js
```

Data plugins may contain only `plugin.json`. A script plugin's `entry` names its
compiled JavaScript file relative to the archive root.

## Installer safety limits

Package installation is staged and validated before an existing plugin is
replaced. A failed replacement restores the previous directory, and temporary
extraction and backup directories are removed automatically.

Archives are limited to 64 MiB compressed, 1,024 entries, 16 MiB per expanded
file, and 64 MiB total expanded content. Entry paths are limited to 240 bytes
and 16 components. Entries whose expanded-to-compressed ratio exceeds 200:1,
duplicate paths, traversal or absolute paths, symbolic/hard links, and other
special filesystem entries are rejected. A package filename may replace only a
folder containing the same manifest ID; the same ID cannot be installed under
multiple folder names. Script manifests are rejected unless their safe `entry`
file is present in the staged package.

To package a plugin source directory:

```sh
cd plugins-example/omen-table
zip -r ../omen-table.soloist-plugin plugin.json
```

## Manifest

`plugin.json` must be a UTF-8 encoded JSON object.

Required fields:

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Stable plugin id. |
| `name` | string | Display name. |
| `version` | string | Plugin version. |
| `soloistApiVersion` | string | Soloist plugin API version. Current examples use `"1"`. |
| `type` | string | Must be `"data"` or `"script"`. |

Optional fields:

| Field | Type | Description |
| --- | --- | --- |
| `contributes` | object | Declarative content contributed by the plugin. |
| `entry` | string | Required for script plugins. Relative path to the compiled JavaScript entry file. |
| `permissions` | string[] | Required for script plugins. Soloist host API capabilities requested by the plugin; this is not a list of ambient browser capabilities. |

Unknown manifest fields are rejected.

### API compatibility policy

Soloist currently supports exactly plugin API version `"1"`. A manifest that
declares any other value is rejected before the plugin is activated, with an
error that identifies the unsupported version and the supported version.

Backward-compatible additions may be made within API version 1. Existing
fields and behavior will continue to work for the lifetime of that major API
version. A change that removes, renames, or incompatibly changes a public
manifest field, worker message, permission, or SDK contract requires a new API
major version. Plugins must opt in by changing `soloistApiVersion`; Soloist does
not guess compatibility or silently load plugins built for a newer major.

Worker messages, command registrations, command results, and JSON payloads are
validated at runtime. Command identifiers and UI strings are bounded, command
prefixes must match `/command` or `/command `, and IDs/names must be unique per
plugin. JSON payloads must contain only finite numbers, strings, booleans,
null, arrays, and plain objects, with bounded nesting and size.

### Script API v1

Install the SDK in an external project with
`npm install --save-dev @soloist/plugin-sdk@^1 typescript`. The repository
reference uses `file:../../packages/soloist-plugin-sdk` so it is reproducible
before publication. Use `import type`; the SDK contains declarations and no
runtime code.

`SoloistPluginApi` exposes `pluginId`, plugin-local `storage`,
`registerSlashCommand`, `registerOracleProvider`, `notify`, `setStatus`, and
`clearStatus`. Notifications
appear in the application activity overlay. Status IDs are local to a plugin;
the host namespaces them as `pluginId:statusId`, and repeated `setStatus` calls
update the same status. `clearStatus` removes it. Plugin statuses are removed
when the plugin is disabled, reloaded, fails, or is uninstalled.

Oracle providers run in the plugin Worker and may implement synchronous or
asynchronous `askYesNo` and `setupScene` handlers. The host namespaces provider
IDs as `pluginId:providerId`. Disposing the returned registration unregisters
the provider, and all providers are removed when their plugin stops.

Supported script permissions are `storage`, `slashCommands:register`,
`oracleProviders:register`, `document:readSelection`, and
`document:insertBlock`. Data plugins do not need a `permissions` field.

Script plugin `entry` paths must be relative package paths. Parent-directory,
absolute, and platform-prefix paths are rejected. The entry file is read from
the installed plugin folder and executed outside the main React app context.
Script plugins are installed disabled and must be explicitly trusted before use.

```json
{
  "id": "soloist-plugin.example",
  "name": "Example Plugin",
  "version": "1.0.0",
  "soloistApiVersion": "1",
  "type": "data",
  "contributes": {}
}
```

Script plugin manifest example:

```json
{
  "id": "soloist-plugin.script-example",
  "name": "Script Example",
  "version": "1.0.0",
  "soloistApiVersion": "1",
  "type": "script",
  "permissions": ["slashCommands:register", "document:insertBlock"],
  "entry": "dist/plugin.js"
}
```

### Supported script module formats

API v1 evaluates a classic compiled script. The entry may expose `activate`
(and optional `deactivate`) through CommonJS `module.exports`/`exports`, through
`module.exports.default`, or as `self.soloistPlugin`. Native ESM `import` and
`export` syntax is not supported in an installed entry.

Compile TypeScript with `"module": "CommonJS"`, as in the
[reference tsconfig](./script-plugin/tsconfig.json), or bundle it to one
classic/CommonJS file. Runtime dependencies must be bundled because `require()`
is not provided by the Worker. Type-only SDK imports disappear during compile.

```text
script-plugin/
├── package.json
├── package-lock.json
├── plugin.json
├── tsconfig.json
├── src/plugin.ts
├── dist/plugin.js
└── scripts/package.mjs
```

Run `npm ci` and `npm run package` in that directory. The result at
`package/reference-script.soloist-plugin` contains `plugin.json` and
`dist/plugin.js` at their expected archive paths.

### Script lifecycle and cleanup

Script plugins run in a dedicated Worker. Activation and every command or
oracle invocation have host-configured deadlines; exceeding one terminates that
plugin's Worker and rejects all of its outstanding operations. Other plugins
and the main UI continue independently.

On reload, disable, or uninstall, Soloist calls an optional asynchronous
`deactivate()` export and waits for it only for a bounded grace period (one
second by default). During that grace period the hook may finish in-memory
cleanup, but it must not rely on starting or completing host API requests.
Registrations and UI status are removed as deactivation begins. After the hook
acknowledges completion, throws, or reaches the deadline, the Worker is
terminated unconditionally. Cleanup that must survive forced termination
should therefore be persisted during normal plugin operation rather than left
to `deactivate()`.

## Contributions

Supported contribution groups:

| Group | Description |
| --- | --- |
| `slashCommands` | Slash commands registered by the plugin. |
| `randomTables` | Rollable random tables. |
| `oracleTables` | Rollable oracle tables. |
| `characterSheetTemplates` | Character sheet templates available for import. |

Unknown contribution groups are rejected.

Soloist namespaces contribution ids internally as
`pluginId:contributionId`. For example, a plugin with id
`soloist-plugin.example` and a table with id `omens` is registered internally as
`soloist-plugin.example:omens`.

## Slash Commands

Slash commands are declared in `contributes.slashCommands`.

Fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Unique command contribution id inside this plugin. |
| `name` | string | Yes | Command name used by Soloist command lookup. |
| `label` | string | Yes | Display label shown in command UI. |
| `prefix` | string | Yes | Slash command prefix, such as `"/omen"`. |
| `description` | string | No | Command description. |
| `commandText` | string | No | Command text to execute when selected. |
| `tableId` | string | No | Table contribution id to roll when the command runs. |

A slash command must define `commandText` or `tableId`.

`tableId` references a table contribution id inside the same plugin manifest.
Use the local contribution id, not the internally namespaced id. For example,
use `"tableId": "omens"`, not
`"tableId": "soloist-plugin.example:omens"`.

## Tables

Tables are declared in `contributes.randomTables` or
`contributes.oracleTables`. Both groups use the same table shape.

Fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Unique table contribution id inside this plugin. |
| `name` | string | Yes | Display name. |
| `description` | string | No | Table description. |
| `dice` | string | Yes | Dice expression used to roll the table. |
| `entries` | array | Yes | Table entries. |

## Table Entries

Table entries are declared in a table's `entries` array.

Fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Unique entry id inside this table. |
| `min` | number | Yes | Minimum roll value for this entry. |
| `max` | number | Yes | Maximum roll value for this entry. |
| `text` | string | Yes | Result text inserted when this entry is selected. |

`min` must be less than or equal to `max`.

## Character Sheet Templates

Character sheet templates are declared in
`contributes.characterSheetTemplates`.

Fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Unique template contribution id inside this plugin. |
| `name` | string | Yes | Template display name. |
| `fields` | array | Yes | Character sheet template field layout. |

The `fields` array uses Soloist's implemented character sheet template item
schema. See `plugins-example/fixtures/valid-data-plugin/plugin.json` for a
small valid template and `plugins-example/simple-char/plugin.json` for a larger
template layout example.

## Examples And Fixtures

- `plugins-example/omen-table/plugin.json` is a valid example data plugin.
- `plugins-example/fixtures/valid-data-plugin/plugin.json` is a compact valid
  manifest fixture.
- `plugins-example/fixtures/invalid-*` directories contain invalid manifest
  fixtures for validation tests.

## Installation and troubleshooting

Install the generated `.soloist-plugin` from Plugins settings. Script plugins
are installed disabled: review their permissions, then enable and trust them.
After activation, type `/hello` in an editor command position.

If a command does not appear, confirm the plugin is enabled, check its
activation status, confirm `plugin.json` is at the archive root, and ensure
`entry` exactly matches the compiled path (including case). Rebuild and
repackage after source changes; shipping `src/plugin.ts` does not compile it.

`Plugin permission denied: storage` means code used a capability absent from
`permissions`. Add the exact permission, rebuild, reinstall, and trust again.
Slash registration requires `slashCommands:register`; this example also uses
`storage` and returns a block under `document:insertBlock`. Absolute and `..`
entry paths are rejected. A syntax error mentioning `export` usually means ESM
was shipped; build the entry as CommonJS/classic script.
