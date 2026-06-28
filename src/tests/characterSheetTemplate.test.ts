import { describe, expect, test } from "vitest";
import {
  coerceTemplateFieldDefaultValue,
  createFieldsFromTemplate,
  createTemplateSeparator,
  normalizeTemplateItems,
  syncFieldsWithTemplate,
} from "../characterSheets/characterSheetTemplateLogic";

describe("character sheet template logic", () => {
  test("coerces default values by field type", () => {
    expect(coerceTemplateFieldDefaultValue("number", "12")).toBe(12);
    expect(coerceTemplateFieldDefaultValue("number", "abc")).toBe(0);
    expect(
      coerceTemplateFieldDefaultValue("current_max_number", {
        current: "7",
        max: "10",
      }),
    ).toEqual({ current: 7, max: 10 });
    expect(
      coerceTemplateFieldDefaultValue("current_max_number", {
        current: -1,
        max: "abc",
      }),
    ).toEqual({ current: 0, max: 0 });
    expect(coerceTemplateFieldDefaultValue("boolean", "true")).toBe(true);
    expect(coerceTemplateFieldDefaultValue("boolean", false)).toBe(false);
    expect(coerceTemplateFieldDefaultValue("text", 42)).toBe("42");
  });

  test("normalizes fields and moves legacy group fields into group containers", () => {
    const fields = normalizeTemplateItems([
      {
        id: "field_1",
        name: " HP ",
        type: "number",
        defaultValue: "10",
        minValue: 0,
        maxValue: 20,
        group: " Vitals ",
      },
      {
        id: "field_2",
        name: " Notes ",
        type: "longText",
        defaultValue: 99,
        minValue: 0,
        maxValue: 20,
      },
    ]);

    expect(fields[0]).toMatchObject({
      kind: "group",
      name: "Vitals",
      fields: [
        {
          id: "field_1",
          kind: "field",
          name: "HP",
          type: "number",
          defaultValue: 10,
          minValue: 0,
          maxValue: 20,
          group: undefined,
        },
      ],
    });
    expect(fields[1]).toEqual({
        id: "field_2",
        kind: "field",
        name: "Notes",
        type: "longText",
        defaultValue: "99",
        minValue: undefined,
        maxValue: undefined,
        group: undefined,
    });
  });

  test("creates and normalizes separators", () => {
    const separator = createTemplateSeparator({ label: "Stats" });
    const normalized = normalizeTemplateItems([
      { ...separator, label: " Stats " },
    ]);

    expect(separator.kind).toBe("separator");
    expect(normalized).toEqual([
      {
        id: separator.id,
        kind: "separator",
        label: "Stats",
      },
    ]);
  });

  test("syncs new grouped template fields into existing sheet fields", () => {
    const originalTemplateFields = [
      {
        id: "field_hp",
        kind: "field" as const,
        name: "HP",
        type: "number" as const,
        defaultValue: 10,
      },
    ];
    const sheetFields = createFieldsFromTemplate(originalTemplateFields).map(
      (field) =>
        field.templateFieldId === "field_hp"
          ? {
              ...field,
              value: 7,
            }
          : field,
    );

    const syncedFields = syncFieldsWithTemplate(sheetFields, [
      ...originalTemplateFields,
      {
        id: "group_stats",
        kind: "group" as const,
        name: "Stats",
        fields: [
          {
            id: "field_strength",
            kind: "field" as const,
            name: "Strength",
            type: "number" as const,
            defaultValue: 2,
          },
        ],
      },
    ]);

    expect(syncedFields).toHaveLength(2);
    expect(syncedFields[0]).toMatchObject({
      name: "HP",
      templateFieldId: "field_hp",
      value: 7,
    });
    expect(syncedFields[1]).toMatchObject({
      name: "Strength",
      templateFieldId: "field_strength",
      value: 2,
      group: "Stats",
    });
  });

  test("creates current/max number sheet fields from templates", () => {
    const sheetFields = createFieldsFromTemplate([
      {
        id: "field_hp",
        kind: "field" as const,
        name: "HP",
        type: "current_max_number" as const,
        defaultValue: {
          current: 7,
          max: 10,
        },
      },
    ]);

    expect(sheetFields[0]).toMatchObject({
      name: "HP",
      templateFieldId: "field_hp",
      type: "current_max_number",
      value: {
        current: 7,
        max: 10,
      },
    });
  });
});
