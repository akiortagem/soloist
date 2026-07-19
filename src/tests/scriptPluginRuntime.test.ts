import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkerScriptPluginRuntime } from "../plugins/scriptPluginRuntime";

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
});
