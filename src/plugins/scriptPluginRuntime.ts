import type {
  PluginCommandContext,
  PluginCommandExecutionResult,
} from "./pluginApi";
import type { PluginRepository } from "../persistence/pluginRepository";
import type { ScriptPluginPermission } from "./pluginTypes";
import {
  assertJsonSafe,
  requireMessageString,
  requireRecord,
  validatePluginCommandExecutionResult,
  validateSlashCommandRegistration,
} from "./pluginValidation";

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
  deactivatePlugin(pluginId: string): void;
};

type WorkerPluginState = {
  pluginId: string;
  worker: Worker;
  slashCommands: ScriptPluginSlashCommandRegistration[];
  pending: Map<
    string,
    {
      resolve(value: unknown): void;
      reject(error: Error): void;
    }
  >;
  onRuntimeError?: ScriptPluginRuntimeErrorHandler;
  permissions: Set<ScriptPluginPermission>;
};

type WorkerMessage =
  | {
      type: "activated";
      requestId: string;
    }
  | {
      type: "activationError" | "commandError" | "runtimeError";
      requestId?: string;
      message: string;
    }
  | {
      type: "commandResult";
      requestId: string;
      result: unknown;
    }
  | {
      type: "registerSlashCommand";
      command: ScriptPluginSlashCommandRegistration;
    }
  | {
      type: "registerOracleProvider";
      provider: {
        id: string;
        name: string;
        description?: string;
      };
    }
  | {
      type: "notify" | "setStatus" | "clearStatus";
      payload: unknown;
    }
  | {
      type: "hostRequest";
      requestId: string;
      action: string;
      payload: Record<string, unknown>;
    };

export const SCRIPT_PLUGIN_WORKER_SOURCE = `
const plugins = new Map();
const hostRequests = new Map();

function post(message) {
  self.postMessage(message);
}

function hostRequest(pluginId, action, payload) {
  const requestId = pluginId + ":host:" + Math.random().toString(36).slice(2);
  post({ type: "hostRequest", requestId, action, payload: { pluginId, ...payload } });
  return new Promise((resolve, reject) => {
    hostRequests.set(requestId, { resolve, reject });
  });
}

function createApi(pluginId, handlers, permissions) {
  function requirePermission(permission) {
    if (!permissions.has(permission)) {
      throw new Error("Plugin permission denied: " + permission);
    }
  }
  return {
    pluginId,
    storage: {
      get(key) {
        requirePermission("storage");
        return hostRequest(pluginId, "storage.get", { key });
      },
      set(key, value) {
        requirePermission("storage");
        return hostRequest(pluginId, "storage.set", { key, value });
      },
      remove(key) {
        requirePermission("storage");
        return hostRequest(pluginId, "storage.remove", { key });
      },
      keys() {
        requirePermission("storage");
        return hostRequest(pluginId, "storage.keys", {});
      },
      clear() {
        requirePermission("storage");
        return hostRequest(pluginId, "storage.clear", {});
      },
    },
    registerSlashCommand(command) {
      requirePermission("slashCommands:register");
      if (!command || typeof command !== "object" || typeof command.handler !== "function") {
        throw new Error("registerSlashCommand requires a command handler");
      }
      const safeCommand = {
        id: command.id,
        name: command.name,
        label: command.label,
        prefix: command.prefix,
        description:
          typeof command.description === "string" ? command.description : undefined,
      };
      handlers.set(safeCommand.id, command.handler);
      post({ type: "registerSlashCommand", command: safeCommand });
      return {
        dispose() {
          handlers.delete(safeCommand.id);
        },
      };
    },
    registerOracleProvider(provider) {
      requirePermission("oracleProviders:register");
      post({
        type: "registerOracleProvider",
        provider: {
          id: provider && provider.id,
          name: provider && provider.name,
          description:
            provider && typeof provider.description === "string"
              ? provider.description
              : undefined,
        },
      });
      return { dispose() {} };
    },
    notify(notification) {
      post({ type: "notify", payload: notification });
    },
    setStatus(status) {
      post({ type: "setStatus", payload: status });
    },
    clearStatus(statusId) {
      post({ type: "clearStatus", payload: statusId });
    },
  };
}

async function activatePlugin(message) {
  const handlers = new Map();
  const permissions = new Set(message.permissions || []);
  const api = createApi(message.pluginId, handlers, permissions);
  const module = { exports: {} };
  const exports = module.exports;
  self.soloistPlugin = undefined;

  try {
    const run = new Function(
      "module",
      "exports",
      message.entryCode + "\\n//# sourceURL=soloist-plugin://" + message.pluginId
    );
    run(module, exports);
    const pluginModule =
      module.exports && Object.keys(module.exports).length > 0
        ? module.exports.default || module.exports
        : self.soloistPlugin;

    if (!pluginModule || typeof pluginModule.activate !== "function") {
      throw new Error("Script plugin entry must export an activate(api) function");
    }

    await pluginModule.activate(api);
    plugins.set(message.pluginId, { handlers, api, module: pluginModule, permissions });
    post({ type: "activated", requestId: message.requestId });
  } catch (error) {
    post({
      type: "activationError",
      requestId: message.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function executeCommand(message) {
  const plugin = plugins.get(message.pluginId);
  const handler = plugin && plugin.handlers.get(message.commandId);

  if (!handler) {
    post({
      type: "commandError",
      requestId: message.requestId,
      message: "Script plugin command handler is not registered: " + message.commandId,
    });
    return;
  }

  try {
    const result = await handler(message.context, plugin.api);
    post({ type: "commandResult", requestId: message.requestId, result });
  } catch (error) {
    post({
      type: "commandError",
      requestId: message.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function deactivatePlugin(message) {
  const plugin = plugins.get(message.pluginId);
  if (plugin && plugin.module && typeof plugin.module.deactivate === "function") {
    await plugin.module.deactivate();
  }
  plugins.delete(message.pluginId);
}

self.onmessage = (event) => {
  const message = event.data;

  if (message.type === "hostResponse") {
    const pending = hostRequests.get(message.requestId);
    if (!pending) return;
    hostRequests.delete(message.requestId);
    if (message.ok) {
      pending.resolve(message.value);
    } else {
      pending.reject(new Error(message.error || "Host request failed"));
    }
    return;
  }

  if (message.type === "activate") {
    void activatePlugin(message);
    return;
  }

  if (message.type === "executeCommand") {
    void executeCommand(message);
    return;
  }

  if (message.type === "deactivate") {
    void deactivatePlugin(message);
  }
};
`;

