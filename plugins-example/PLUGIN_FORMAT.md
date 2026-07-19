# Soloist Plugin Package Format

Soloist plugin packages are `.soloist-plugin` files. A `.soloist-plugin` file is
a zip archive with a `plugin.json` manifest at the package root.

Soloist supports data plugins and compiled-JavaScript script plugins. Data
plugins contribute declarative content such as slash commands, random tables,
oracle tables, and character sheet templates. Script plugins run from a compiled
JavaScript entry file in a Worker. The Worker keeps plugin work off the React
thread, but it is not a security sandbox. See [Script plugin security](SCRIPT_PLUGIN_SECURITY.md).

Soloist defines the public TypeScript SDK surface for compiled-JavaScript script
plugins in `src/plugins/pluginApi.ts`. Plugin authors should write script
plugins in TypeScript against those public types, then ship compiled JavaScript
in the installed plugin package. Soloist will not load TypeScript source files
from installed plugins.

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
└── plugin.json
```

Additional files may be included in the archive, but the app currently reads
the manifest data from `plugin.json`.

To package a plugin source directory:

```sh
cd examples/plugins/omen-table
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
schema. See `examples/plugins/fixtures/valid-data-plugin/plugin.json` for a
small valid template and `plugins-example/simple-char/plugin.json` for a larger
template layout example.

## Examples And Fixtures

- `examples/plugins/omen-table/plugin.json` is a valid example data plugin.
- `examples/plugins/fixtures/valid-data-plugin/plugin.json` is a compact valid
  manifest fixture.
- `examples/plugins/fixtures/invalid-*` directories contain invalid manifest
  fixtures for validation tests.
