import { describe, expect, it } from "vitest";
import invalidMissingRequiredFieldFixture from "../../plugins-example/fixtures/invalid-missing-required-field/plugin.json";
import invalidScriptPluginFixture from "../../plugins-example/fixtures/invalid-script-plugin/plugin.json";
import invalidTableEntryFixture from "../../plugins-example/fixtures/invalid-table-entry/plugin.json";
import validDataPluginFixture from "../../plugins-example/fixtures/valid-data-plugin/plugin.json";
import validOmenTablePlugin from "../../plugins-example/omen-table/plugin.json";
import { validatePluginManifest } from "../plugins/pluginTypes";

const validManifest = {
  id: "soloist-plugin.ironsworn",
  name: "Ironsworn Data",
  version: "1.0.0",
  soloistApiVersion: "1",
  type: "data",
  contributes: {
    slashCommands: [
      {
        id: "oracle.move",
        name: "move",
        label: "Roll Move",
        prefix: "/move ",
        description: "Roll an Ironsworn move.",
        commandText: "/roll 2d10",
      },
      {
        id: "omen",
        name: "omen",
        label: "Draw Omen",
        prefix: "/omen",
        description: "Draw an omen from a plugin table.",
        tableId: "omens",
      },
    ],
    randomTables: [
      {
        id: "omens",
        name: "Omens",
        dice: "1d100",
        entries: [
          {
            id: "storm",
            min: 1,
            max: 100,
            text: "A storm gathers beyond the ridge.",
          },
        ],
      },
    ],
    oracleTables: [
      {
        id: "action",
        name: "Action",
        dice: "1d100",
        entries: [
          {
            id: "scheme",
            min: 1,
            max: 2,
            text: "Scheme",
          },
          {
            id: "clash",
            min: 3,
            max: 4,
            text: "Clash",
          },
        ],
      },
    ],
    characterSheetTemplates: [
      {
        id: "ironlander",
        name: "Ironlander",
        fields: [
          {
            id: "edge",
            name: "Edge",
            type: "number",
            defaultValue: 1,
          },
          {
            id: "momentum",
            kind: "group",
            name: "Momentum",
            fields: [
              {
                id: "current_momentum",
                kind: "field",
                name: "Current",
                type: "number",
                defaultValue: 2,
              },
            ],
          },
          {
            id: "notes_separator",
            kind: "separator",
            label: "Notes",
          },
        ],
      },
    ],
  },
} as const;

describe("plugin manifest validation", () => {
  it("accepts a valid data plugin manifest", () => {
    const result = validatePluginManifest(validManifest);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.id).toBe("soloist-plugin.ironsworn");
    expect(result.manifest.contributes?.oracleTables?.[0].entries[0].text).toBe(
      "Scheme",
    );
    expect(result.manifest.contributes?.randomTables?.[0].id).toBe("omens");
    expect(result.manifest.contributes?.slashCommands?.[1].tableId).toBe(
      "omens",
    );
  });

  it("accepts documented valid plugin fixtures", () => {
    expect(validatePluginManifest(validOmenTablePlugin).ok).toBe(true);
    expect(validatePluginManifest(validDataPluginFixture).ok).toBe(true);
  });

  it("rejects documented invalid plugin fixtures", () => {
    expect(validatePluginManifest(invalidMissingRequiredFieldFixture).ok).toBe(
      false,
    );
    expect(validatePluginManifest(invalidScriptPluginFixture).ok).toBe(false);
    expect(validatePluginManifest(invalidTableEntryFixture).ok).toBe(false);
  });

  it("rejects missing required fields", () => {
    const { name: _name, ...manifestWithoutName } = validManifest;
    const result = validatePluginManifest({
      ...manifestWithoutName,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      path: "$.name",
      code: "MISSING_FIELD",
      message: "Missing required field: name",
    });
  });

  it("rejects an unknown plugin type", () => {
    const result = validatePluginManifest({
      ...validManifest,
      type: "external",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      path: "$.type",
      code: "UNKNOWN_PLUGIN_TYPE",
      message: 'Plugin type must be "data" or "script"',
    });
  });

  it("accepts a script plugin manifest with a compiled JavaScript entry", () => {
    const result = validatePluginManifest({
      id: "soloist-plugin.script-example",
      name: "Script Example",
      version: "1.0.0",
      soloistApiVersion: "1",
      type: "script",
      entry: "dist/plugin.js",
      permissions: ["storage", "slashCommands:register"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.entry).toBe("dist/plugin.js");
    expect(result.manifest.permissions).toEqual([
      "storage",
      "slashCommands:register",
    ]);
  });

  it("rejects an unknown script plugin permission", () => {
    const result = validatePluginManifest({
      id: "soloist-plugin.script-example",
      name: "Script Example",
      version: "1.0.0",
      soloistApiVersion: "1",
      type: "script",
      entry: "dist/plugin.js",
      permissions: ["network"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      path: "$.permissions[0]",
      code: "INVALID_FIELD_VALUE",
      message: "Unknown script plugin permission: network",
    });
  });

  it("requires an entry for script plugins", () => {
    const result = validatePluginManifest(invalidScriptPluginFixture);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      path: "$.entry",
      code: "MISSING_FIELD",
      message: "Missing required field: entry",
    });
  });

  it("rejects an unknown contribution type", () => {
    const result = validatePluginManifest({
      ...validManifest,
      contributes: {
        ...validManifest.contributes,
        scripts: [],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      path: "$.contributes.scripts",
      code: "UNKNOWN_CONTRIBUTION_TYPE",
      message: "Unknown contribution type: scripts",
    });
  });

  it("rejects unknown fields inside contribution payloads", () => {
    const result = validatePluginManifest({
      ...validManifest,
      contributes: {
        oracleTables: [
          {
            id: "action",
            name: "Action",
            dice: "1d100",
            entries: [
              {
                id: "scheme",
                min: 1,
                max: 2,
                text: "Scheme",
                weight: 2,
              },
            ],
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      path: "$.contributes.oracleTables[0].entries[0].weight",
      code: "UNKNOWN_FIELD",
      message: "Unknown field: weight",
    });
  });

  it("returns displayable validation errors with paths", () => {
    const result = validatePluginManifest({
      id: "",
      name: "Broken",
      version: "1.0.0",
      soloistApiVersion: "1",
      type: "data",
      contributes: {
        oracleTables: [
          {
            id: "bad-table",
            name: "Bad Table",
            dice: "1d6",
            entries: [{ id: "bad-entry", min: 6, max: 1, text: "Broken" }],
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          path: "$.id",
          code: "EMPTY_STRING",
          message: "id cannot be empty",
        },
        {
          path: "$.contributes.oracleTables[0].entries[0].min",
          code: "INVALID_NUMBER",
          message: "Oracle table entry min cannot be greater than max",
        },
      ]),
    );
  });
});
