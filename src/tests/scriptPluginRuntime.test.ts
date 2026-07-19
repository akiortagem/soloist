import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkerScriptPluginRuntime } from "../plugins/scriptPluginRuntime";

type PostedMessage = Record<string, unknown>;

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: PostedMessage[] = [];
  commandResult: unknown = { type: "deleteCommand" };

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: PostedMessage) {
    this.messages.push(message);
    queueMicrotask(() => {
      if (message.type === "activate") {
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
});
