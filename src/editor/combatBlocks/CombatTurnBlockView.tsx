import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { CombatTurnBlockPayload } from "../../domain/domainTypes";

function combatTurnPayload(value: unknown): CombatTurnBlockPayload {
  const payload =
    value && typeof value === "object"
      ? (value as Partial<CombatTurnBlockPayload>)
      : {};

  return {
    id: String(payload.id ?? `combat_turn_${Date.now().toString(36)}`),
    combatantId: String(payload.combatantId ?? ""),
    combatantName: String(payload.combatantName ?? "Unknown combatant"),
    roundNumber:
      typeof payload.roundNumber === "number" && Number.isFinite(payload.roundNumber)
        ? Math.max(1, payload.roundNumber)
        : 1,
    turnIndex:
      typeof payload.turnIndex === "number" && Number.isFinite(payload.turnIndex)
        ? Math.max(0, payload.turnIndex)
        : 0,
    current: payload.current === true,
    collapsed: payload.collapsed === true,
  };
}

export function CombatTurnBlockView({
  node,
  selected,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const payload = combatTurnPayload(node.attrs.payload);
  const isCollapsed = payload.collapsed && !payload.current;
  const className = [
    "combat-turn-block",
    payload.current ? "is-current" : "is-past",
    isCollapsed ? "is-collapsed" : "is-expanded",
    selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  function updatePayload(patch: Partial<CombatTurnBlockPayload>) {
    updateAttributes({
      payload: {
        ...payload,
        ...patch,
      },
    });
  }

  return (
    <NodeViewWrapper
      as="section"
      className={className}
      data-combat-turn-block-id={payload.id}
    >
      <header className="combat-turn-header" contentEditable={false}>
        <span>{payload.combatantName}</span>
        <span>Round {payload.roundNumber}</span>
        {!payload.current && (
          <button
            aria-expanded={!isCollapsed}
            onClick={() => updatePayload({ collapsed: !payload.collapsed })}
            type="button"
          >
            {isCollapsed ? "Expand" : "Collapse"}
          </button>
        )}
        <button
          aria-label={`Delete ${payload.combatantName} turn block`}
          className="combat-turn-delete"
          onClick={deleteNode}
          type="button"
        >
          x
        </button>
      </header>
      {!isCollapsed && <NodeViewContent className="combat-turn-content" />}
    </NodeViewWrapper>
  );
}
