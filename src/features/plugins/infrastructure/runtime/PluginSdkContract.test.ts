import { describe, expect, it } from "vitest";

import type {
  PluginCommandContext,
  PluginCommandExecutionResult,
  PluginNotification,
  PluginOracleProvider,
  PluginStatus,
  ScriptPluginPermission as SdkPermission,
  SoloistPluginApi,
  SoloistApiVersion,
} from "../../../../../packages/soloist-plugin-sdk";
import type {
  PluginCommandContext as HostCommandContext,
  PluginCommandExecutionResult as HostCommandResult,
  PluginNotification as HostNotification,
  PluginOracleProvider as HostOracleProvider,
  PluginStatus as HostStatus,
  SoloistPluginApi as HostApi,
} from "../../../../plugins/pluginApi";
import {
  CURRENT_SOLOIST_API_VERSION,
  SCRIPT_PLUGIN_PERMISSIONS,
  type ScriptPluginPermission as HostPermission,
} from "../../../../plugins/pluginTypes";
import type {
  ScriptPluginRuntime,
  ScriptPluginRuntimeActivateInput,
  ScriptPluginSlashCommandRegistration,
} from "../../application/ports/ScriptPluginRuntime";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Value extends true> = Value;
type PermissionContractMatches = Assert<Equal<HostPermission, SdkPermission>>;
type VersionContractMatches = Assert<
  Equal<typeof CURRENT_SOLOIST_API_VERSION, SoloistApiVersion>
>;
type HostContractMatches = Assert<
  Equal<
    [
      HostApi,
      HostCommandContext,
      HostCommandResult,
      HostNotification,
      HostOracleProvider,
      HostStatus,
    ],
    [
      SoloistPluginApi,
      PluginCommandContext,
      PluginCommandExecutionResult,
      PluginNotification,
      PluginOracleProvider,
      PluginStatus,
    ]
  >
>;
type RuntimePermissionMatches = Assert<
  Equal<ScriptPluginRuntimeActivateInput["permissions"][number], SdkPermission>
>;
type RuntimeCommandMatches = Assert<
  Equal<
    ScriptPluginSlashCommandRegistration,
    Omit<Parameters<SoloistPluginApi["registerSlashCommand"]>[0], "handler">
  >
>;
type RuntimeContractUsesSdkResults = Assert<
  Equal<
    Awaited<ReturnType<ScriptPluginRuntime["executeCommand"]>>,
    PluginCommandExecutionResult
  >
>;

describe("plugin SDK contract", () => {
  it("keeps every SDK permission represented by host policy", () => {
    const contractChecks: [
      PermissionContractMatches,
      VersionContractMatches,
      HostContractMatches,
      RuntimePermissionMatches,
      RuntimeCommandMatches,
      RuntimeContractUsesSdkResults,
    ] = [true, true, true, true, true, true];
    expect(contractChecks).toEqual([true, true, true, true, true, true]);
    expect(SCRIPT_PLUGIN_PERMISSIONS).toEqual([
      "storage",
      "slashCommands:register",
      "oracleProviders:register",
      "document:readSelection",
      "document:insertBlock",
    ]);
  });
});
