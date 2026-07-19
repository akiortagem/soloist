# Soloist Plugin Examples

Soloist installs `.soloist-plugin` zip archives. Every archive has a
`plugin.json` at its root; script plugins also contain compiled JavaScript.
Soloist never loads TypeScript from an installed plugin.

- [`omen-table/plugin.json`](./omen-table/plugin.json) is a data plugin with an `/omen` random-table command.
- [`simple-char/plugin.json`](./simple-char/plugin.json) is a data plugin that contributes a character sheet template.
- [`script-plugin`](./script-plugin/) is the complete TypeScript reference project. It installs the standalone `@soloist/plugin-sdk`, registers `/hello`, uses plugin-local storage, builds `dist/plugin.js`, and creates an archive.

## Build and package the script example

From the repository root:

```sh
npm run example:install
npm run example:package
```

The resulting file is `plugins-example/script-plugin/package/reference-script.soloist-plugin`.
Install it in Soloist's Plugins settings, explicitly enable/trust it, then run
`/hello Ada` in the editor.

For manifests, module formats, installation, permissions, and troubleshooting,
see [the complete plugin format and API v1 contract](./PLUGIN_FORMAT.md).
