import type {
  CombatSpacePayload,
  CombatTurnBlockPayload,
  ResultBlock,
  SceneContainerPayload,
} from "../../../domain/domainTypes";

function isResultBlockType(type: string): type is ResultBlock["type"] {
  return [
    "roll",
    "oracle",
    "scene",
    "combat",
    "stat",
    "chaos",
    "error",
  ].includes(type);
}

export function parseResultBlockFence(
  type: string,
  body: string,
): ResultBlock | null {
  if (!isResultBlockType(type)) return null;
  try {
    const parsed = JSON.parse(body) as Partial<ResultBlock>;
    if (parsed.type && parsed.type !== type) return null;
    return {
      id: String(parsed.id ?? `${type}_unknown`),
      type,
      createdAt: String(parsed.createdAt ?? new Date(0).toISOString()),
      commandText: String(parsed.commandText ?? ""),
      collapsed:
        typeof parsed.collapsed === "boolean" ? parsed.collapsed : undefined,
      payload: parsed.payload ?? {},
    };
  } catch {
    return null;
  }
}

export function parseSceneContainerFence(
  body: string,
): SceneContainerPayload | null {
  try {
    const parsed = JSON.parse(body) as Partial<SceneContainerPayload> & {
      type?: unknown;
    };
    if (parsed.type || typeof parsed.id !== "string") return null;
    const payload: SceneContainerPayload = {
      id: parsed.id,
      description: String(parsed.description ?? ""),
      descriptionLocked: parsed.descriptionLocked === true,
      oracleResult: parsed.oracleResult,
      oracleError:
        typeof parsed.oracleError === "string" ? parsed.oracleError : undefined,
    };
    if (typeof parsed.collapsed === "boolean")
      payload.collapsed = parsed.collapsed;
    return payload;
  } catch {
    return null;
  }
}

export function parseCombatSpaceFence(body: string): CombatSpacePayload | null {
  try {
    const parsed = JSON.parse(body) as Partial<CombatSpacePayload>;
    if (typeof parsed.id !== "string") return null;
    return {
      id: parsed.id,
      active: parsed.active === true,
      ended: parsed.ended === true,
      roundNumber: finiteAtLeast(parsed.roundNumber, 1, 1),
      currentTurnIndex: finiteAtLeast(parsed.currentTurnIndex, 0, 0),
    };
  } catch {
    return null;
  }
}

export function parseCombatTurnFence(
  body: string,
): CombatTurnBlockPayload | null {
  try {
    const parsed = JSON.parse(body) as Partial<CombatTurnBlockPayload>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.combatantId !== "string" ||
      typeof parsed.combatantName !== "string"
    )
      return null;
    return {
      id: parsed.id,
      combatantId: parsed.combatantId,
      combatantName: parsed.combatantName,
      roundNumber: finiteAtLeast(parsed.roundNumber, 1, 1),
      turnIndex: finiteAtLeast(parsed.turnIndex, 0, 0),
      current: parsed.current === true,
      collapsed:
        typeof parsed.collapsed === "boolean" ? parsed.collapsed : undefined,
    };
  } catch {
    return null;
  }
}

function finiteAtLeast(
  value: number | undefined,
  minimum: number,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(minimum, value)
    : fallback;
}
