# `@soloist/plugin-sdk`

This is the type-only authoring SDK for Soloist manifests declaring
`"soloistApiVersion": "1"`. Package major 1 maps to Soloist API major 1.
Imports are erased when TypeScript compiles, so this package adds no runtime
code to a plugin. See [`plugins-example/PLUGIN_FORMAT.md`](../../plugins-example/PLUGIN_FORMAT.md)
and the reference project for the supported contract.
