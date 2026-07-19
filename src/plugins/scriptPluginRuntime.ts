import type {
  PluginCommandContext,
  PluginCommandExecutionResult,
} from "./pluginApi";
import type { PluginRepository } from "../persistence/pluginRepository";
import type { ScriptPluginPermission } from "./pluginTypes";
import { pluginUiRegistry, type PluginUiRegistry } from "./pluginUiRegistry";
import type { PluginNotification, PluginStatus } from "./pluginApi";
import {
  registerOracleProvider,
  unregisterOracleProvider,
  unregisterPluginOracleProviders,
} from "../oracle/oracleRegistry";
import type { AskOracleResult, SceneSetupResult } from "../oracle/oracleTypes";
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
  deactivatePlugin(pluginId: string): Promise<void> | void;
};

export type ScriptPluginRuntimeOptions = {
  activationTimeoutMs?: number;
  commandTimeoutMs?: number;
  hostRequestTimeoutMs?: number;
  deactivationTimeoutMs?: number;
};

const DEFAULT_TIMEOUTS = {
  activationTimeoutMs: 10_000,
  commandTimeoutMs: 30_000,
  hostRequestTimeoutMs: 10_000,
  deactivationTimeoutMs: 1_000,
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
      timer: ReturnType<typeof setTimeout>;
    }
  >;
  onRuntimeError?: ScriptPluginRuntimeErrorHandler;
  permissions: Set<ScriptPluginPermission>;
  deactivation?: Promise<void>;
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
  | { type: "deactivated"; requestId: string; error?: string }
  | {
      type: "registerSlashCommand";
      command: ScriptPluginSlashCommandRegistration;
    }
  | { type: "registerOracleProvider"; provider: { id: string; name: string; description?: string } }
  | { type: "unregisterOracleProvider"; providerId: string }
  | { type: "oracleResult"; requestId: string; result: unknown }
  | { type: "oracleError"; requestId: string; message: string }
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
      if (!provider || typeof provider !== "object" ||
          typeof provider.askYesNo !== "function" || typeof provider.setupScene !== "function") {
        throw new Error("registerOracleProvider requires askYesNo and setupScene handlers");
      }
      const safeProvider = {
        id: provider.id,
        name: provider.name,
        description: typeof provider.description === "string" ? provider.description : undefined,
      };
      if (handlers.oracleProviders.has(safeProvider.id)) {
        throw new Error("Duplicate oracle provider id: " + safeProvider.id);
      }
      handlers.oracleProviders.set(safeProvider.id, provider);
      post({ type: "registerOracleProvider", provider: safeProvider });
      let disposed = false;
      return { dispose() {
        if (disposed) return;
        disposed = true;
        handlers.oracleProviders.delete(safeProvider.id);
        post({ type: "unregisterOracleProvider", providerId: safeProvider.id });
      } };
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
  handlers.oracleProviders = new Map();
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

async function invokeOracle(message) {
  const plugin = plugins.get(message.pluginId);
  const provider = plugin && plugin.handlers.oracleProviders.get(message.providerId);
  const handler = provider && provider[message.method];
  if (typeof handler !== "function") {
    post({ type: "oracleError", requestId: message.requestId, message: "Oracle provider handler is not registered" });
    return;
  }
  try {
    post({ type: "oracleResult", requestId: message.requestId, result: await handler.call(provider, message.input) });
  } catch (error) {
    post({ type: "oracleError", requestId: message.requestId, message: error instanceof Error ? error.message : String(error) });
  }
}

