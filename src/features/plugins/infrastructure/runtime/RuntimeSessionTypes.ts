import type { ScriptPluginPermission } from "../../../../plugins/pluginTypes";
import type {
  ScriptPluginRuntimeErrorHandler,
  ScriptPluginSlashCommandRegistration,
} from "../../application/ports/ScriptPluginRuntime";

export type RuntimeCommandRegistration = ScriptPluginSlashCommandRegistration;
export type RuntimeErrorHandler = ScriptPluginRuntimeErrorHandler;

export type PendingRuntimeRequest = {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
};

export type WorkerPluginSession = {
  pluginId: string;
  worker: Worker;
  slashCommands: RuntimeCommandRegistration[];
  pending: Map<string, PendingRuntimeRequest>;
  onRuntimeError?: RuntimeErrorHandler;
  permissions: Set<ScriptPluginPermission>;
  deactivation?: Promise<void>;
};

export type PendingResult =
  { ok: true; value?: unknown } | { ok: false; error: string };
