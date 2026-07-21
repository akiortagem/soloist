import type {
  ScriptPluginPermission,
  SoloistApiVersion,
} from "../../packages/soloist-plugin-sdk";

const SUPPORTED_VERSION_POLICY = {
  "1": true,
} as const satisfies Record<SoloistApiVersion, true>;

const PERMISSION_POLICY = {
  storage: true,
  "slashCommands:register": true,
  "oracleProviders:register": true,
  "document:readSelection": true,
  "document:insertBlock": true,
} as const satisfies Record<ScriptPluginPermission, true>;

export const SUPPORTED_SOLOIST_API_VERSIONS = Object.keys(
  SUPPORTED_VERSION_POLICY,
) as SoloistApiVersion[];
export const CURRENT_SOLOIST_API_VERSION: SoloistApiVersion = "1";
export const SCRIPT_PLUGIN_PERMISSIONS = Object.keys(
  PERMISSION_POLICY,
) as ScriptPluginPermission[];

export type { ScriptPluginPermission } from "../../packages/soloist-plugin-sdk";
