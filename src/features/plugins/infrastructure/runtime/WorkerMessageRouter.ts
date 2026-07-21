import type { PluginCommandExecutionResult } from "../../../../plugins/pluginApi";
import {
  requireMessageString,
  validatePluginCommandExecutionResult,
  validateSlashCommandRegistration,
} from "../../../../plugins/pluginValidation";
import type { PluginUiRegistry } from "../../../../plugins/pluginUiRegistry";
import type {
  AskOracleResult,
  SceneSetupResult,
} from "../../../../oracle/oracleTypes";
import { HostRequestDispatcher } from "./HostRequestDispatcher";
import {
  permissionDenied,
  RuntimePermissionPolicy,
} from "./RuntimePermissionPolicy";
import type { RuntimeContributions } from "./RuntimeContributions";
import {
  validateNotification,
  validateStatus,
} from "./RuntimePayloadValidation";
import type { PendingResult, WorkerPluginSession } from "./RuntimeSessionTypes";
import {
  validateWorkerMessage,
  type WorkerMessage,
} from "./WorkerMessageValidation";

type RouterContext = {
  session: WorkerPluginSession;
  isCurrent(): boolean;
  hostRequests: HostRequestDispatcher;
  hostRequestTimeoutMs: number;
  pluginUi: PluginUiRegistry;
  contributions: RuntimeContributions;
  resolve(requestId: string, result: PendingResult): void;
  fail(error: unknown, requestId?: string): void;
  invokeOracle(
    providerId: string,
    method: "askYesNo" | "setupScene",
    input: unknown,
  ): Promise<unknown>;
};

export async function routeWorkerMessage(
  context: RouterContext,
  rawMessage: unknown,
): Promise<void> {
  if (!context.isCurrent()) return;
  let message: WorkerMessage;
  try {
    message = validateWorkerMessage(rawMessage);
  } catch (error) {
    context.fail(error);
    return;
  }
  if (await routeContribution(context, message)) return;
  if (message.type === "hostRequest") {
    await handleHostRequest(context, message);
    return;
  }
  routeResult(context, message);
}

async function routeContribution(
  context: RouterContext,
  message: WorkerMessage,
): Promise<boolean> {
  const { session } = context;
  if (message.type === "registerSlashCommand") {
    if (!session.permissions.has("slashCommands:register")) {
      session.onRuntimeError?.(
        permissionDenied("slashCommands:register").message,
      );
      return true;
    }
    try {
      const command = validateSlashCommandRegistration(message.command);
      if (session.slashCommands.some(({ id }) => id === command.id))
        throw new Error(`Duplicate slash command id: ${command.id}`);
      if (
        session.slashCommands.some(
          ({ name }) => name.toLowerCase() === command.name.toLowerCase(),
        )
      )
        throw new Error(`Duplicate slash command name: ${command.name}`);
      session.slashCommands.push(command);
    } catch (error) {
      context.fail(error);
    }
    return true;
  }
  if (message.type === "registerOracleProvider") {
    if (!session.permissions.has("oracleProviders:register")) {
      context.fail(permissionDenied("oracleProviders:register"));
      return true;
    }
    try {
      const providerId = message.provider.id;
      context.contributions.registerOracleProvider(session.pluginId, {
        id: `${session.pluginId}:${providerId}`,
        name: message.provider.name,
        description: message.provider.description ?? "",
        askYesNo: (input) =>
          context.invokeOracle(
            providerId,
            "askYesNo",
            input,
          ) as Promise<AskOracleResult>,
        setupScene: (input) =>
          context.invokeOracle(
            providerId,
            "setupScene",
            input,
          ) as Promise<SceneSetupResult>,
      });
    } catch (error) {
      context.fail(error);
    }
    return true;
  }
  if (message.type === "unregisterOracleProvider") {
    context.contributions.unregisterOracleProvider(
      `${session.pluginId}:${message.providerId}`,
    );
    return true;
  }
  return false;
}

function routeResult(context: RouterContext, message: WorkerMessage): void {
  const { session } = context;
  if (
    message.type === "activationError" ||
    message.type === "commandError" ||
    message.type === "runtimeError"
  ) {
    if (message.requestId)
      context.resolve(message.requestId, { ok: false, error: message.message });
    session.onRuntimeError?.(message.message);
  } else if (message.type === "activated") {
    context.resolve(message.requestId, { ok: true });
  } else if (message.type === "deactivated") {
    if (message.error)
      session.onRuntimeError?.(`Plugin deactivation failed: ${message.error}`);
    context.resolve(message.requestId, { ok: true });
  } else if (message.type === "commandResult") {
    handleCommandResult(context, message.requestId, message.result);
  } else if (message.type === "oracleResult") {
    context.resolve(message.requestId, { ok: true, value: message.result });
  } else if (message.type === "oracleError") {
    session.onRuntimeError?.(message.message);
    context.resolve(message.requestId, { ok: false, error: message.message });
  } else if (message.type === "notify") {
    applyUi(context, () =>
      context.pluginUi.notify(
        session.pluginId,
        validateNotification(message.payload),
      ),
    );
  } else if (message.type === "setStatus") {
    applyUi(context, () =>
      context.pluginUi.setStatus(
        session.pluginId,
        validateStatus(message.payload),
      ),
    );
  } else if (message.type === "clearStatus") {
    applyUi(context, () =>
      context.pluginUi.clearStatus(
        session.pluginId,
        requireMessageString(message.payload, "Plugin status id", 128),
      ),
    );
  }
}

function handleCommandResult(
  context: RouterContext,
  requestId: string,
  rawResult: unknown,
): void {
  let result: PluginCommandExecutionResult;
  try {
    result = validatePluginCommandExecutionResult(rawResult);
  } catch (error) {
    context.fail(error, requestId);
    return;
  }
  if (
    result.type === "insertResultBlock" &&
    !context.session.permissions.has("document:insertBlock")
  ) {
    const error = permissionDenied("document:insertBlock");
    context.resolve(requestId, { ok: false, error: error.message });
    context.session.onRuntimeError?.(error.message);
    return;
  }
  context.resolve(requestId, { ok: true, value: result });
}

async function handleHostRequest(
  context: RouterContext,
  message: Extract<WorkerMessage, { type: "hostRequest" }>,
): Promise<void> {
  try {
    if (message.payload.pluginId !== context.session.pluginId)
      throw new Error("Host request pluginId does not match the active plugin");
    if (message.action.startsWith("storage."))
      new RuntimePermissionPolicy(context.session.permissions).require(
        "storage",
      );
    const value = await withTimeout(
      context.hostRequests.dispatch(message.action, message.payload),
      context.hostRequestTimeoutMs,
      `Host request ${message.action} timed out after ${context.hostRequestTimeoutMs}ms`,
    );
    if (context.isCurrent())
      context.session.worker.postMessage({
        type: "hostResponse",
        requestId: message.requestId,
        ok: true,
        value,
      });
  } catch (error) {
    if (context.isCurrent())
      context.session.worker.postMessage({
        type: "hostResponse",
        requestId: message.requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
  }
}

function applyUi(context: RouterContext, action: () => void): void {
  try {
    action();
  } catch (error) {
    context.fail(error);
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
