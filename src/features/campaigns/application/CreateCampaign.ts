import type { Clock } from "../../../shared/application/ports/Clock";
import type { IdGenerator } from "../../../shared/application/ports/IdGenerator";
import type { Campaign } from "../domain/Campaign";
import type { CampaignRepository } from "./ports/CampaignRepository";

export type CreateCampaignInput = {
  name?: string;
  chaosFactor?: number;
};

export type CreateCampaignOutput = {
  campaign: Campaign;
  campaigns: Campaign[];
};

type CreateCampaignDependencies = {
  campaigns: CampaignRepository;
  clock: Clock;
  ids: IdGenerator;
};

export class CreateCampaignError extends Error {
  readonly code = "create_campaign_failed";
  readonly cause: unknown;

  constructor(cause?: unknown) {
    super("Campaign creation failed.");
    this.name = "CreateCampaignError";
    this.cause = cause;
  }
}

export function createCreateCampaign(dependencies: CreateCampaignDependencies) {
  return async function createCampaign(
    input: CreateCampaignInput,
  ): Promise<CreateCampaignOutput> {
    try {
      const timestamp = dependencies.clock.now().toISOString();
      const campaign = await dependencies.campaigns.create({
        campaign: {
          id: dependencies.ids.generate("session"),
          name: input.name?.trim() || "Untitled",
          documentId: dependencies.ids.generate("document"),
          chaosFactor: input.chaosFactor ?? 5,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        charactersFolderId: dependencies.ids.generate("folder"),
        sessionsFolderId: dependencies.ids.generate("folder"),
      });
      const campaigns = await dependencies.campaigns.list();

      return {
        campaign: campaigns.find(({ id }) => id === campaign.id) ?? campaign,
        campaigns,
      };
    } catch (error) {
      throw new CreateCampaignError(error);
    }
  };
}
