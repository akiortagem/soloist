import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkerScriptPluginRuntime } from "../plugins/scriptPluginRuntime";
import { PluginUiRegistry } from "../plugins/pluginUiRegistry";
import { DEFAULT_ORACLE_PROVIDER_ID, getActiveOracleProvider, getOracleProvider, setActiveOracleProvider } from "../oracle/oracleRegistry";

type PostedMessage = Record<string, unknown>;

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: PostedMessage[] = [];
  commandResult: unknown = { type: "deleteCommand" };
  activationMessages: unknown[] = [];

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: PostedMessage) {
    this.messages.push(message);
    queueMicrotask(() => {
      if (message.type === "activate") {
        for (const data of this.activationMessages) {
          this.onmessage?.({ data } as MessageEvent);
        }
        this.onmessage?.({
          data: { type: "activated", requestId: message.requestId },
        } as MessageEvent);
      } else if (message.type === "executeCommand") {
        this.onmessage?.({
          data: {
            type: "commandResult",
            requestId: message.requestId,
            result: this.commandResult,
          },
        } as MessageEvent);
      } else if (message.type === "invokeOracle") {
        const input = message.input as Record<string, unknown>;
        const result = message.method === "askYesNo"
          ? { question: input.question, odds: input.odds, roll: input.d100, answer: "Yes", exceptional: false, chaosFactor: input.chaosFactor, providerId: "custom", providerName: "Custom", explanation: "Worker result" }
          : { prompt: input.prompt, roll: input.roll, chaosFactor: input.chaosFactor, adjustmentType: "Normal", providerId: "custom", providerName: "Custom", explanation: "Worker scene" };
        this.onmessage?.({ data: { type: "oracleResult", requestId: message.requestId, result } } as MessageEvent);
      }
    });
  }

  terminate() {}
}

const originalWorker = globalThis.Worker;
const originalCreateObjectUrl = URL.createObjectURL;

afterEach(() => {
  vi.restoreAllMocks();
  FakeWorker.instances = [];
  globalThis.Worker = originalWorker;
  URL.createObjectURL = originalCreateObjectUrl;
});

function installWorker() {
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
  URL.createObjectURL = vi.fn(() => "blob:plugin-runtime");
}

