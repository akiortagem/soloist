import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import type { CombatSpacePayload } from "../../../../domain/domainTypes";
import { useAppStore } from "../../../../state/appStore";

function combatSpacePayload(value: unknown): CombatSpacePayload {
  const payload =
    value && typeof value === "object"
      ? (value as Partial<CombatSpacePayload>)
      : {};

  return {
    id: String(payload.id ?? `combat_${Date.now().toString(36)}`),
    active: payload.active === true,
    ended: payload.ended === true,
    roundNumber:
      typeof payload.roundNumber === "number" &&
      Number.isFinite(payload.roundNumber)
        ? Math.max(1, payload.roundNumber)
        : 1,
    currentTurnIndex:
      typeof payload.currentTurnIndex === "number" &&
      Number.isFinite(payload.currentTurnIndex)
        ? Math.max(0, payload.currentTurnIndex)
        : 0,
  };
}

export function CombatSpaceView({ node, selected }: NodeViewProps) {
  const payload = combatSpacePayload(node.attrs.payload);
  const { combatState } = useAppStore();
  const combatantCount = combatState?.combatants.length ?? 0;
  const className = [
    "combat-space",
    selected ? "is-selected" : "",
    payload.ended ? "is-ended" : "",
    "is-editable",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <NodeViewWrapper
      as="section"
      className={className}
      data-combat-space-id={payload.id}
    >
      <header className="combat-space-header" contentEditable={false}>
        <strong>Combat</strong>
        <span>Round {payload.roundNumber}</span>
      </header>

      {combatantCount < 2 ? (
        <div className="combat-space-placeholder" contentEditable={false}>
          Add at least two characters to the combat tracker to write combat
          turns.
        </div>
      ) : null}

      <NodeViewContent className="combat-space-content" contentEditable />
    </NodeViewWrapper>
  );
}
