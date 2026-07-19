import { describe, expect, it } from "vitest";

import { CharacterSheetTemplateRegistry } from "../characterSheets/characterSheetTemplateRegistry";
import { executeCommand } from "../commands/executeCommand";
import { parseCommand } from "../commands/parseCommand";
import { SlashCommandRegistry } from "../commands/slashCommandRegistry";
import { OracleTableRegistry } from "../oracle/oracleRegistry";
import type {
  InstalledPluginRecord,
  PluginRepository,
} from "../persistence/pluginRepository";
import { PluginManager } from "../plugins/pluginManager";
import type {
  ScriptPluginRuntime,
  ScriptPluginRuntimeActivateInput,
  ScriptPluginSlashCommandRegistration,
} from "../plugins/scriptPluginRuntime";
import type { PluginManifest } from "../plugins/pluginTypes";

const validManifest: PluginManifest = {
  id: "soloist-plugin.ironsworn",
  name: "Ironsworn Data",
  version: "1.0.0",
  soloistApiVersion: "1",
  type: "data",
  contributes: {
    slashCommands: [
      {
        id: "move",
        name: "move",
        label: "Roll Move",
        prefix: "/move ",
        commandText: "/roll 2d10",
      },
      {
        id: "omen",
        name: "omen",
        label: "Draw Omen",
        prefix: "/omen",
        tableId: "omens",
      },
    ],
    randomTables: [
      {
        id: "omens",
        name: "Omens",
        dice: "1d100",
        entries: [{ id: "storm", min: 1, max: 100, text: "Storm" }],
      },
    ],
    oracleTables: [
      {
        id: "action",
        name: "Action",
        dice: "1d100",
        entries: [{ id: "scheme", min: 1, max: 2, text: "Scheme" }],
      },
    ],
    characterSheetTemplates: [
      {
        id: "ironlander",
        name: "Ironlander",
        fields: [
          {
            id: "edge",
            kind: "field",
            name: "Edge",
            type: "number",
            defaultValue: 1,
          },
        ],
      },
    ],
  },
};

class FakePluginRepository {
  constructor(private plugins: InstalledPluginRecord[] = []) {}

  async listInstalled() {
    return this.plugins;
  }

  setPlugins(plugins: InstalledPluginRecord[]) {
    this.plugins = plugins;
  }
}

class FakeScriptPluginRuntime implements ScriptPluginRuntime {
  activated: ScriptPluginRuntimeActivateInput[] = [];
  commandRegistrations: ScriptPluginSlashCommandRegistration[] = [
    {
      id: "hello",
      name: "hello",
      label: "Hello",
      prefix: "/hello ",
      description: "Say hello.",
    },
  ];
  executeResult = {
    type: "insertResultBlock",
    display: "block",
    block: {
      type: "oracle",
      payload: {
        text: "Hello from script plugin.",
      },
    },
  } as const;

  async activatePlugin(input: ScriptPluginRuntimeActivateInput) {
    this.activated.push(input);
    return {
      slashCommands: this.commandRegistrations,
    };
  }

  async executeCommand() {
    return this.executeResult;
  }

  deactivatePlugin() {}
}

function createPlugin(
  manifest: PluginManifest,
  input?: Partial<InstalledPluginRecord>,
): InstalledPluginRecord {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    type: manifest.type,
    enabled: true,
    manifest,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  };
}

function createManager(plugins: InstalledPluginRecord[]) {
  const repository = new FakePluginRepository(plugins);
  const registries = {
    slashCommands: new SlashCommandRegistry(),
    oracleTables: new OracleTableRegistry(),
    characterSheetTemplates: new CharacterSheetTemplateRegistry(),
  };

  return {
    manager: new PluginManager(
      repository as unknown as PluginRepository,
      registries,
    ),
    repository,
    registries,
  };
}

const scriptManifest: PluginManifest = {
  id: "soloist-plugin.script",
  name: "Script Plugin",
  version: "1.0.0",
  soloistApiVersion: "1",
  type: "script",
  entry: "dist/plugin.js",
  permissions: ["slashCommands:register", "document:insertBlock"],
};

