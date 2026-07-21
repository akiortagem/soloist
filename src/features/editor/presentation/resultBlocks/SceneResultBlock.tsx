import {
  formatPayloadValue,
  payloadRecord,
  type ResultBlockViewProps,
} from "./resultBlockViewTypes";

export function SceneResultBlock({
  block,
  onToggleCollapsed,
}: ResultBlockViewProps) {
  const payload = payloadRecord(block);

  return (
    <>
      <button
        className="result-block-collapse"
        onClick={onToggleCollapsed}
        type="button"
      >
        {block.collapsed ? "Expand" : "Collapse"}
      </button>
      <strong>Scene</strong>
      <span>{formatPayloadValue(payload.prompt ?? block.commandText)}</span>
      {!block.collapsed && (
        <span>Result: {formatPayloadValue(payload.result ?? "pending")}</span>
      )}
    </>
  );
}
