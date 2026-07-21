import type {
  CombatSpacePayload,
  CombatTurnBlockPayload,
  ResultBlock,
  SceneContainerPayload,
} from "../../../domain/domainTypes";

export type CommandExecutionContext = {
  isInsideCombatSpace: boolean;
  chaosFactor: number;
};

export type CommandExecutionResult =
  | {
      type: "insertResultBlock";
      block: ResultBlock;
      display: "inline" | "block";
    }
  | { type: "insertSceneContainer"; payload: SceneContainerPayload }
  | {
      type: "insertCombatSpace";
      payload: CombatSpacePayload;
      initialTurn?: CombatTurnBlockPayload;
    }
  | {
      type: "insertCombatTurn";
      combatSpacePayload: Omit<CombatSpacePayload, "id">;
      turnPayload: CombatTurnBlockPayload;
      collapseCurrentTurn: boolean;
    }
  | { type: "endCombat" }
  | { type: "deleteCommand" };