async function deactivatePlugin(message) {
  const plugin = plugins.get(message.pluginId);
  try {
    if (plugin && plugin.module && typeof plugin.module.deactivate === "function") {
      await plugin.module.deactivate();
    }
    plugins.delete(message.pluginId);
    post({ type: "deactivated", requestId: message.requestId });
  } catch (error) {
    plugins.delete(message.pluginId);
    post({ type: "deactivated", requestId: message.requestId,
      error: error instanceof Error ? error.message : String(error) });
  }
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

  if (message.type === "invokeOracle") {
    void invokeOracle(message);
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
  private readonly timeouts: typeof DEFAULT_TIMEOUTS;

  constructor(
    private readonly pluginRepository?: PluginRepository,
    private readonly pluginUi: PluginUiRegistry = pluginUiRegistry,
    options: ScriptPluginRuntimeOptions = {},
  ) {
    this.timeouts = { ...DEFAULT_TIMEOUTS, ...options };
  }

  async activatePlugin(
    input: ScriptPluginRuntimeActivateInput,
  ): Promise<ScriptPluginActivationResult> {
    if (this.plugins.has(input.pluginId)) {
      await this.deactivatePlugin(input.pluginId);
    }

    if (typeof Worker === "undefined" || typeof Blob === "undefined") {
      throw new Error("Script plugin runtime requires Worker support");
    }

    const workerUrl = URL.createObjectURL(
      new Blob([SCRIPT_PLUGIN_WORKER_SOURCE], { type: "application/javascript" }),
    );
    let worker: Worker;
    try {
      worker = new Worker(workerUrl);
    } finally {
      URL.revokeObjectURL(workerUrl);
    }
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
      void this.handleWorkerMessage(state, event.data);
    };
    worker.onerror = (event) => {
      const message = event.message || "Script plugin worker failed";
      input.onRuntimeError?.(message);
      this.terminateState(state, `Script plugin worker crashed: ${message}`);
    };

    const requestId = createRequestId(input.pluginId, "activate");
    const activation = new Promise<ScriptPluginActivationResult>(
      (resolve, reject) => {
        this.addPending(state, requestId, this.timeouts.activationTimeoutMs, "activation", {
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

    return activation.catch((error) => {
      this.terminateState(state, `Script plugin activation failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    });
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
      this.addPending(state, requestId, this.timeouts.commandTimeoutMs, `command ${commandId}`, {
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

  async deactivatePlugin(pluginId: string): Promise<void> {
    const state = this.plugins.get(pluginId);

    if (!state) {
      return;
    }
    if (state.deactivation) return state.deactivation;
    this.pluginUi.unregisterPlugin(pluginId);
    unregisterPluginOracleProviders(pluginId);
    this.rejectPending(state, "Script plugin was deactivated");
    const requestId = createRequestId(pluginId, "deactivate");
    state.deactivation = new Promise<void>((resolve) => {
      this.addPending(state, requestId, this.timeouts.deactivationTimeoutMs, "deactivation", {
        resolve: () => resolve(),
        reject: () => resolve(),
      }, false);
      state.worker.postMessage({ type: "deactivate", requestId, pluginId });
    }).finally(() => this.terminateState(state, "Script plugin was deactivated"));
    return state.deactivation;
  }

  private async handleWorkerMessage(
    state: WorkerPluginState,
    rawMessage: unknown,
  ): Promise<void> {
    if (this.plugins.get(state.pluginId) !== state) {
      return;
    }
    const pluginId = state.pluginId;

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
        this.failPluginMessage(pluginId, permissionDenied("oracleProviders:register"));
        return;
      }
      try {
        const namespacedId = `${pluginId}:${message.provider.id}`;
        registerOracleProvider({
          id: namespacedId,
          name: message.provider.name,
          description: message.provider.description ?? "",
          askYesNo: (input) => this.invokeOracleProvider(pluginId, message.provider.id, "askYesNo", input) as Promise<AskOracleResult>,
          setupScene: (input) => this.invokeOracleProvider(pluginId, message.provider.id, "setupScene", input) as Promise<SceneSetupResult>,
        }, pluginId);
      } catch (error) {
        this.failPluginMessage(pluginId, error);
      }
      return;
    }

    if (message.type === "unregisterOracleProvider") {
      unregisterOracleProvider(`${pluginId}:${message.providerId}`);
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
      if (message.requestId) {
        this.resolvePending(pluginId, message.requestId, {
          ok: false,
          error: message.message,
        });
      }
      state.onRuntimeError?.(message.message);
      return;
    }

    if (message.type === "activated") {
      this.resolvePending(pluginId, message.requestId, { ok: true });
      return;
    }

    if (message.type === "deactivated") {
      if (message.error) state.onRuntimeError?.(`Plugin deactivation failed: ${message.error}`);
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
        this.resolvePending(pluginId, message.requestId, {
          ok: false,
          error: error.message,
        });
        state.onRuntimeError?.(error.message);
        return;
      }
      this.resolvePending(pluginId, message.requestId, {
        ok: true,
        value: result,
      });
      return;
    }

    if (message.type === "oracleResult") {
      this.resolvePending(pluginId, message.requestId, { ok: true, value: message.result });
      return;
    }

    if (message.type === "oracleError") {
      state.onRuntimeError?.(message.message);
      this.resolvePending(pluginId, message.requestId, { ok: false, error: message.message });
      return;
    }

    if (message.type === "notify") {
      try {
        this.pluginUi.notify(pluginId, validateNotification(message.payload));
      } catch (error) {
        this.failPluginMessage(pluginId, error);
      }
      return;
    }

    if (message.type === "setStatus") {
      try {
        this.pluginUi.setStatus(pluginId, validateStatus(message.payload));
      } catch (error) {
        this.failPluginMessage(pluginId, error);
      }
      return;
    }

    if (message.type === "clearStatus") {
      try {
        this.pluginUi.clearStatus(pluginId, requireMessageString(message.payload, "Plugin status id", 128));
      } catch (error) {
        this.failPluginMessage(pluginId, error);
      }
      return;
    }
  }

  private invokeOracleProvider(
    pluginId: string,
    providerId: string,
    method: "askYesNo" | "setupScene",
    input: unknown,
  ): Promise<unknown> {
    const state = this.plugins.get(pluginId);
    if (!state) return Promise.reject(new Error(`Script plugin is not active: ${pluginId}`));
    const requestId = createRequestId(pluginId, `oracle:${method}`);
    const result = new Promise<unknown>((resolve, reject) => {
      this.addPending(state, requestId, this.timeouts.commandTimeoutMs, `oracle ${method}`, { resolve, reject });
    });
    state.worker.postMessage({ type: "invokeOracle", requestId, pluginId, providerId, method, input });
    return result.then((value) => ({
      ...validateOracleResult(method, value),
      providerId: `${pluginId}:${providerId}`,
    }));
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
      const value = await this.withTimeout(
        this.executeHostRequest(message.action, message.payload),
        this.timeouts.hostRequestTimeoutMs,
        `Host request ${message.action} timed out after ${this.timeouts.hostRequestTimeoutMs}ms`,
      );
      if (this.plugins.get(state.pluginId) !== state) return;
      state.worker.postMessage({
        type: "hostResponse",
        requestId: message.requestId,
        ok: true,
        value,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.plugins.get(state.pluginId) !== state) return;
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
    clearTimeout(pending.timer);

    if (result.ok) {
      pending.resolve(result.value);
    } else {
      pending.reject(createRuntimeError(result.error));
    }
  }

  private rejectPending(state: WorkerPluginState, message: string): void {
    for (const pending of state.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(createRuntimeError(message));
    }
    state.pending.clear();
  }

  private failPluginMessage(pluginId: string, error: unknown, requestId?: string): void {
    const message = `Invalid worker message: ${error instanceof Error ? error.message : String(error)}`;
    const state = this.plugins.get(pluginId);
    if (requestId) {
      this.resolvePending(pluginId, requestId, { ok: false, error: message });
      state?.onRuntimeError?.(message);
    } else {
      if (state) this.terminateState(state, message);
      state?.onRuntimeError?.(message);
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(createRuntimeError(message)), timeoutMs);
      promise.then(
        (value) => { clearTimeout(timer); resolve(value); },
        (error) => { clearTimeout(timer); reject(error); },
      );
    });
  }

  private addPending(
    state: WorkerPluginState,
    requestId: string,
    timeoutMs: number,
    action: string,
    callbacks: { resolve(value: unknown): void; reject(error: Error): void },
    terminateOnTimeout = true,
  ): void {
    const timer = setTimeout(() => {
      if (!state.pending.has(requestId)) return;
      state.pending.delete(requestId);
      const message = `Script plugin ${action} timed out after ${timeoutMs}ms`;
      callbacks.reject(createRuntimeError(message));
      state.onRuntimeError?.(message);
      if (terminateOnTimeout) this.terminateState(state, message);
    }, timeoutMs);
    state.pending.set(requestId, { ...callbacks, timer });
  }

  private terminateState(state: WorkerPluginState, message: string): void {
    if (this.plugins.get(state.pluginId) !== state) return;
    state.worker.onmessage = null;
    state.worker.onerror = null;
    state.worker.terminate();
    this.rejectPending(state, message);
    this.plugins.delete(state.pluginId);
    this.pluginUi.unregisterPlugin(state.pluginId);
    unregisterPluginOracleProviders(state.pluginId);
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
    case "deactivated":
      assertEnvelopeKeys(message, ["type", "requestId", "error"]);
      return { type, requestId: requestId(), ...(message.error === undefined ? {} : { error: errorMessage() }) };
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
    case "unregisterOracleProvider":
      assertEnvelopeKeys(message, ["type", "providerId"]);
      return { type, providerId: requireMessageString(message.providerId, "Oracle provider id", 128) };
    case "oracleResult":
      assertEnvelopeKeys(message, ["type", "requestId", "result"]);
      assertJsonSafe(message.result, "Oracle provider result");
      return { type, requestId: requestId(), result: message.result };
    case "oracleError":
      assertEnvelopeKeys(message, ["type", "requestId", "message"]);
      return { type, requestId: requestId(), message: errorMessage() };
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

function validateOracleResult(method: "askYesNo" | "setupScene", value: unknown): AskOracleResult | SceneSetupResult {
  const result = requireRecord(value, "Oracle provider result");
  if (method === "askYesNo") {
    assertEnvelopeKeys(result, ["question", "odds", "roll", "answer", "exceptional", "chaosFactor", "providerId", "providerName", "explanation"]);
    const odds = ["impossible", "no_way", "very_unlikely", "unlikely", "50_50", "likely", "very_likely", "near_sure", "sure_thing"];
    if (!odds.includes(result.odds as string)) throw new Error("Invalid oracle odds");
    if (result.answer !== "Yes" && result.answer !== "No") throw new Error("Invalid oracle answer");
    if (typeof result.exceptional !== "boolean") throw new Error("Oracle exceptional must be a boolean");
    return {
      question: requireMessageString(result.question, "Oracle question"),
      odds: result.odds as AskOracleResult["odds"],
      roll: requireFiniteNumber(result.roll, "Oracle roll"),
      answer: result.answer,
      exceptional: result.exceptional,
      chaosFactor: requireFiniteNumber(result.chaosFactor, "Oracle chaos factor"),
      providerId: requireMessageString(result.providerId, "Oracle result provider id", 128),
      providerName: requireMessageString(result.providerName, "Oracle result provider name", 128),
      explanation: requireMessageString(result.explanation, "Oracle explanation"),
    };
  }
  assertEnvelopeKeys(result, ["prompt", "roll", "chaosFactor", "adjustmentType", "providerId", "providerName", "explanation"]);
  return {
    prompt: requireMessageString(result.prompt, "Scene prompt"),
    roll: requireFiniteNumber(result.roll, "Scene roll"),
    chaosFactor: requireFiniteNumber(result.chaosFactor, "Scene chaos factor"),
    adjustmentType: requireMessageString(result.adjustmentType, "Scene adjustment type", 128),
    providerId: requireMessageString(result.providerId, "Scene result provider id", 128),
    providerName: requireMessageString(result.providerName, "Scene result provider name", 128),
    explanation: requireMessageString(result.explanation, "Scene explanation"),
  };
}

function requireFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

function validateNotification(value: unknown): PluginNotification {
  const notification = requireRecord(value, "Plugin notification");
  assertEnvelopeKeys(notification, ["level", "title", "message"]);
  const levels = ["info", "success", "warning", "error"] as const;
  if (!levels.includes(notification.level as (typeof levels)[number])) throw new Error("Invalid plugin notification level");
  return {
    level: notification.level as PluginNotification["level"],
    title: requireMessageString(notification.title, "Plugin notification title", 256),
    ...(notification.message === undefined ? {} : { message: requireMessageString(notification.message, "Plugin notification message") }),
  };
}

function validateStatus(value: unknown): PluginStatus {
  const status = requireRecord(value, "Plugin status");
  assertEnvelopeKeys(status, ["id", "level", "message"]);
  const levels = ["idle", "working", "success", "warning", "error"] as const;
  if (!levels.includes(status.level as (typeof levels)[number])) throw new Error("Invalid plugin status level");
  return {
    id: requireMessageString(status.id, "Plugin status id", 128),
    level: status.level as PluginStatus["level"],
    message: requireMessageString(status.message, "Plugin status message"),
  };
}

function assertEnvelopeKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`Unknown worker message field: ${unknown}`);
}
