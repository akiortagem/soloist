# Soloist Plugin Examples

Soloist plugins can be data manifests or compiled-JavaScript script plugins.
Data plugins contribute safe, declarative content without running JavaScript.
Script plugins run in a Worker and can register slash commands and asynchronous
oracle providers, use plugin-local storage, and show notifications or statuses.
See [the complete plugin format and API v1 contract](./PLUGIN_FORMAT.md).

## Manifest shape

A data plugin is a directory with a `manifest.json` file:

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

## Random table slash commands

Use `randomTables` to define tables and `slashCommands[].tableId` to bind a slash command to a table in the same plugin. When the user runs the command, Soloist rolls the table dice, inserts a result block, and stores the plugin id, table id, selected entry, and roll details in the block payload.

See [`omen/manifest.json`](./omen/manifest.json) for a complete `/omen` example.

## simple-char

`simple-char/plugin.json` contributes one editable character sheet template named
`Simple Character`. When imported, Soloist creates a local template copy with a
two-column row layout: HP and MP in a Resources group, and ATK and DEF in a
Combat group.
