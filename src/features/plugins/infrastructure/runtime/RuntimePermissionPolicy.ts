import type { ScriptPluginPermission } from "../../../../plugins/pluginTypes";

export class RuntimePermissionPolicy {
  constructor(private readonly granted: ReadonlySet<ScriptPluginPermission>) {}

  allows(permission: ScriptPluginPermission): boolean {
    return this.granted.has(permission);
  }

  require(permission: ScriptPluginPermission): void {
    if (!this.allows(permission)) throw permissionDenied(permission);
  }
}

export function permissionDenied(permission: ScriptPluginPermission): Error {
  return new Error(`Plugin permission denied: ${permission}`);
}