describe("script plugin runtime permissions", () => {
  it("allows declared document selection and insertion permissions", async () => {
    installWorker();
    const runtime = new WorkerScriptPluginRuntime();
    await runtime.activatePlugin({
      pluginId: "allowed",
      entryCode: "compiled-js",
      permissions: ["document:readSelection", "document:insertBlock"],
    });
    const worker = FakeWorker.instances[0];
    worker.commandResult = {
      type: "insertResultBlock",
      block: { type: "oracle" },
    };

    await expect(
      runtime.executeCommand("allowed", "command", {
        pluginId: "allowed",
        args: [],
        argsText: "",
        chaosFactor: 5,
        selectedText: "visible selection",
      }),
    ).resolves.toMatchObject({ type: "insertResultBlock" });
    expect(worker.messages[worker.messages.length - 1]?.context).toMatchObject({
      selectedText: "visible selection",
    });
  });

  it("denies undeclared document insertion and reports a runtime error", async () => {
    installWorker();
    const onRuntimeError = vi.fn();
    const runtime = new WorkerScriptPluginRuntime();
    await runtime.activatePlugin({
      pluginId: "denied",
      entryCode: "compiled-js",
      permissions: [],
      onRuntimeError,
    });
    FakeWorker.instances[0].commandResult = {
      type: "insertResultBlock",
      block: { type: "oracle" },
    };

    await expect(
      runtime.executeCommand("denied", "command", {
        pluginId: "denied",
        args: [],
        argsText: "",
        chaosFactor: 5,
        selectedText: "hidden selection",
      }),
    ).rejects.toThrow("Plugin permission denied: document:insertBlock");
    const messages = FakeWorker.instances[0].messages;
    expect(messages[messages.length - 1]?.context).toMatchObject({
      selectedText: null,
    });
    expect(onRuntimeError).toHaveBeenCalledWith(
      "Plugin permission denied: document:insertBlock",
    );
  });

  it("rejects duplicate plain-JavaScript registrations deterministically", async () => {
    installWorker();
    const runtime = new WorkerScriptPluginRuntime();
    const activation = runtime.activatePlugin({
      pluginId: "duplicates",
      entryCode: "compiled-js",
      permissions: ["slashCommands:register"],
    });
    FakeWorker.instances[0].activationMessages = [
      { type: "registerSlashCommand", command: { id: "same", name: "one", label: "One", prefix: "/one" } },
      { type: "registerSlashCommand", command: { id: "same", name: "two", label: "Two", prefix: "/two" } },
    ];

    await expect(activation).rejects.toThrow("Duplicate slash command id: same");
  });

  it("rejects malformed command results before resolving execution", async () => {
    installWorker();
    const onRuntimeError = vi.fn();
    const runtime = new WorkerScriptPluginRuntime();
    await runtime.activatePlugin({ pluginId: "bad-result", entryCode: "compiled-js", permissions: ["document:insertBlock"], onRuntimeError });
    FakeWorker.instances[0].commandResult = {
      type: "insertResultBlock",
      block: { type: "oracle", payload: { unsafe: undefined } },
    };

    await expect(runtime.executeCommand("bad-result", "command", {
      pluginId: "bad-result", args: [], argsText: "", chaosFactor: 5, selectedText: null,
    })).rejects.toThrow("must be JSON-safe");
    expect(onRuntimeError).toHaveBeenCalledWith(expect.stringContaining("Invalid worker message"));
  });

  it("fails safely on unknown worker message types", async () => {
    installWorker();
    const runtime = new WorkerScriptPluginRuntime();
    const activation = runtime.activatePlugin({
      pluginId: "unknown-message", entryCode: "compiled-js", permissions: [],
    });
    FakeWorker.instances[0].activationMessages = [{ type: "takeOverHost", payload: {} }];

    await expect(activation).rejects.toThrow("Unknown worker message type: takeOverHost");
  });

  it("applies notifications and namespaced status lifecycle to the host", async () => {
    installWorker();
    const ui = new PluginUiRegistry();
    const runtime = new WorkerScriptPluginRuntime(undefined, ui);
    const activation = runtime.activatePlugin({ pluginId: "feedback", entryCode: "compiled-js", permissions: [] });
    FakeWorker.instances[0].activationMessages = [
      { type: "notify", payload: { level: "success", title: "Ready", message: "Loaded" } },
      { type: "setStatus", payload: { id: "sync", level: "working", message: "Syncing" } },
      { type: "setStatus", payload: { id: "sync", level: "success", message: "Done" } },
    ];
    await activation;

    expect(ui.listNotifications()).toMatchObject([{ pluginId: "feedback", level: "success", title: "Ready" }]);
    expect(ui.listStatuses()).toEqual([expect.objectContaining({ id: "feedback:sync", contributionId: "sync", message: "Done" })]);

    FakeWorker.instances[0].onmessage?.({ data: { type: "clearStatus", payload: "sync" } } as MessageEvent);
    await Promise.resolve();
    expect(ui.listStatuses()).toEqual([]);

    FakeWorker.instances[0].onmessage?.({ data: { type: "setStatus", payload: { id: "left", level: "idle", message: "Waiting" } } } as MessageEvent);
    await Promise.resolve();
    runtime.deactivatePlugin("feedback");
    expect(ui.listStatuses()).toEqual([]);
  });

  it("rejects malformed notification and status payloads without applying them", async () => {
    installWorker();
    const ui = new PluginUiRegistry();
    const onRuntimeError = vi.fn();
    const runtime = new WorkerScriptPluginRuntime(undefined, ui);
    const activation = runtime.activatePlugin({ pluginId: "malformed", entryCode: "compiled-js", permissions: [], onRuntimeError });
    FakeWorker.instances[0].activationMessages = [
      { type: "notify", payload: { level: "loud", title: "Nope" } },
    ];

    await expect(activation).rejects.toThrow("Invalid plugin notification level");
    expect(ui.listNotifications()).toEqual([]);
    expect(ui.listStatuses()).toEqual([]);
    expect(onRuntimeError).toHaveBeenCalledWith(expect.stringContaining("Invalid worker message"));
  });

  it("registers, invokes, namespaces, disposes, and cleans up oracle providers", async () => {
    installWorker();
    const runtime = new WorkerScriptPluginRuntime();
    const activation = runtime.activatePlugin({ pluginId: "oracle-plugin", entryCode: "compiled-js", permissions: ["oracleProviders:register"] });
    FakeWorker.instances[0].activationMessages = [
      { type: "registerOracleProvider", provider: { id: "custom", name: "Custom", description: "Worker oracle" } },
    ];
    await activation;

    const provider = getOracleProvider("oracle-plugin:custom");
    await expect(provider?.askYesNo({ question: "Open?", odds: "likely", d100: 42, chaosFactor: 5 })).resolves.toMatchObject({
      providerId: "oracle-plugin:custom",
      answer: "Yes",
      roll: 42,
    });
    await expect(provider?.setupScene({ prompt: "Road", roll: 7, chaosFactor: 4 })).resolves.toMatchObject({
      providerId: "oracle-plugin:custom",
      adjustmentType: "Normal",
    });

    FakeWorker.instances[0].onmessage?.({ data: { type: "unregisterOracleProvider", providerId: "custom" } } as MessageEvent);
    await Promise.resolve();
    expect(getOracleProvider("oracle-plugin:custom")).toBeUndefined();

    FakeWorker.instances[0].onmessage?.({ data: { type: "registerOracleProvider", provider: { id: "custom", name: "Custom" } } } as MessageEvent);
    await Promise.resolve();
    setActiveOracleProvider("oracle-plugin:custom");
    runtime.deactivatePlugin("oracle-plugin");
    expect(getOracleProvider("oracle-plugin:custom")).toBeUndefined();
    expect(getActiveOracleProvider().id).toBe(DEFAULT_ORACLE_PROVIDER_ID);
  });

  it("rejects malformed oracle results without crashing the host", async () => {
    installWorker();
    const runtime = new WorkerScriptPluginRuntime();
    const activation = runtime.activatePlugin({ pluginId: "bad-oracle", entryCode: "compiled-js", permissions: ["oracleProviders:register"] });
    FakeWorker.instances[0].activationMessages = [
      { type: "registerOracleProvider", provider: { id: "bad", name: "Bad" } },
    ];
    await activation;
    const worker = FakeWorker.instances[0];
    const originalPost = worker.postMessage.bind(worker);
    worker.postMessage = (message) => {
      if (message.type === "invokeOracle") queueMicrotask(() => worker.onmessage?.({ data: { type: "oracleResult", requestId: message.requestId, result: { answer: "Maybe" } } } as MessageEvent));
      else originalPost(message);
    };

    await expect(getOracleProvider("bad-oracle:bad")?.askYesNo({ question: "?", odds: "50_50", d100: 1, chaosFactor: 5 })).rejects.toThrow();
    runtime.deactivatePlugin("bad-oracle");
  });
});
