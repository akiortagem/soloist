export const SCRIPT_PLUGIN_WORKER_SOURCE = `
const plugins = new Map();
const hostRequests = new Map();
const post = (message) => self.postMessage(message);

function hostRequest(pluginId, action, payload) {
  const requestId = pluginId + ":host:" + Math.random().toString(36).slice(2);
  post({ type: "hostRequest", requestId, action, payload: { pluginId, ...payload } });
  return new Promise((resolve, reject) => hostRequests.set(requestId, { resolve, reject }));
}

function createApi(pluginId, handlers, permissions) {
  const requirePermission = (permission) => {
    if (!permissions.has(permission)) throw new Error("Plugin permission denied: " + permission);
  };
  return {
    pluginId,
    storage: {
      get(key) { requirePermission("storage"); return hostRequest(pluginId, "storage.get", { key }); },
      set(key, value) { requirePermission("storage"); return hostRequest(pluginId, "storage.set", { key, value }); },
      remove(key) { requirePermission("storage"); return hostRequest(pluginId, "storage.remove", { key }); },
      keys() { requirePermission("storage"); return hostRequest(pluginId, "storage.keys", {}); },
      clear() { requirePermission("storage"); return hostRequest(pluginId, "storage.clear", {}); },
    },
    registerSlashCommand(command) {
      requirePermission("slashCommands:register");
      if (!command || typeof command !== "object" || typeof command.handler !== "function")
        throw new Error("registerSlashCommand requires a command handler");
      const safeCommand = {
        id: command.id, name: command.name, label: command.label, prefix: command.prefix,
        description: typeof command.description === "string" ? command.description : undefined,
      };
      handlers.set(safeCommand.id, command.handler);
      post({ type: "registerSlashCommand", command: safeCommand });
      return { dispose() { handlers.delete(safeCommand.id); } };
    },
    registerOracleProvider(provider) {
      requirePermission("oracleProviders:register");
      if (!provider || typeof provider !== "object" ||
          typeof provider.askYesNo !== "function" || typeof provider.setupScene !== "function")
        throw new Error("registerOracleProvider requires askYesNo and setupScene handlers");
      const safeProvider = {
        id: provider.id, name: provider.name,
        description: typeof provider.description === "string" ? provider.description : undefined,
      };
      if (handlers.oracleProviders.has(safeProvider.id))
        throw new Error("Duplicate oracle provider id: " + safeProvider.id);
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
    notify(notification) { post({ type: "notify", payload: notification }); },
    setStatus(status) { post({ type: "setStatus", payload: status }); },
    clearStatus(statusId) { post({ type: "clearStatus", payload: statusId }); },
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
    const run = new Function("module", "exports",
      message.entryCode + "\\n//# sourceURL=soloist-plugin://" + message.pluginId);
    run(module, exports);
    const pluginModule = module.exports && Object.keys(module.exports).length > 0
      ? module.exports.default || module.exports : self.soloistPlugin;
    if (!pluginModule || typeof pluginModule.activate !== "function")
      throw new Error("Script plugin entry must export an activate(api) function");
    await pluginModule.activate(api);
    plugins.set(message.pluginId, { handlers, api, module: pluginModule, permissions });
    post({ type: "activated", requestId: message.requestId });
  } catch (error) {
    post({ type: "activationError", requestId: message.requestId,
      message: error instanceof Error ? error.message : String(error) });
  }
}

async function executeCommand(message) {
  const plugin = plugins.get(message.pluginId);
  const handler = plugin && plugin.handlers.get(message.commandId);
  if (!handler) {
    post({ type: "commandError", requestId: message.requestId,
      message: "Script plugin command handler is not registered: " + message.commandId });
    return;
  }
  try {
    post({ type: "commandResult", requestId: message.requestId,
      result: await handler(message.context, plugin.api) });
  } catch (error) {
    post({ type: "commandError", requestId: message.requestId,
      message: error instanceof Error ? error.message : String(error) });
  }
}

async function invokeOracle(message) {
  const plugin = plugins.get(message.pluginId);
  const provider = plugin && plugin.handlers.oracleProviders.get(message.providerId);
  const handler = provider && provider[message.method];
  if (typeof handler !== "function") {
    post({ type: "oracleError", requestId: message.requestId,
      message: "Oracle provider handler is not registered" });
    return;
  }
  try {
    post({ type: "oracleResult", requestId: message.requestId,
      result: await handler.call(provider, message.input) });
  } catch (error) {
    post({ type: "oracleError", requestId: message.requestId,
      message: error instanceof Error ? error.message : String(error) });
  }
}

async function deactivatePlugin(message) {
  const plugin = plugins.get(message.pluginId);
  try {
    if (plugin && plugin.module && typeof plugin.module.deactivate === "function")
      await plugin.module.deactivate();
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
    message.ok ? pending.resolve(message.value)
      : pending.reject(new Error(message.error || "Host request failed"));
    return;
  }
  if (message.type === "activate") void activatePlugin(message);
  else if (message.type === "executeCommand") void executeCommand(message);
  else if (message.type === "invokeOracle") void invokeOracle(message);
  else if (message.type === "deactivate") void deactivatePlugin(message);
};
`;
