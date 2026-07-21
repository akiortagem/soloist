import type {
  PluginNotification,
  PluginStatus,
} from "../../../../plugins/pluginApi";
import {
  requireMessageString,
  requireRecord,
} from "../../../../plugins/pluginValidation";

export function validateNotification(value: unknown): PluginNotification {
  const item = requireRecord(value, "Plugin notification");
  rejectUnknownKeys(item, ["level", "title", "message"]);
  const levels = ["info", "success", "warning", "error"] as const;
  if (!levels.includes(item.level as (typeof levels)[number]))
    throw new Error("Invalid plugin notification level");
  return {
    level: item.level as PluginNotification["level"],
    title: requireMessageString(item.title, "Plugin notification title", 256),
    ...(item.message === undefined
      ? {}
      : {
          message: requireMessageString(
            item.message,
            "Plugin notification message",
          ),
        }),
  };
}

export function validateStatus(value: unknown): PluginStatus {
  const item = requireRecord(value, "Plugin status");
  rejectUnknownKeys(item, ["id", "level", "message"]);
  const levels = ["idle", "working", "success", "warning", "error"] as const;
  if (!levels.includes(item.level as (typeof levels)[number]))
    throw new Error("Invalid plugin status level");
  return {
    id: requireMessageString(item.id, "Plugin status id", 128),
    level: item.level as PluginStatus["level"],
    message: requireMessageString(item.message, "Plugin status message"),
  };
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`Unknown worker message field: ${unknown}`);
}
