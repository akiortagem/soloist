import { describe, expect, it } from "vitest";
import type { CharacterSheetTemplate } from "../domain/domainTypes";
import {
  createUniqueTemplateName,
  importCharacterSheetTemplatesFromPlugins,
  reinstallPluginCharacterSheetTemplate,
} from "../plugins/characterSheetTemplateImporter";
import type { PluginManifest } from "../plugins/pluginTypes";

const manifest: PluginManifest = {
  id: "soloist-plugin.simple-char",
  name: "Simple Character",
  version: "1.0.0",
  soloistApiVersion: "1",
  type: "data",
  contributes: {
    characterSheetTemplates: [
      {
        id: "simple-adventurer",
        name: "Simple Adventurer",
        fields: [
          {
            id: "hp",
            kind: "field",
            name: "HP",
            type: "number",
            defaultValue: 10,
          },
        ],
      },
    ],
  },
};

class FakeCharacterSheetRepository {
  private nextTemplateId = 1;
  readonly templates: CharacterSheetTemplate[] = [];

  async listTemplates() {
    return [...this.templates].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  async createTemplate(input: {
    name: string;
    fields?: CharacterSheetTemplate["fields"];
    sourcePluginId?: string;
    sourceContributionId?: string;
  }) {
    const template: CharacterSheetTemplate = {
      id: `template_${this.nextTemplateId}`,
      name: input.name,
      fields: input.fields ?? [],
      sourcePluginId: input.sourcePluginId,
      sourceContributionId: input.sourceContributionId,
      createdAt: `2026-01-01T00:00:0${this.nextTemplateId}.000Z`,
      updatedAt: `2026-01-01T00:00:0${this.nextTemplateId}.000Z`,
    };

    this.nextTemplateId += 1;
    this.templates.push(template);
    return template;
  }
}

class FakePluginRepository {
  private readonly storage = new Map<string, unknown>();

  constructor(
    private readonly plugins = [
      {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        type: manifest.type,
        enabled: true,
        manifest,
        installedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  ) {}

  async listInstalled() {
    return this.plugins;
  }

  async get(id: string) {
    return this.plugins.find((plugin) => plugin.id === id) ?? null;
  }

  async getStorage<T>(pluginId: string, key: string) {
    return (this.storage.get(`${pluginId}\u0000${key}`) as T | undefined) ?? null;
  }

  async setStorage<T>(pluginId: string, key: string, value: T) {
    this.storage.set(`${pluginId}\u0000${key}`, value);
    return { pluginId, key, value };
  }
}

function createRepositories() {
  return {
    characterSheets: new FakeCharacterSheetRepository(),
    plugins: new FakePluginRepository(),
  };
}

describe("character sheet template importer", () => {
  it("imports enabled plugin template contributions once", async () => {
    const repositories = createRepositories();

    const firstImport =
      await importCharacterSheetTemplatesFromPlugins(repositories);
    const secondImport =
      await importCharacterSheetTemplatesFromPlugins(repositories);

    expect(firstImport).toHaveLength(1);
    expect(secondImport).toHaveLength(0);
    expect(repositories.characterSheets.templates).toMatchObject([
      {
        name: "Simple Adventurer",
        sourcePluginId: manifest.id,
        sourceContributionId: "simple-adventurer",
      },
    ]);
  });

  it("reinstall creates a fresh copy without changing the edited import", async () => {
    const repositories = createRepositories();
    const [importedTemplate] =
      await importCharacterSheetTemplatesFromPlugins(repositories);
    importedTemplate.name = "My Edited Adventurer";
    repositories.characterSheets.templates[0] = importedTemplate;

    const reinstalledTemplate = await reinstallPluginCharacterSheetTemplate(
      repositories,
      {
        pluginId: manifest.id,
        contributionId: "simple-adventurer",
      },
    );

    expect(repositories.characterSheets.templates).toHaveLength(2);
    expect(repositories.characterSheets.templates[0].name).toBe(
      "My Edited Adventurer",
    );
    expect(reinstalledTemplate).toMatchObject({
      name: "Simple Adventurer",
      sourcePluginId: manifest.id,
      sourceContributionId: "simple-adventurer",
    });
  });

  it("generates collision-free template names", () => {
    expect(
      createUniqueTemplateName("Simple Adventurer", [
        "simple adventurer",
        "Simple Adventurer (2)",
      ]),
    ).toBe("Simple Adventurer (3)");
  });
});
