import type Database from "@tauri-apps/plugin-sql";
import type { Combatant, CombatState } from "../domain/domainTypes";
import { createId, nowIso } from "./id";

export type CombatStateRecord = CombatState;

type CombatStateRow = {
  id: string;
  session_id: string;
  active: number;
  combatants_json: string;
  current_turn_index: number;
  round_number?: number;
  created_at: string;
  updated_at: string;
};

function normalizeCombatant(value: unknown, index: number): Combatant | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : null;
  const name = typeof record.name === "string" ? record.name : null;

  if (!id || !name) {
    return null;
  }

  const legacyInitiative =
    typeof record.initiative === "number" ? record.initiative : undefined;
  const turnOrder =
    typeof record.turnOrder === "number"
      ? record.turnOrder
      : (legacyInitiative ?? index + 1);

  return {
    ...(record as unknown as Combatant),
    id,
    name,
    turnOrder,
  };
}

function parseCombatants(value: string) {
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed)
    ? parsed
        .map((combatant, index) => normalizeCombatant(combatant, index))
        .filter((combatant): combatant is Combatant => Boolean(combatant))
    : [];
}

function mapCombatState(row: CombatStateRow): CombatStateRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    active: row.active === 1,
    combatants: parseCombatants(row.combatants_json),
    currentTurnIndex: row.current_turn_index,
    roundNumber:
      typeof row.round_number === "number" && Number.isFinite(row.round_number)
        ? Math.max(1, row.round_number)
        : 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CombatRepository {
  constructor(private readonly db: Database) {}

  async getBySessionId(sessionId: string) {
    const rows = await this.db.select<CombatStateRow[]>(
      `SELECT id, session_id, active, combatants_json, current_turn_index, round_number, created_at, updated_at
       FROM combat_states
       WHERE session_id = $1
       LIMIT 1`,
      [sessionId],
    );

    return rows[0] ? mapCombatState(rows[0]) : null;
  }

  async upsert(input: {
    sessionId: string;
    active?: boolean;
    combatants?: Combatant[];
    currentTurnIndex?: number;
    roundNumber?: number;
  }) {
    const timestamp = nowIso();
    const current = await this.getBySessionId(input.sessionId);
    const combatState: CombatStateRecord = {
      id: current?.id ?? createId("combat"),
      sessionId: input.sessionId,
      active: input.active ?? current?.active ?? false,
      combatants: input.combatants ?? current?.combatants ?? [],
      currentTurnIndex: input.currentTurnIndex ?? current?.currentTurnIndex ?? 0,
      roundNumber: input.roundNumber ?? current?.roundNumber ?? 1,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    await this.db.execute(
      `INSERT INTO combat_states
       (id, session_id, active, combatants_json, current_turn_index, round_number, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT(session_id) DO UPDATE SET
         active = excluded.active,
         combatants_json = excluded.combatants_json,
         current_turn_index = excluded.current_turn_index,
         round_number = excluded.round_number,
         updated_at = excluded.updated_at`,
      [
        combatState.id,
        combatState.sessionId,
        combatState.active ? 1 : 0,
        JSON.stringify(combatState.combatants),
        combatState.currentTurnIndex,
        combatState.roundNumber,
        combatState.createdAt,
        combatState.updatedAt,
      ],
    );

    return combatState;
  }
}
