import type {
  PluginCommandContext,
  PluginCommandExecutionResult,
} from "../../../../plugins/pluginApi";
import type { ScriptPluginPermission } from "../../../../plugins/pluginTypes";
export type ScriptPluginSlashCommandRegistration = {
  id: string;
  name: string;
  label: string;
  prefix: string;
  description?: string;
};

export type ScriptPluginActivationResult = {
  slashCommands: ScriptPluginSlashCommandRegistration[];
};

export type ScriptPluginRuntimeErrorHandler = (message: string) => void;

export type ScriptPluginRuntimeActivateInput = {
  pluginId: string;
  entryCode: string;
  permissions: ScriptPluginPermission[];
  onRuntimeError?: ScriptPluginRuntimeErrorHandler;
};

export type ScriptPluginRuntime = {
  activatePlugin(
    input: ScriptPluginRuntimeActivateInput,
  ): Promise<ScriptPluginActivationResult>;
  executeCommand(
    pluginId: string,
    commandId: string,
    context: PluginCommandContext,
  ): Promise<PluginCommandExecutionResult>;
  deactivatePlugin(pluginId: string): Promise<void> | void;
};

export type ScriptPluginRuntimeOptions = {
  activationTimeoutMs?: number;
  commandTimeoutMs?: number;
  hostRequestTimeoutMs?: number;
  deactivationTimeoutMs?: number;
};
