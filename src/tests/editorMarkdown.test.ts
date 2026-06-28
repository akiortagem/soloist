import { describe, expect, it } from "vitest";
import { markdownToTiptapJson, tiptapJsonToMarkdown } from "../editor/markdown";

describe("editor markdown persistence", () => {
  it("loads and saves headings, paragraphs, bold, italic, and bullet lists", () => {
    const markdown = [
      "# Session Notes",
      "",
      "This is **bold** and *italic* text.",
      "",
      "- First lead",
      "- Second lead",
    ].join("\n");

    const json = markdownToTiptapJson(markdown);

    expect(json.content?.[0]).toMatchObject({
      type: "heading",
      attrs: { level: 1 },
    });
    expect(json.content?.[1]).toMatchObject({ type: "paragraph" });
    expect(json.content?.[2]).toMatchObject({ type: "bulletList" });
    expect(tiptapJsonToMarkdown(json)).toBe(markdown);
  });

  it("creates an editable empty document for blank markdown", () => {
    expect(markdownToTiptapJson("")).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });

  it("round-trips result blocks as fenced custom blocks", () => {
    const block = {
      id: "oracle_test",
      type: "oracle",
      createdAt: "2026-06-19T00:00:00.000Z",
      commandText: "/ask likely Is the guard asleep?",
      collapsed: true,
      payload: {
        question: "Is the guard asleep?",
        odds: "likely",
        answer: "Yes",
      },
    };
    const markdown = [
      "Before",
      "",
      ":::trpg-oracle",
      JSON.stringify(block),
      ":::",
      "",
      "After",
    ].join("\n");

    const json = markdownToTiptapJson(markdown);

    expect(json.content?.[1]).toEqual({
      type: "resultBlock",
      attrs: { block },
    });
    expect(tiptapJsonToMarkdown(json)).toBe(markdown);
  });

  it("round-trips inline roll result blocks", () => {
    const block = {
      id: "roll_test",
      type: "roll",
      createdAt: "2026-06-19T00:00:00.000Z",
      commandText: "/roll d20",
      payload: {
        formula: "d20",
        total: 12,
        terms: [],
      },
    };
    const markdown = `Attack {{trpg-roll:${encodeURIComponent(
      JSON.stringify(block),
    )}}} damage`;

    const json = markdownToTiptapJson(markdown);

    expect(json.content?.[0]).toMatchObject({
      type: "paragraph",
      content: [
        { type: "text", text: "Attack " },
        { type: "inlineResultBlock", attrs: { block } },
        { type: "text", text: " damage" },
      ],
    });
    expect(tiptapJsonToMarkdown(json)).toBe(markdown);
  });

  it("round-trips inline stat result blocks", () => {
    const block = {
      id: "stat_test",
      type: "stat",
      createdAt: "2026-06-19T00:00:00.000Z",
      commandText: "/stat Kael HP -4",
      payload: {
        sheet: "Kael",
        stat: "HP",
        delta: -4,
        beforeValue: 16,
        afterValue: 12,
      },
    };
    const markdown = `Damage {{trpg-stat:${encodeURIComponent(
      JSON.stringify(block),
    )}}} taken`;

    const json = markdownToTiptapJson(markdown);

    expect(json.content?.[0]).toMatchObject({
      type: "paragraph",
      content: [
        { type: "text", text: "Damage " },
        { type: "inlineResultBlock", attrs: { block } },
        { type: "text", text: " taken" },
      ],
    });
    expect(tiptapJsonToMarkdown(json)).toBe(markdown);
  });

  it("round-trips scene containers with editable prose content", () => {
    const payload = {
      id: "scene_abc123",
      description: "I enter the adventurer guild to see the notice board",
      descriptionLocked: true,
      oracleResult: {
        chaosFactor: 5,
        roll: 4,
        adjustmentType: "Normal Scene",
        providerId: "demo",
        providerName: "Demo Oracle",
        explanation: "Scene runs as expected.",
      },
      collapsed: false,
    };
    const markdown = [
      "Before",
      "",
      ":::trpg-scene",
      JSON.stringify(payload),
      ":::",
      "Scene content prose goes here.",
      "",
      "More scene content.",
    ].join("\n");

    const json = markdownToTiptapJson(markdown);

    expect(json.content?.[1]).toMatchObject({
      type: "sceneContainer",
      attrs: { payload },
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Scene content prose goes here." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "More scene content." }],
        },
      ],
    });
    expect(tiptapJsonToMarkdown(json)).toBe(markdown);
  });

  it("keeps consecutive scene containers separate when loading markdown", () => {
    const first = {
      id: "scene_first",
      description: "First scene",
      descriptionLocked: true,
      collapsed: true,
    };
    const second = {
      id: "scene_second",
      description: "",
      descriptionLocked: false,
    };
    const markdown = [
      ":::trpg-scene",
      JSON.stringify(first),
      ":::",
      "First content.",
      "",
      ":::trpg-scene",
      JSON.stringify(second),
      ":::",
      "Second content.",
    ].join("\n");

    const json = markdownToTiptapJson(markdown);

    expect(json.content).toHaveLength(2);
    expect(json.content?.[0]).toMatchObject({
      type: "sceneContainer",
      attrs: { payload: first },
    });
    expect(json.content?.[1]).toMatchObject({
      type: "sceneContainer",
      attrs: { payload: second },
    });
    expect(tiptapJsonToMarkdown(json)).toBe(markdown);
  });

  it("round-trips combat spaces with editable turn blocks", () => {
    const combatPayload = {
      id: "combat_abc123",
      active: true,
      ended: false,
      roundNumber: 2,
      currentTurnIndex: 1,
    };
    const firstTurn = {
      id: "combat_turn_first",
      combatantId: "char_1",
      combatantName: "Char 1",
      roundNumber: 1,
      turnIndex: 0,
      current: false,
      collapsed: true,
    };
    const secondTurn = {
      id: "combat_turn_second",
      combatantId: "char_2",
      combatantName: "Char 2",
      roundNumber: 2,
      turnIndex: 1,
      current: true,
    };
    const markdown = [
      "Before",
      "",
      ":::trpg-combat-space",
      JSON.stringify(combatPayload),
      ":::",
      ":::trpg-combat-turn",
      JSON.stringify(firstTurn),
      ":::",
      "Char 1 attacks.",
      ":::trpg-combat-turn-end",
      "",
      "Between-turn table chatter.",
      "",
      ":::trpg-combat-turn",
      JSON.stringify(secondTurn),
      ":::",
      "Char 2 answers.",
      ":::trpg-combat-turn-end",
      ":::trpg-combat-space-end",
      "",
      "After",
    ].join("\n");

    const json = markdownToTiptapJson(markdown);

    expect(json.content?.[1]).toMatchObject({
      type: "combatSpace",
      attrs: { payload: combatPayload },
      content: [
        {
          type: "combatTurnBlock",
          attrs: { payload: firstTurn },
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Between-turn table chatter." }],
        },
        {
          type: "combatTurnBlock",
          attrs: { payload: secondTurn },
        },
      ],
    });
    expect(tiptapJsonToMarkdown(json)).toBe(markdown);
  });
});
