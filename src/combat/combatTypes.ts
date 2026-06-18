export type Combatant = {
  id: string;
  name: string;
  initiative: number;
  characterSheetId?: string;
  notes?: string;
};

export type CombatState = {
  id: string;
  sessionId: string;
  active: boolean;
  combatants: Combatant[];
  currentTurnIndex: number;
  createdAt: string;
  updatedAt: string;
};
