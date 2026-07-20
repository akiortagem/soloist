import type Database from "@tauri-apps/plugin-sql";
import type {
  CampaignRepository,
  CreateCampaignRecord,
} from "../application/ports/CampaignRepository";
import { CampaignRepositoryError } from "../application/ports/CampaignRepository";
import type { Campaign } from "../domain/Campaign";

type CampaignRow = {
  id: string;
  name: string;
  document_id: string;
  chaos_factor: number;
  active_character_sheet_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    documentId: row.document_id,
    chaosFactor: row.chaos_factor,
    activeCharacterSheetId: row.active_character_sheet_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteCampaignRepository implements CampaignRepository {
  constructor(private readonly database: Database) {}

  async create(input: CreateCampaignRecord) {
    try {
      return await this.insertCampaign(input);
    } catch (error) {
      throw new CampaignRepositoryError("create", error);
    }
  }

  async list() {
    try {
      const rows = await this.database.select<CampaignRow[]>(
        `SELECT id, name, document_id, chaos_factor, active_character_sheet_id, created_at, updated_at
         FROM sessions
         ORDER BY updated_at DESC`,
      );
      return rows.map(mapCampaign);
    } catch (error) {
      throw new CampaignRepositoryError("list", error);
    }
  }

  private async insertCampaign(input: CreateCampaignRecord) {
    const { campaign } = input;
    await this.database.execute(
      `INSERT INTO sessions
       (id, name, document_id, chaos_factor, active_character_sheet_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        campaign.id,
        campaign.name,
        campaign.documentId,
        campaign.chaosFactor,
        campaign.activeCharacterSheetId ?? null,
        campaign.createdAt,
        campaign.updatedAt,
      ],
    );
    await this.createDocument(
      campaign,
      campaign.documentId,
      "document",
      null,
      campaign.name,
    );
    await this.createDocument(
      campaign,
      input.charactersFolderId,
      "folder",
      "characters",
      "Characters",
    );
    await this.createDocument(
      campaign,
      input.sessionsFolderId,
      "folder",
      "sessions",
      "Sessions",
    );
    return campaign;
  }

  private async createDocument(
    campaign: Campaign,
    id: string,
    kind: "document" | "folder",
    folderKind: "characters" | "sessions" | null,
    title: string,
  ) {
    await this.database.execute(
      `INSERT INTO documents
       (id, session_id, parent_id, kind, folder_kind, title, content_markdown, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        campaign.id,
        null,
        kind,
        folderKind,
        title,
        "",
        campaign.createdAt,
        campaign.updatedAt,
      ],
    );
  }
}
