import type {
  PluginCommandContext,
  PluginCommandExecutionResult,
} from "./pluginApi";
import type { PluginRepository } from "../persistence/pluginRepository";
import { pluginUiRegistry, type PluginUiRegistry } from "./pluginUiRegistry";
import { HostRequestDispatcher } from "../features/plugins/infrastructure/runtime/HostRequestDispatcher";
import { createGlobalRuntimeContributions, type RuntimeContributions } from "../features/plugins/infrastructure/runtime/RuntimeContributions";
import { BrowserWorkerTransport, type WorkerTransport } from "../features/plugins/infrastructure/runtime/WorkerTransport";
import { SCRIPT_PLUGIN_WORKER_SOURCE } from "../features/plugins/infrastructure/runtime/ScriptPluginWorkerSource";
import { validateOracleResult } from "../features/plugins/infrastructure/runtime/WorkerMessageValidation";
import { routeWorkerMessage } from "../features/plugins/infrastructure/runtime/WorkerMessageRouter";
import type {
  PendingResult,
  WorkerPluginSession,
} from "../features/plugins/infrastructure/runtime/RuntimeSessionTypes";
import type {
  ScriptPluginActivationResult,
  ScriptPluginRuntime,
  ScriptPluginRuntimeActivateInput,
  ScriptPluginRuntimeOptions,
} from "../features/plugins/application/ports/ScriptPluginRuntime";

export { SCRIPT_PLUGIN_WORKER_SOURCE } from "../features/plugins/infrastructure/runtime/ScriptPluginWorkerSource";

export type {
  ScriptPluginActivationResult,
  ScriptPluginRuntime,
  ScriptPluginRuntimeActivateInput,
  ScriptPluginRuntimeErrorHandler,
  ScriptPluginRuntimeOptions,
  ScriptPluginSlashCommandRegistration,
} from "../features/plugins/application/ports/ScriptPluginRuntime";

const DEFAULT_TIMEOUTS = {
  activationTimeoutMs: 10_000,
  commandTimeoutMs: 30_000,
  hostRequestTimeoutMs: 10_000,
  deactivationTimeoutMs: 1_000,
};

function createRequestId(pluginId: string, action: string) {
  return `${pluginId}:${action}:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function createRuntimeError(message: string) {
  return new Error(message);
}

export class WorkerScriptPluginRuntime implements ScriptPluginRuntime {
  private readonly plugins = new Map<string, WorkerPluginSession>();
  private readonly timeouts: typeof DEFAULT_TIMEOUTS;
  private readonly hostRequests: HostRequestDispatcher;

  constructor(
    private readonly pluginRepository?: PluginRepository,
    private readonly pluginUi: PluginUiRegistry = pluginUiRegistry,
    options: ScriptPluginRuntimeOptions = {},
    private readonly contributions: RuntimeContributions =
      createGlobalRuntimeContributions(),
    private readonly transport: WorkerTransport = new BrowserWorkerTransport(),
  ) {
    this.timeouts = { ...DEFAULT_TIMEOUTS, ...options };
    this.hostRequests = new HostRequestDispatcher(pluginRepository);
  }

  async activatePlugin(
    input: ScriptPluginRuntimeActivateInput,
  ): Promise<ScriptPluginActivationResult> {
    if (this.plugins.has(input.pluginId)) {
      await this.deactivatePlugin(input.pluginId);
    }

    const worker = this.transport.create(SCRIPT_PLUGIN_WORKER_SOURCE);
    const state: WorkerPluginSession = {
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
    this.contributions.unregisterPlugin(pluginId);
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
    state: WorkerPluginSession,
    rawMessage: unknown,
  ): Promise<void> {
    await routeWorkerMessage(
      {
        session: state,
        isCurrent: () => this.plugins.get(state.pluginId) === state,
        hostRequests: this.hostRequests,
        hostRequestTimeoutMs: this.timeouts.hostRequestTimeoutMs,
        pluginUi: this.pluginUi,
        contributions: this.contributions,
        resolve: (requestId, result) =>
          this.resolvePending(state.pluginId, requestId, result),
        fail: (error, requestId) =>
          this.failPluginMessage(state.pluginId, error, requestId),
        invokeOracle: (providerId, method, input) =>
          this.invokeOracleProvider(state.pluginId, providerId, method, input),
      },
      rawMessage,
    );
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

  private resolvePending(
    pluginId: string,
    requestId: string,
    result: PendingResult,
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

  private rejectPending(state: WorkerPluginSession, message: string): void {
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

  private addPending(
    state: WorkerPluginSession,
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

  private terminateState(state: WorkerPluginSession, message: string): void {
    if (this.plugins.get(state.pluginId) !== state) return;
    state.worker.onmessage = null;
    state.worker.onerror = null;
    state.worker.terminate();
    this.rejectPending(state, message);
    this.plugins.delete(state.pluginId);
    this.pluginUi.unregisterPlugin(state.pluginId);
    this.contributions.unregisterPlugin(state.pluginId);
  }
}
