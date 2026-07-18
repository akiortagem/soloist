import type {
  PluginCommandContext,
  PluginCommandExecutionResult,
  PluginJsonValue,
} from "./pluginApi";
import type { PluginRepository } from "../persistence/pluginRepository";

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

const WORKER_SOURCE = `
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

function createApi(pluginId, handlers) {
  return {
    pluginId,
    storage: {
      get(key) {
        return hostRequest(pluginId, "storage.get", { key });
      },
      set(key, value) {
        return hostRequest(pluginId, "storage.set", { key, value });
      },
      remove(key) {
        return hostRequest(pluginId, "storage.remove", { key });
      },
      keys() {
        return hostRequest(pluginId, "storage.keys", {});
      },
      clear() {
        return hostRequest(pluginId, "storage.clear", {});
      },
    },
    registerSlashCommand(command) {
      if (!command || typeof command !== "object" || typeof command.handler !== "function") {
        throw new Error("registerSlashCommand requires a command handler");
      }
      const safeCommand = {
        id: String(command.id || ""),
        name: String(command.name || ""),
        label: String(command.label || ""),
        prefix: String(command.prefix || ""),
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
      post({
        type: "registerOracleProvider",
        provider: {
          id: String(provider && provider.id || ""),
          name: String(provider && provider.name || ""),
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
  const api = createApi(message.pluginId, handlers);
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
    plugins.set(message.pluginId, { handlers, api, module: pluginModule });
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
        new Blob([WORKER_SOURCE], { type: "application/javascript" }),
      ),
    );
    const state: WorkerPluginState = {
      worker,
      slashCommands: [],
      pending: new Map(),
      onRuntimeError: input.onRuntimeError,
    };
    this.plugins.set(input.pluginId, state);

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
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
      context,
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
    message: WorkerMessage,
  ): Promise<void> {
    const state = this.plugins.get(pluginId);

    if (!state) {
      return;
    }

    if (message.type === "registerSlashCommand") {
      state.slashCommands.push(message.command);
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
      this.resolvePending(pluginId, message.requestId, {
        ok: true,
        value: message.result,
      });
    }
  }

  private async handleHostRequest(
    state: WorkerPluginState,
    message: Extract<WorkerMessage, { type: "hostRequest" }>,
  ): Promise<void> {
    try {
      const value = await this.executeHostRequest(message.action, message.payload);
      state.worker.postMessage({
        type: "hostResponse",
        requestId: message.requestId,
        ok: true,
        value,
      });
    } catch (error) {
      state.worker.postMessage({
        type: "hostResponse",
        requestId: message.requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async executeHostRequest(
    action: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.pluginRepository) {
      throw new Error("Plugin storage is unavailable");
    }

    const pluginId = String(payload.pluginId ?? "");
    const key = String(payload.key ?? "");

    if (!pluginId) {
      throw new Error("Plugin id is required");
    }

    if (action === "storage.get") {
      return (await this.pluginRepository.getStorage(pluginId, key)) ?? undefined;
    }

    if (action === "storage.set") {
      const value = payload.value;
      if (!isJsonSafe(value)) {
        throw new Error("Plugin storage value must be JSON-safe");
      }
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
}

function isJsonSafe(value: unknown): value is PluginJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonSafe);
  }

  if (value && typeof value === "object") {
    return Object.values(value).every(isJsonSafe);
  }

  return false;
}
