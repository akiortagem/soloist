# Soloist Plugin Package Format

Soloist plugin packages are `.soloist-plugin` files. A `.soloist-plugin` file is
a zip archive with a `plugin.json` manifest at the package root.

Initial Soloist plugins are data-only. They can contribute declarative content
such as slash commands, random tables, oracle tables, and character sheet
templates. Soloist does not load TypeScript source from plugins, and script
plugins are not available.

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
| `type` | string | Must be `"data"`. |

Optional fields:

| Field | Type | Description |
| --- | --- | --- |
| `contributes` | object | Declarative content contributed by the plugin. |

Unknown manifest fields are rejected.

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
