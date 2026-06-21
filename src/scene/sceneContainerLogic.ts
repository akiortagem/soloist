import type { SceneContainerPayload } from "../domain/domainTypes";
import { setupScene } from "./setupScene";

export function confirmSceneDescription(
  payload: SceneContainerPayload,
  chaosFactor: number | null | undefined,
): SceneContainerPayload {
  const description = payload.description.trim();

  if (description.length === 0 || payload.descriptionLocked) {
    return payload;
  }

  if (typeof chaosFactor !== "number") {
    return {
      ...payload,
      description,
      descriptionLocked: true,
      oracleError:
        "Scene oracle failed. Scene description was saved, but no oracle result was generated.",
    };
  }

  try {
    const result = setupScene(description, chaosFactor);

    return {
      ...payload,
      description,
      descriptionLocked: true,
      oracleError: undefined,
      oracleResult: {
        chaosFactor: result.chaosFactor,
        roll: result.roll,
        adjustmentType: result.adjustmentType,
        providerId: result.providerId,
        providerName: result.providerName,
        explanation: result.explanation,
      },
    };
  } catch {
    return {
      ...payload,
      description,
      descriptionLocked: true,
      oracleError:
        "Scene oracle failed. Scene description was saved, but no oracle result was generated.",
    };
  }
}
