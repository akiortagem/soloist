import { PluginApplicationError } from "../application/PluginApplicationError";

export function pluginErrorText(error: unknown) {
  if (error instanceof PluginApplicationError) {
    if (error.code === "plugin_not_found") {
      return `Plugin is not installed: ${error.details[0]}`;
    }
    if (error.code === "invalid_manifest") return error.details.join("\n");
    return error.cause instanceof Error ? error.cause.message : error.code;
  }
  return error instanceof Error ? error.message : String(error);
}

export function pluginFailureMessage(
  error: unknown,
  action: string,
  fallback: string,
) {
  return error instanceof PluginApplicationError && error.committed
    ? `${action} succeeded, but plugin refresh failed.`
    : fallback;
}
