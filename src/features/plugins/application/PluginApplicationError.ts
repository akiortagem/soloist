export type PluginApplicationErrorCode =
  | "invalid_manifest"
  | "plugin_not_found"
  | "install_failed"
  | "enable_failed"
  | "disable_failed"
  | "uninstall_failed"
  | "reload_failed"
  | "template_reinstall_failed";

export type PluginOperationStage =
  "validate" | "persist" | "refresh" | "cleanup";

export class PluginApplicationError extends Error {
  constructor(
    readonly code: PluginApplicationErrorCode,
    readonly cause?: unknown,
    readonly details: string[] = [],
    readonly stage: PluginOperationStage = "persist",
    readonly committed = false,
  ) {
    super(code);
    this.name = "PluginApplicationError";
  }
}

export function pluginNotFound(pluginId: string) {
  return new PluginApplicationError(
    "plugin_not_found",
    undefined,
    [pluginId],
    "persist",
  );
}
