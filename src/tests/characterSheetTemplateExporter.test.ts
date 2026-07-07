import { describe, expect, it } from "vitest";
import type { CharacterSheetTemplate } from "../domain/domainTypes";
import {
  createCharacterSheetTemplatePluginManifest,
  createPluginSlug,
} from "../plugins/characterSheetTemplateExporter";
import { validatePluginManifest } from "../plugins/pluginTypes";

describe("character sheet template exporter", () => {
  it("creates a valid plugin manifest from an existing template", () => {
    const template: CharacterSheetTemplate = {
      id: "template_1",
      name: "Simple Character",
      sourcePluginId: "soloist-plugin.old",
      sourceContributionId: "old-template",
      fields: [
        {
          id: "core-stats-row",
          kind: "layout",
          columns: [
            {
              id: "resources-column",
              fields: [
                {
                  id: "resources",
                  kind: "group",
                  name: "Resources",
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
            {
              id: "combat-column",
              fields: [
                {
                  id: "atk",
                  kind: "field",
                  name: "ATK",
                  type: "number",
                  defaultValue: 1,
                },
              ],
            },
          ],
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const manifest = createCharacterSheetTemplatePluginManifest(template);

    expect(validatePluginManifest(manifest).ok).toBe(true);
    expect(manifest).toMatchObject({
      id: "soloist-plugin.simple-character",
      name: "Simple Character Template",
      contributes: {
        characterSheetTemplates: [
          {
            id: "simple-character",
            name: "Simple Character",
          },
        ],
      },
    });
    const exportedLayout =
      manifest.contributes?.characterSheetTemplates?.[0].fields[0];

    expect(exportedLayout).toMatchObject({
      id: "core-stats-row",
      kind: "layout",
    });
    expect(exportedLayout?.kind === "layout" ? exportedLayout.columns : []).toHaveLength(
      2,
    );
    expect(
      exportedLayout?.kind === "layout"
        ? exportedLayout.columns[0].fields[0]
        : undefined,
    ).toMatchObject({
      id: "resources",
      kind: "group",
      name: "Resources",
    });
    expect(JSON.stringify(manifest)).not.toContain("sourcePluginId");
    expect(JSON.stringify(manifest)).not.toContain("sourceContributionId");
  });

  it("falls back to a stable slug for names without ascii letters", () => {
    expect(createPluginSlug(" !!! ")).toBe("character-sheet-template");
  });
});
