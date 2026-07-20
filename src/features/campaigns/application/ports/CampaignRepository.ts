import type { Campaign } from "../../domain/Campaign";

export type CreateCampaignRecord = {
  campaign: Campaign;
  charactersFolderId: string;
  sessionsFolderId: string;
};

export interface CampaignRepository {
  create(input: CreateCampaignRecord): Promise<Campaign>;
  list(): Promise<Campaign[]>;
}

export class CampaignRepositoryError extends Error {
  readonly code = "campaign_repository_failed";
  readonly cause: unknown;

  constructor(
    readonly operation: "create" | "list",
    cause?: unknown,
  ) {
    super(`Campaign repository ${operation} failed.`);
    this.name = "CampaignRepositoryError";
    this.cause = cause;
  }
}
