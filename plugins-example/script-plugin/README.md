# Reference script plugin

This is a complete Soloist API v1 plugin project. It uses only the standalone,
type-only `@soloist/plugin-sdk`; no application source import is required.

```sh
npm ci
npm run package
```

The build compiles `src/plugin.ts` as CommonJS to `dist/plugin.js`. The package
step then creates `package/reference-script.soloist-plugin`, with `plugin.json`
and that compiled entry at the archive root. Install the archive from Soloist's
Plugins settings, enable/trust it, and run `/hello Ada`.

The checked-in `dist/plugin.js` shows the expected output layout. Regenerate it
with `npm run build`; installed plugins ship this JavaScript, not the TypeScript
source. See [the package-format documentation](../PLUGIN_FORMAT.md) for API
versioning, supported exports, permissions, and troubleshooting.
