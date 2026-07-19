import { Worker as NodeWorker } from "node:worker_threads";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CharacterSheetTemplateRegistry } from "../characterSheets/characterSheetTemplateRegistry";
import { executeCommand } from "../commands/executeCommand";
import { parseCommand } from "../commands/parseCommand";
import { SlashCommandRegistry } from "../commands/slashCommandRegistry";
import { OracleTableRegistry } from "../oracle/oracleRegistry";
import { PluginManager } from "../plugins/pluginManager";
import { WorkerScriptPluginRuntime } from "../plugins/scriptPluginRuntime";

const fixtureRoot = resolve("test-fixtures/script-plugins");
const originalWorker = globalThis.Worker;
const originalBlob = globalThis.Blob;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const workerSources = new Map();
let workerSequence = 0;

class CapturingBlob {
  constructor(parts) {
    this.source = parts.join("");
  }
}

class RealWorkerAdapter {
  onmessage = null;
  onerror = null;

  constructor(url) {
    const source = workerSources.get(String(url));
    if (!source) throw new Error(`Worker source not found: ${url}`);
    const bootstrap = `
      const { parentPort, workerData } = require("node:worker_threads");
      globalThis.self = globalThis;
      self.postMessage = (message) => parentPort.postMessage(message);
      parentPort.on("message", (data) => self.onmessage({ data }));
      (0, eval)(workerData);
    `;
    this.worker = new NodeWorker(bootstrap, { eval: true, workerData: source });
    this.worker.on("message", (data) => this.onmessage?.({ data }));
    this.worker.on("error", (error) => this.onerror?.({ message: error.message, error }));
  }

  postMessage(message) {
    this.worker.postMessage(message);
  }

  terminate() {
    void this.worker.terminate();
  }
}

class MemoryPluginRepository {
  constructor(plugin) {
    this.plugins = plugin ? [plugin] : [];
    this.storage = new Map();
  }
  async listInstalled() { return this.plugins; }
  async getStorage(pluginId, key) { return this.storage.get(`${pluginId}:${key}`) ?? null; }
  async setStorage(pluginId, key, value) { this.storage.set(`${pluginId}:${key}`, value); }
  async removeStorage(pluginId, key) { this.storage.delete(`${pluginId}:${key}`); }
  async listStorageKeys(pluginId) {
    return [...this.storage.keys()].filter((key) => key.startsWith(`${pluginId}:`)).map((key) => key.slice(pluginId.length + 1)).sort();
  }
  async clearStorage(pluginId) {
    for (const key of [...this.storage.keys()]) if (key.startsWith(`${pluginId}:`)) this.storage.delete(key);
  }
  async uninstall(pluginId) {
    this.plugins = this.plugins.filter((plugin) => plugin.id !== pluginId);
    await this.clearStorage(pluginId);
  }
}

function installRealWorker() {
  globalThis.Blob = CapturingBlob;
  URL.createObjectURL = (blob) => {
    const url = `real-worker:${++workerSequence}`;
    workerSources.set(url, blob.source);
    return url;
  };
  URL.revokeObjectURL = () => {};
  globalThis.Worker = RealWorkerAdapter;
}

async function fixture(name) {
  const manifest = JSON.parse(await readFile(resolve(fixtureRoot, name, "plugin.json"), "utf8"));
  let entryCode = "";
  try { entryCode = await readFile(resolve(fixtureRoot, name, manifest.entry), "utf8"); } catch {}
  return {
    manifest,
    entryCode,
    record: {
      id: manifest.id, name: manifest.name, version: manifest.version, type: manifest.type,
      enabled: true, manifest, installedAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

function harness(record, entryCode) {
  const repository = new MemoryPluginRepository(record);
  const registries = {
    slashCommands: new SlashCommandRegistry(),
    oracleTables: new OracleTableRegistry(),
    characterSheetTemplates: new CharacterSheetTemplateRegistry(),
  };
  const runtime = new WorkerScriptPluginRuntime(repository, undefined, {
    activationTimeoutMs: 2_000, commandTimeoutMs: 2_000, hostRequestTimeoutMs: 2_000, deactivationTimeoutMs: 500,
  });
  const manager = new PluginManager(repository, { registries, scriptRuntime: runtime, readPluginEntry: async () => entryCode });
  return { repository, registries, runtime, manager };
}

afterEach(() => {
  globalThis.Worker = originalWorker;
  globalThis.Blob = originalBlob;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  workerSources.clear();
});

describe("packaged compiled script plugin production lifecycle", () => {
  it("activates in a real worker, executes and inserts a result, stores locally, then cleans up", async () => {
    installRealWorker();
    const { record, entryCode } = await fixture("valid");
    const { repository, registries, runtime, manager } = harness(record, entryCode);

    await expect(manager.reload()).resolves.toMatchObject([{
      pluginId: "soloist-plugin.e2e", status: "loaded", permissions: ["storage", "slashCommands:register", "document:insertBlock"],
      contributions: { slashCommands: 1 },
    }]);
    const command = parseCommand("/hello Ada", registries.slashCommands);
    await expect(executeCommand(command, { chaosFactor: 5, isInsideCombatSpace: false })).resolves.toMatchObject({
      type: "insertResultBlock", display: "block",
      block: { type: "oracle", commandText: "/hello Ada", payload: { message: "Hello Ada", executions: 1 } },
    });
    await expect(repository.getStorage(record.id, "activations")).resolves.toBe(1);
    await expect(repository.getStorage(record.id, "executions")).resolves.toBe(1);

    record.enabled = false;
    await expect(manager.reload()).resolves.toMatchObject([{ status: "disabled" }]);
    expect(registries.slashCommands.getByName("hello")).toBeUndefined();
    await expect(runtime.executeCommand(record.id, "hello", {})).rejects.toThrow("not active");

    record.enabled = true;
    await manager.reload();
    expect(registries.slashCommands.getByName("hello")).toBeDefined();
    await repository.uninstall(record.id);
    await manager.reload();
    expect(registries.slashCommands.list()).toEqual([]);
    await expect(repository.getStorage(record.id, "activations")).resolves.toBeNull();
    await expect(runtime.executeCommand(record.id, "hello", {})).rejects.toThrow("not active");
  });

  it.each([
    ["syntax-error", "Unexpected token"],
    ["activation-failure", "fixture activation failed"],
    ["malformed-registration", "name must be a string"],
    ["denied-permission", "Plugin permission denied: storage"],
  ])("fails %s activation without contributions or unrelated mutation", async (name, errorText) => {
    installRealWorker();
    const { record, entryCode } = await fixture(name);
    const { repository, registries, manager } = harness(record, entryCode);
    repository.storage.set("unrelated:keep", true);

    await expect(manager.reload()).resolves.toMatchObject([{ status: "error", errors: [{ message: expect.stringContaining(errorText) }] }]);
    expect(registries.slashCommands.list()).toEqual([]);
    expect(repository.storage.get("unrelated:keep")).toBe(true);
  });

  it("rejects a malformed command result without crashing or inserting it", async () => {
    installRealWorker();
    const { record, entryCode } = await fixture("malformed-result");
    const { registries, manager } = harness(record, entryCode);
    await manager.reload();
    const command = parseCommand("/bad", registries.slashCommands);
    await expect(executeCommand(command, { chaosFactor: 5, isInsideCombatSpace: false })).resolves.toMatchObject({
      type: "insertResultBlock", block: { type: "error", payload: { reason: expect.stringContaining("Unknown plugin command result type") } },
    });
  });
});
