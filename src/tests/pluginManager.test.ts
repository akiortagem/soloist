import { describe, expect, it } from "vitest";

import { CharacterSheetTemplateRegistry } from "../characterSheets/characterSheetTemplateRegistry";
import { SlashCommandRegistry } from "../commands/slashCommandRegistry";
import { OracleTableRegistry } from "../oracle/oracleRegistry";
import type {
  InstalledPluginRecord,
  PluginRepository,
} from "../persistence/pluginRepository";
import { PluginManager } from "../plugins/pluginManager";
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

describe("PluginManager", () => {
  it("loads enabled data plugin contributions into registries", async () => {
    const { manager, registries } = createManager([createPlugin(validManifest)]);

    const statuses = await manager.reload();

    expect(statuses).toMatchObject([
      {
        pluginId: validManifest.id,
        status: "loaded",
        contributions: {
          slashCommands: 1,
          oracleTables: 1,
          characterSheetTemplates: 1,
        },
      },
    ]);
    expect(registries.slashCommands.getByName("move")).toMatchObject({
      id: "soloist-plugin.ironsworn:move",
      pluginId: validManifest.id,
      commandText: "/roll 2d10",
    });
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
});