describe("PluginManager", () => {
  it("loads enabled data plugin contributions into registries", async () => {
    const { manager, registries } = createManager([createPlugin(validManifest)]);

    const statuses = await manager.reload();

    expect(statuses).toMatchObject([
      {
        pluginId: validManifest.id,
        pluginType: "data",
        status: "loaded",
        contributions: {
          slashCommands: 2,
          oracleTables: 2,
          characterSheetTemplates: 1,
        },
      },
    ]);
    expect(registries.slashCommands.getByName("move")).toMatchObject({
      id: "soloist-plugin.ironsworn:move",
      pluginId: validManifest.id,
      commandText: "/roll 2d10",
    });
    expect(registries.slashCommands.getByName("omen")).toMatchObject({
      id: "soloist-plugin.ironsworn:omen",
      pluginId: validManifest.id,
      tableId: "soloist-plugin.ironsworn:omens",
    });
    expect(parseCommand("/omen", registries.slashCommands)).toEqual({
      type: "pluginRandomTable",
      raw: "/omen",
      commandName: "omen",
      pluginId: validManifest.id,
      tableId: "soloist-plugin.ironsworn:omens",
    });
    expect(
      registries.oracleTables.get("soloist-plugin.ironsworn:omens")?.entries[0]
        .text,
    ).toBe("Storm");
    expect(
      registries.oracleTables.get("soloist-plugin.ironsworn:action")?.entries[0]
        .text,
    ).toBe("Scheme");
    expect(
      registries.characterSheetTemplates.get(
        "soloist-plugin.ironsworn:ironlander",
      )?.fields[0],
    ).toMatchObject({ id: "edge", name: "Edge" });
  });

  it("removes disabled plugin contributions after reload", async () => {
    const { manager, repository, registries } = createManager([
      createPlugin(validManifest),
    ]);
    await manager.reload();

    repository.setPlugins([
      createPlugin(validManifest, {
        enabled: false,
      }),
    ]);
    const statuses = await manager.reload();

    expect(statuses[0]).toMatchObject({
      pluginId: validManifest.id,
      status: "disabled",
    });
    expect(registries.slashCommands.getByName("move")).toBeUndefined();
    expect(registries.slashCommands.getByName("omen")).toBeUndefined();
    expect(
      registries.oracleTables.get("soloist-plugin.ironsworn:omens"),
    ).toBeUndefined();
    expect(
      registries.oracleTables.get("soloist-plugin.ironsworn:action"),
    ).toBeUndefined();
    expect(
      registries.characterSheetTemplates.get(
        "soloist-plugin.ironsworn:ironlander",
      ),
    ).toBeUndefined();
  });

  it("skips invalid manifests and exposes displayable status errors", async () => {
    const invalidManifest = {
      ...validManifest,
      id: "",
    } as PluginManifest;
    const { manager, registries } = createManager([
      createPlugin(invalidManifest, {
        id: "soloist-plugin.invalid",
        name: "Invalid",
      }),
    ]);

    const statuses = await manager.reload();

    expect(statuses).toMatchObject([
      {
        pluginId: "soloist-plugin.invalid",
        status: "invalid",
        errors: [
          {
            path: "$.id",
            code: "EMPTY_STRING",
            message: "id cannot be empty",
          },
        ],
      },
    ]);
    expect(registries.slashCommands.list()).toEqual([]);
    expect(registries.oracleTables.list()).toEqual([]);
    expect(registries.characterSheetTemplates.list()).toEqual([]);
  });

  it("continues loading valid plugins when another plugin is invalid", async () => {
    const invalidManifest = {
      ...validManifest,
      name: "",
    } as PluginManifest;
    const validOtherManifest: PluginManifest = {
      ...validManifest,
      id: "soloist-plugin.other",
      contributes: {
        slashCommands: [
          {
            id: "other",
            name: "other",
            label: "Other",
            prefix: "/other",
            commandText: "/roll 1d6",
          },
        ],
      },
    };
    const { manager, registries } = createManager([
      createPlugin(invalidManifest, {
        id: "soloist-plugin.invalid",
        name: "Invalid",
      }),
      createPlugin(validOtherManifest),
    ]);

    const statuses = await manager.reload();

    expect(statuses.map((status) => status.status)).toEqual([
      "invalid",
      "loaded",
    ]);
    expect(registries.slashCommands.getByName("other")).toMatchObject({
      pluginId: "soloist-plugin.other",
    });
  });

  it("loads script plugin entry code and registers runtime slash commands", async () => {
    const repository = new FakePluginRepository([createPlugin(scriptManifest)]);
    const registries = {
      slashCommands: new SlashCommandRegistry(),
      oracleTables: new OracleTableRegistry(),
      characterSheetTemplates: new CharacterSheetTemplateRegistry(),
    };
    const runtime = new FakeScriptPluginRuntime();
    const manager = new PluginManager(
      repository as unknown as PluginRepository,
      {
        registries,
        scriptRuntime: runtime,
        readPluginEntry: async ({ pluginId, entry }) =>
          `${pluginId}:${entry}:compiled-js`,
      },
    );

    const statuses = await manager.reload();
    const parsed = parseCommand("/hello traveler", registries.slashCommands);

    expect(runtime.activated[0]).toMatchObject({
      pluginId: scriptManifest.id,
      entryCode: "soloist-plugin.script:dist/plugin.js:compiled-js",
    });
    expect(statuses).toMatchObject([
      {
        pluginId: scriptManifest.id,
        status: "loaded",
        contributions: {
          slashCommands: 1,
        },
      },
    ]);
    expect(registries.slashCommands.getByName("hello")).toMatchObject({
      id: "soloist-plugin.script:hello",
      pluginId: scriptManifest.id,
    });
    expect(parsed).toMatchObject({
      type: "scriptPlugin",
      raw: "/hello traveler",
      commandName: "hello",
      pluginId: scriptManifest.id,
      commandId: "hello",
      args: ["traveler"],
      argsText: "traveler",
    });
  });

  it("applies script command output through the safe command-result model", async () => {
    const repository = new FakePluginRepository([createPlugin(scriptManifest)]);
    const registries = {
      slashCommands: new SlashCommandRegistry(),
      oracleTables: new OracleTableRegistry(),
      characterSheetTemplates: new CharacterSheetTemplateRegistry(),
    };
    const runtime = new FakeScriptPluginRuntime();
    const manager = new PluginManager(
      repository as unknown as PluginRepository,
      {
        registries,
        scriptRuntime: runtime,
        readPluginEntry: async () => "compiled-js",
      },
    );
    await manager.reload();

    const parsed = parseCommand("/hello traveler", registries.slashCommands);
    const result = await executeCommand(parsed, {
      chaosFactor: 6,
      isInsideCombatSpace: false,
    });

    expect(result).toMatchObject({
      type: "insertResultBlock",
      display: "block",
      block: {
        type: "oracle",
        commandText: "/hello traveler",
        payload: {
          text: "Hello from script plugin.",
        },
      },
    });
  });

  it("reports script runtime errors through plugin status without throwing", async () => {
    const repository = new FakePluginRepository([createPlugin(scriptManifest)]);
    const runtime: ScriptPluginRuntime = {
      async activatePlugin(input) {
        input.onRuntimeError?.("Script exploded");
        throw new Error("Script exploded");
      },
      async executeCommand() {
        throw new Error("Should not execute");
      },
      deactivatePlugin() {},
    };
    const manager = new PluginManager(
      repository as unknown as PluginRepository,
      {
        scriptRuntime: runtime,
        readPluginEntry: async () => "compiled-js",
      },
    );

    const statuses = await manager.reload();

    expect(statuses).toMatchObject([
      {
        pluginId: scriptManifest.id,
        status: "error",
        errors: [
          {
            path: "$",
            code: "INVALID_FIELD_VALUE",
            message: "Script exploded",
          },
        ],
      },
    ]);
  });
});
