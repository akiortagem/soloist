import { describe, expect, it } from "vitest";
import type { SceneContainerPayload } from "../domain/domainTypes";
import { confirmSceneDescription } from "../scene/sceneContainerLogic";

describe("scene container lifecycle", () => {
  it("keeps an empty scene description editable", async () => {
    const payload: SceneContainerPayload = {
      id: "scene_empty",
      description: "",
      descriptionLocked: false,
    };

    expect(await confirmSceneDescription(payload, 5)).toBe(payload);
  });

  it("locks the scene description and rolls scene setup", async () => {
    const payload: SceneContainerPayload = {
      id: "scene_confirm",
      description: " I enter the adventurer guild to see the notice board ",
      descriptionLocked: false,
    };

    const confirmed = await confirmSceneDescription(payload, 5);

    expect(confirmed.description).toBe(
      "I enter the adventurer guild to see the notice board",
    );
    expect(confirmed.descriptionLocked).toBe(true);
    expect(confirmed.oracleResult).toMatchObject({
      chaosFactor: 5,
      providerId: "demo",
    });
    expect(typeof confirmed.oracleResult?.roll).toBe("number");
    expect(confirmed.oracleError).toBeUndefined();
  });

  it("does not roll again after the description is locked", async () => {
    const payload: SceneContainerPayload = {
      id: "scene_locked",
      description: "Already confirmed",
      descriptionLocked: true,
      oracleResult: {
        chaosFactor: 5,
        roll: 4,
        adjustmentType: "Normal Scene",
        providerId: "demo",
        providerName: "Demo Oracle",
        explanation: "Scene runs as expected.",
      },
    };

    expect(await confirmSceneDescription(payload, 5)).toBe(payload);
  });

  it("locks the description and records an error without a chaos factor", async () => {
    const payload: SceneContainerPayload = {
      id: "scene_error",
      description: "Open on a stormy road",
      descriptionLocked: false,
    };

    const confirmed = await confirmSceneDescription(payload, null);

    expect(confirmed.descriptionLocked).toBe(true);
    expect(confirmed.oracleResult).toBeUndefined();
    expect(confirmed.oracleError).toContain("Scene oracle failed");
  });
});