function createRequestId(pluginId: string, action: string) {
  return `${pluginId}:${action}:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function createRuntimeError(message: string) {
  return new Error(message);
}

export class WorkerScriptPluginRuntime implements ScriptPluginRuntime {
  private readonly plugins = new Map<string, WorkerPluginState>();

  constructor(private readonly pluginRepository?: PluginRepository) {}

  async activatePlugin(
    input: ScriptPluginRuntimeActivateInput,
  ): Promise<ScriptPluginActivationResult> {
    this.deactivatePlugin(input.pluginId);

    if (typeof Worker === "undefined" || typeof Blob === "undefined") {
      throw new Error("Script plugin runtime requires Worker support");
    }

    const worker = new Worker(
      URL.createObjectURL(
        new Blob([SCRIPT_PLUGIN_WORKER_SOURCE], { type: "application/javascript" }),
      ),
    );
    const state: WorkerPluginState = {
      pluginId: input.pluginId,
      worker,
      slashCommands: [],
      pending: new Map(),
      onRuntimeError: input.onRuntimeError,
      permissions: new Set(input.permissions),
    };
    this.plugins.set(input.pluginId, state);

    worker.onmessage = (event: MessageEvent<unknown>) => {
      void this.handleWorkerMessage(input.pluginId, event.data);
    };
    worker.onerror = (event) => {
      const message = event.message || "Script plugin worker failed";
      input.onRuntimeError?.(message);
      this.rejectPending(input.pluginId, message);
    };

    const requestId = createRequestId(input.pluginId, "activate");
    const activation = new Promise<ScriptPluginActivationResult>(
      (resolve, reject) => {
        state.pending.set(requestId, {
          resolve: () => resolve({ slashCommands: [...state.slashCommands] }),
          reject,
        });
      },
    );

    worker.postMessage({
      type: "activate",
      requestId,
      pluginId: input.pluginId,
      entryCode: input.entryCode,
      permissions: input.permissions,
    });

    return activation;
  }

  async executeCommand(
    pluginId: string,
    commandId: string,
    context: PluginCommandContext,
  ): Promise<PluginCommandExecutionResult> {
    const state = this.plugins.get(pluginId);

    if (!state) {
      throw new Error(`Script plugin is not active: ${pluginId}`);
    }

    const safeContext = state.permissions.has("document:readSelection")
      ? context
      : { ...context, selectedText: null };

    const requestId = createRequestId(pluginId, "command");
    const result = new Promise<PluginCommandExecutionResult>((resolve, reject) => {
      state.pending.set(requestId, {
        resolve: (value) => resolve(value as PluginCommandExecutionResult),
        reject,
      });
    });

    state.worker.postMessage({
      type: "executeCommand",
      requestId,
      pluginId,
      commandId,
      context: safeContext,
    });

    return result;
  }

  deactivatePlugin(pluginId: string): void {
    const state = this.plugins.get(pluginId);

    if (!state) {
      return;
    }

    state.worker.postMessage({ type: "deactivate", pluginId });
    state.worker.terminate();
    this.rejectPending(pluginId, "Script plugin was deactivated");
    this.plugins.delete(pluginId);
  }

  private async handleWorkerMessage(
    pluginId: string,
    rawMessage: unknown,
  ): Promise<void> {
    const state = this.plugins.get(pluginId);

    if (!state) {
      return;
    }

    let message: WorkerMessage;
    try {
      message = validateWorkerMessage(rawMessage);
    } catch (error) {
      this.failPluginMessage(pluginId, error);
      return;
    }

    if (message.type === "registerSlashCommand") {
      if (!state.permissions.has("slashCommands:register")) {
        state.onRuntimeError?.(
          permissionDenied("slashCommands:register").message,
        );
        return;
      }
      let command: ScriptPluginSlashCommandRegistration;
      try {
        command = validateSlashCommandRegistration(message.command);
        if (state.slashCommands.some((item) => item.id === command.id)) {
          throw new Error(`Duplicate slash command id: ${command.id}`);
        }
        if (state.slashCommands.some((item) => item.name.toLowerCase() === command.name.toLowerCase())) {
          throw new Error(`Duplicate slash command name: ${command.name}`);
        }
      } catch (error) {
        this.failPluginMessage(pluginId, error);
        return;
      }
      state.slashCommands.push(command);
      return;
    }

    if (message.type === "registerOracleProvider") {
      if (!state.permissions.has("oracleProviders:register")) {
        state.onRuntimeError?.(
          permissionDenied("oracleProviders:register").message,
        );
      }
      return;
    }

    if (message.type === "hostRequest") {
      await this.handleHostRequest(state, message);
      return;
    }

    if (
      message.type === "activationError" ||
      message.type === "commandError" ||
      message.type === "runtimeError"
    ) {
      state.onRuntimeError?.(message.message);
      if (message.requestId) {
        this.resolvePending(pluginId, message.requestId, {
          ok: false,
          error: message.message,
        });
      }
      return;
    }

    if (message.type === "activated") {
      this.resolvePending(pluginId, message.requestId, { ok: true });
      return;
    }

    if (message.type === "commandResult") {
      let result: PluginCommandExecutionResult;
      try {
        result = validatePluginCommandExecutionResult(message.result);
      } catch (error) {
        this.failPluginMessage(pluginId, error, message.requestId);
        return;
      }
      if (
        result.type === "insertResultBlock" &&
        !state.permissions.has("document:insertBlock")
      ) {
        const error = permissionDenied("document:insertBlock");
        state.onRuntimeError?.(error.message);
        this.resolvePending(pluginId, message.requestId, {
          ok: false,
          error: error.message,
        });
        return;
      }
      this.resolvePending(pluginId, message.requestId, {
        ok: true,
        value: result,
      });
      return;
    }

    if (message.type === "notify" || message.type === "setStatus" || message.type === "clearStatus") {
      return;
    }
  }

  private async handleHostRequest(
    state: WorkerPluginState,
    message: Extract<WorkerMessage, { type: "hostRequest" }>,
  ): Promise<void> {
    try {
      if (message.payload.pluginId !== state.pluginId) {
        throw new Error("Host request pluginId does not match the active plugin");
      }
      if (message.action.startsWith("storage.")) {
        this.requirePermission(state, "storage");
      }
      const value = await this.executeHostRequest(message.action, message.payload);
      state.worker.postMessage({
        type: "hostResponse",
        requestId: message.requestId,
        ok: true,
        value,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      state.onRuntimeError?.(errorMessage);
      state.worker.postMessage({
        type: "hostResponse",
        requestId: message.requestId,
        ok: false,
        error: errorMessage,
      });
    }
  }

  private requirePermission(
    state: WorkerPluginState,
    permission: ScriptPluginPermission,
  ): void {
    if (!state.permissions.has(permission)) {
      throw permissionDenied(permission);
    }
  }

  private async executeHostRequest(
    action: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.pluginRepository) {
      throw new Error("Plugin storage is unavailable");
    }

    const pluginId = typeof payload.pluginId === "string" ? payload.pluginId : "";
    const key = typeof payload.key === "string" ? payload.key : "";

    if (!pluginId) {
      throw new Error("Plugin id is required");
    }

    if (action === "storage.get") {
      return (await this.pluginRepository.getStorage(pluginId, key)) ?? undefined;
    }

    if (action === "storage.set") {
      const value = payload.value;
      assertJsonSafe(value, "Plugin storage value");
      await this.pluginRepository.setStorage(pluginId, key, value);
      return undefined;
    }

    if (action === "storage.remove") {
      await this.pluginRepository.removeStorage(pluginId, key);
      return undefined;
    }

    if (action === "storage.keys") {
      return this.pluginRepository.listStorageKeys(pluginId);
    }

    if (action === "storage.clear") {
      await this.pluginRepository.clearStorage(pluginId);
      return undefined;
    }

    throw new Error(`Unsupported plugin host request: ${action}`);
  }

  private resolvePending(
    pluginId: string,
    requestId: string,
    result: { ok: true; value?: unknown } | { ok: false; error: string },
  ): void {
    const state = this.plugins.get(pluginId);
    const pending = state?.pending.get(requestId);

    if (!state || !pending) {
      return;
    }

    state.pending.delete(requestId);

    if (result.ok) {
      pending.resolve(result.value);
    } else {
      pending.reject(createRuntimeError(result.error));
    }
  }

  private rejectPending(pluginId: string, message: string): void {
    const state = this.plugins.get(pluginId);

    if (!state) {
      return;
    }

    for (const pending of state.pending.values()) {
      pending.reject(createRuntimeError(message));
    }
    state.pending.clear();
  }

  private failPluginMessage(pluginId: string, error: unknown, requestId?: string): void {
    const message = `Invalid worker message: ${error instanceof Error ? error.message : String(error)}`;
    const state = this.plugins.get(pluginId);
    state?.onRuntimeError?.(message);
    if (requestId) {
      this.resolvePending(pluginId, requestId, { ok: false, error: message });
    } else {
      this.rejectPending(pluginId, message);
    }
  }
}

function permissionDenied(permission: ScriptPluginPermission): Error {
  return new Error(`Plugin permission denied: ${permission}`);
}

function validateWorkerMessage(value: unknown): WorkerMessage {
  const message = requireRecord(value, "Worker message");
  const type = requireMessageString(message.type, "Worker message type", 64);
  const requestId = () => requireMessageString(message.requestId, "Worker requestId", 256);
  const errorMessage = () => requireMessageString(message.message, "Worker error message");
  switch (type) {
    case "activated":
      assertEnvelopeKeys(message, ["type", "requestId"]);
      return { type, requestId: requestId() };
    case "activationError":
    case "commandError":
    case "runtimeError":
      assertEnvelopeKeys(message, ["type", "requestId", "message"]);
      return { type, ...(message.requestId === undefined ? {} : { requestId: requestId() }), message: errorMessage() };
    case "commandResult":
      assertEnvelopeKeys(message, ["type", "requestId", "result"]);
      return { type, requestId: requestId(), result: message.result };
    case "registerSlashCommand":
      assertEnvelopeKeys(message, ["type", "command"]);
      return { type, command: message.command as ScriptPluginSlashCommandRegistration };
    case "registerOracleProvider": {
      assertEnvelopeKeys(message, ["type", "provider"]);
      const provider = requireRecord(message.provider, "Oracle provider registration");
      assertEnvelopeKeys(provider, ["id", "name", "description"]);
      return { type, provider: {
        id: requireMessageString(provider.id, "Oracle provider id", 128),
        name: requireMessageString(provider.name, "Oracle provider name", 128),
        ...(provider.description === undefined ? {} : { description: requireMessageString(provider.description, "Oracle provider description") }),
      } };
    }
    case "notify":
    case "setStatus":
    case "clearStatus":
      assertEnvelopeKeys(message, ["type", "payload"]);
      assertJsonSafe(message.payload, `Worker ${type} payload`);
      return { type, payload: message.payload };
    case "hostRequest": {
      assertEnvelopeKeys(message, ["type", "requestId", "action", "payload"]);
      const action = requireMessageString(message.action, "Host request action", 64);
      if (!["storage.get", "storage.set", "storage.remove", "storage.keys", "storage.clear"].includes(action)) {
        throw new Error(`Unknown host request action: ${action}`);
      }
      const payload = requireRecord(message.payload, "Host request payload");
      assertJsonSafe(payload, "Host request payload");
      return { type, requestId: requestId(), action, payload };
    }
    default:
      throw new Error(`Unknown worker message type: ${type}`);
  }
}

function assertEnvelopeKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`Unknown worker message field: ${unknown}`);
}
