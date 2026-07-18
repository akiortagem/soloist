import { describe, expect, it } from "vitest";
import type {
  PluginCommandExecutionResult,
  PluginCommandHandler,
  PluginOracleProvider,
  SoloistPluginApi,
  SoloistPluginModule,
} from "../plugins/pluginApi";

type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

const appStoreIsPrivate: HasKey<SoloistPluginApi, "appStore"> = false;
const repositoriesArePrivate: HasKey<SoloistPluginApi, "repositories"> = false;
const sqliteIsPrivate: HasKey<SoloistPluginApi, "sqlite"> = false;
const editorIsPrivate: HasKey<SoloistPluginApi, "editor"> = false;
const invokeIsPrivate: HasKey<SoloistPluginApi, "invoke"> = false;

describe("public script plugin api types", () => {
  it("exposes safe host methods without app internals", () => {
    const exposedKeys = [
      "pluginId",
      "storage",
      "registerSlashCommand",
      "registerOracleProvider",
      "notify",
      "setStatus",
      "clearStatus",
    ] satisfies Array<keyof SoloistPluginApi>;

    expect(exposedKeys).toEqual([
      "pluginId",
      "storage",
      "registerSlashCommand",
      "registerOracleProvider",
      "notify",
      "setStatus",
      "clearStatus",
    ]);
    expect(appStoreIsPrivate).toBe(false);
    expect(repositoriesArePrivate).toBe(false);
    expect(sqliteIsPrivate).toBe(false);
    expect(editorIsPrivate).toBe(false);
    expect(invokeIsPrivate).toBe(false);
  });

  it("supports future slash command and oracle registration", () => {
    const commandHandler: PluginCommandHandler = async (context, api) => {
      await api.storage.set("lastArgs", context.args);
      api.setStatus({
        id: "example.command",
        level: "working",
        message: `Running ${context.pluginId}`,
      });

      return {
        type: "insertResultBlock",
        display: "block",
        block: {
          type: "oracle",
          commandText: context.argsText,
          payload: {
            pluginId: context.pluginId,
            chaosFactor: context.chaosFactor,
            selectedText: context.selectedText,
          },
        },
      };
    };

    const oracleProvider: PluginOracleProvider = {
      id: "example-oracle",
      name: "Example Oracle",
      askYesNo(input) {
        return {
          question: input.question,
          odds: input.odds,
          roll: input.d100,
          answer: "Yes",
          exceptional: false,
          chaosFactor: input.chaosFactor,
          providerId: "example-oracle",
          providerName: "Example Oracle",
          explanation: "Example oracle result.",
        };
      },
      setupScene(input) {
        return {
          prompt: input.prompt,
          roll: input.roll,
          chaosFactor: input.chaosFactor,
          adjustmentType: "Expected",
          providerId: "example-oracle",
          providerName: "Example Oracle",
          explanation: "Example scene result.",
        };
      },
    };

    const module: SoloistPluginModule = {
      activate(api) {
        api.registerSlashCommand({
          id: "example",
          name: "example",
          label: "Example",
          prefix: "/example ",
          handler: commandHandler,
        });
        api.registerOracleProvider(oracleProvider);
        api.notify({ level: "info", title: "Example loaded" });
      },
    };

    expect(typeof module.activate).toBe("function");
  });

  it("limits command handlers to plugin-safe command results", () => {
    const result: PluginCommandExecutionResult = {
      type: "insertResultBlock",
      block: {
        type: "error",
        payload: {
          reason: "Example failure",
        },
      },
    };
    const deleteResult: PluginCommandExecutionResult = { type: "deleteCommand" };

    expect(result.type).toBe("insertResultBlock");
    expect(deleteResult.type).toBe("deleteCommand");
  });
});

const unsupportedSceneContainerResult: PluginCommandExecutionResult =
  // @ts-expect-error script plugins cannot directly create scene containers
  { type: "insertSceneContainer", payload: { id: "scene" } };

const unsupportedRawResultBlock: PluginCommandExecutionResult =
  // @ts-expect-error plugin result block payloads must be JSON-safe
  { type: "insertResultBlock", block: { type: "oracle", payload: () => null } };

void unsupportedSceneContainerResult;
void unsupportedRawResultBlock;
