import { describe, expect, it } from "vitest";
import type { Clock } from "../../../shared/application/ports/Clock";
import type { IdGenerator } from "../../../shared/application/ports/IdGenerator";
import type { Campaign } from "../domain/Campaign";
import type {
  CampaignRepository,
  CreateCampaignRecord,
} from "./ports/CampaignRepository";
import { createCreateCampaign } from "./CreateCampaign";
import { CreateCampaignError } from "./CreateCampaign";

class InMemoryCampaignRepository implements CampaignRepository {
  readonly records: CreateCampaignRecord[] = [];

  async create(input: CreateCampaignRecord) {
    this.records.push(input);
    return input.campaign;
  }

  async list() {
    return this.records.map(({ campaign }) => campaign);
  }
}

class FixedClock implements Clock {
  now() {
    return new Date("2026-07-20T12:00:00.000Z");
  }
}

class SequenceIds implements IdGenerator {
  private next = 0;

  generate(prefix: string) {
    this.next += 1;
    return `${prefix}_${this.next}`;
  }
}

describe("create campaign", () => {
  it("creates a campaign and its document roots with deterministic values", async () => {
    const campaigns = new InMemoryCampaignRepository();
    const createCampaign = createCreateCampaign({
      campaigns,
      clock: new FixedClock(),
      ids: new SequenceIds(),
    });

    const result = await createCampaign({ name: "  The Long Road  " });

    const expected: Campaign = {
      id: "session_1",
      name: "The Long Road",
      documentId: "document_2",
      chaosFactor: 5,
      createdAt: "2026-07-20T12:00:00.000Z",
      updatedAt: "2026-07-20T12:00:00.000Z",
    };
    expect(result).toEqual({ campaign: expected, campaigns: [expected] });
    expect(campaigns.records[0]).toEqual({
      campaign: expected,
      charactersFolderId: "folder_3",
      sessionsFolderId: "folder_4",
    });
  });

  it("uses the existing default name and accepts a custom chaos factor", async () => {
    const campaigns = new InMemoryCampaignRepository();
    const createCampaign = createCreateCampaign({
      campaigns,
      clock: new FixedClock(),
      ids: new SequenceIds(),
    });

    const result = await createCampaign({ name: "   ", chaosFactor: 7 });

    expect(result.campaign).toMatchObject({ name: "Untitled", chaosFactor: 7 });
  });

  it("translates repository failures into an application error", async () => {
    const failure = new Error("database unavailable");
    const createCampaign = createCreateCampaign({
      campaigns: {
        create: async () => {
          throw failure;
        },
        list: async () => [],
      },
      clock: new FixedClock(),
      ids: new SequenceIds(),
    });

    await expect(createCampaign({})).rejects.toMatchObject({
      name: "CreateCampaignError",
      code: "create_campaign_failed",
      cause: failure,
    } satisfies Partial<CreateCampaignError>);
  });
});
