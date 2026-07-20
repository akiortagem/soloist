import type Database from "@tauri-apps/plugin-sql";
import { describe, expect, it, vi } from "vitest";
import type { CreateCampaignRecord } from "../application/ports/CampaignRepository";
import { CampaignRepositoryError } from "../application/ports/CampaignRepository";
import { SqliteCampaignRepository } from "./SqliteCampaignRepository";

const record: CreateCampaignRecord = {
  campaign: {
    id: "session_1",
    name: "The Long Road",
    documentId: "document_1",
    chaosFactor: 5,
    createdAt: "2026-07-20T12:00:00.000Z",
    updatedAt: "2026-07-20T12:00:00.000Z",
  },
  charactersFolderId: "folder_characters",
  sessionsFolderId: "folder_sessions",
};

function databaseWith(overrides: Partial<Database> = {}) {
  return {
    execute: vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId: 1 }),
    select: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as Database;
}

describe("SQLite campaign repository", () => {
  it("creates the campaign and its three root documents", async () => {
    const database = databaseWith();
    const repository = new SqliteCampaignRepository(database);

    await expect(repository.create(record)).resolves.toEqual(record.campaign);

    const execute = vi.mocked(database.execute);
    expect(execute).toHaveBeenCalledTimes(4);
    expect(execute.mock.calls[0]?.[1]).toEqual([
      "session_1",
      "The Long Road",
      "document_1",
      5,
      null,
      "2026-07-20T12:00:00.000Z",
      "2026-07-20T12:00:00.000Z",
    ]);
    expect(
      execute.mock.calls.slice(1).map((call) => call[1]?.slice(0, 6)),
    ).toEqual([
      ["document_1", "session_1", null, "document", null, "The Long Road"],
      [
        "folder_characters",
        "session_1",
        null,
        "folder",
        "characters",
        "Characters",
      ],
      ["folder_sessions", "session_1", null, "folder", "sessions", "Sessions"],
    ]);
  });

  it("maps persisted campaigns and preserves repository ordering", async () => {
    const database = databaseWith({
      select: vi.fn().mockResolvedValue([
        {
          id: "session_1",
          name: "The Long Road",
          document_id: "document_1",
          chaos_factor: 6,
          active_character_sheet_id: null,
          created_at: "created",
          updated_at: "updated",
        },
      ]),
    });

    await expect(
      new SqliteCampaignRepository(database).list(),
    ).resolves.toEqual([
      {
        id: "session_1",
        name: "The Long Road",
        documentId: "document_1",
        chaosFactor: 6,
        activeCharacterSheetId: undefined,
        createdAt: "created",
        updatedAt: "updated",
      },
    ]);
    expect(database.select).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY updated_at DESC"),
    );
  });

  it.each(["create", "list"] as const)(
    "translates %s failures at the adapter boundary",
    async (operation) => {
      const failure = new Error("sqlite failed");
      const database = databaseWith({
        execute: vi.fn().mockRejectedValue(failure),
        select: vi.fn().mockRejectedValue(failure),
      });
      const repository = new SqliteCampaignRepository(database);
      const result =
        operation === "create" ? repository.create(record) : repository.list();

      await expect(result).rejects.toMatchObject({
        name: "CampaignRepositoryError",
        code: "campaign_repository_failed",
        operation,
        cause: failure,
      } satisfies Partial<CampaignRepositoryError>);
    },
  );
});
