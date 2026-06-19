import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import type { ResultBlock } from "../../domain/domainTypes";
import { ChaosResultBlock } from "./ChaosResultBlock";
import { CombatResultBlock } from "./CombatResultBlock";
import { ErrorResultBlock } from "./ErrorResultBlock";
import { OracleResultBlock } from "./OracleResultBlock";
import { RollResultBlock } from "./RollResultBlock";
import { SceneResultBlock } from "./SceneResultBlock";
import { StatResultBlock } from "./StatResultBlock";

function isResultBlock(value: unknown): value is ResultBlock {
  return Boolean(value && typeof value === "object" && "type" in value);
}

export function ResultBlockView({
  node,
  selected,
  updateAttributes,
}: ReactNodeViewProps) {
  const block = isResultBlock(node.attrs.block) ? node.attrs.block : null;

  if (!block) {
    return (
      <NodeViewWrapper className="result-block result-block-error">
        Invalid result block
      </NodeViewWrapper>
    );
  }

  const className = [
    "result-block",
    `result-block-${block.type}`,
    selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const canCollapse = block.type === "oracle" || block.type === "scene";
  const onToggleCollapsed = canCollapse
    ? () => updateAttributes({ block: { ...block, collapsed: !block.collapsed } })
    : undefined;

  return (
    <NodeViewWrapper
      as="section"
      className={className}
      data-result-block-id={block.id}
      data-result-block-type={block.type}
    >
      {block.type === "roll" && <RollResultBlock block={block} selected={selected} />}
      {block.type === "oracle" && (
        <OracleResultBlock
          block={block}
          onToggleCollapsed={onToggleCollapsed}
          selected={selected}
        />
      )}
      {block.type === "scene" && (
        <SceneResultBlock
          block={block}
          onToggleCollapsed={onToggleCollapsed}
          selected={selected}
        />
      )}
      {block.type === "combat" && <CombatResultBlock block={block} selected={selected} />}
      {block.type === "stat" && <StatResultBlock block={block} selected={selected} />}
      {block.type === "chaos" && <ChaosResultBlock block={block} selected={selected} />}
      {block.type === "error" && <ErrorResultBlock block={block} selected={selected} />}
    </NodeViewWrapper>
  );
}
