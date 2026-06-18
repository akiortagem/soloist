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
  created_at: string;
  updated_at: string;
};

function parseCombatants(value: string) {
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? (parsed as Combatant[]) : [];
}

function mapCombatState(row: CombatStateRow): CombatStateRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    active: row.active === 1,
    combatants: parseCombatants(row.combatants_json),
    currentTurnIndex: row.current_turn_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CombatRepository {
  constructor(private readonly db: Database) {}

  async getBySessionId(sessionId: string) {
    const rows = await this.db.select<CombatStateRow[]>(
      `SELECT id, session_id, active, combatants_json, current_turn_index, created_at, updated_at
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
  }) {
    const timestamp = nowIso();
    const current = await this.getBySessionId(input.sessionId);
    const combatState: CombatStateRecord = {
      id: current?.id ?? createId("combat"),
      sessionId: input.sessionId,
      active: input.active ?? current?.active ?? false,
      combatants: input.combatants ?? current?.combatants ?? [],
      currentTurnIndex: input.currentTurnIndex ?? current?.currentTurnIndex ?? 0,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    await this.db.execute(
      `INSERT INTO combat_states
       (id, session_id, active, combatants_json, current_turn_index, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT(session_id) DO UPDATE SET
         active = excluded.active,
         combatants_json = excluded.combatants_json,
         current_turn_index = excluded.current_turn_index,
         updated_at = excluded.updated_at`,
      [
        combatState.id,
        combatState.sessionId,
        combatState.active ? 1 : 0,
        JSON.stringify(combatState.combatants),
        combatState.currentTurnIndex,
        combatState.createdAt,
        combatState.updatedAt,
      ],
    );

    return combatState;
  }
}
