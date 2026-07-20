import { createCreateCampaign } from "../../features/campaigns/application/CreateCampaign";
import { SqliteCampaignRepository } from "../../features/campaigns/infrastructure/SqliteCampaignRepository";
import { getDatabase } from "../../persistence/database";
import {
  CryptoIdGenerator,
  SystemClock,
} from "../../shared/infrastructure/systemValues";

export type Application = {
  createCampaign: ReturnType<typeof createCreateCampaign>;
};

export async function createApplication(): Promise<Application> {
  const database = await getDatabase();
  const campaigns = new SqliteCampaignRepository(database);

  return {
    createCampaign: createCreateCampaign({
      campaigns,
      clock: new SystemClock(),
      ids: new CryptoIdGenerator(),
    }),
  };
}
