import type Database from "@tauri-apps/plugin-sql";
import { createId, nowIso } from "./id";

export type CombatStateRecord = {
  id: string;
  sessionId: string;
  active: boolean;
  combatantsJson: string;
  currentTurnIndex: number;
  createdAt: string;
  updatedAt: string;
};

export class CombatRepository {
  constructor(private readonly db: Database) {}

  async upsert(input: {
    sessionId: string;
    active?: boolean;
    combatantsJson?: string;
    currentTurnIndex?: number;
  }) {
    const timestamp = nowIso();
    const combatState: CombatStateRecord = {
      id: createId("combat"),
      sessionId: input.sessionId,
      active: input.active ?? false,
      combatantsJson: input.combatantsJson ?? "[]",
      currentTurnIndex: input.currentTurnIndex ?? 0,
      createdAt: timestamp,
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
        combatState.combatantsJson,
        combatState.currentTurnIndex,
        combatState.createdAt,
        combatState.updatedAt,
      ],
    );

    return combatState;
  }
}
