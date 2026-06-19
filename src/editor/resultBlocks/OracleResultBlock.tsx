import { formatPayloadValue, payloadRecord, type ResultBlockViewProps } from "./resultBlockViewTypes";

export function OracleResultBlock({ block, onToggleCollapsed }: ResultBlockViewProps) {
  const payload = payloadRecord(block);

  return (
    <>
      <button className="result-block-collapse" onClick={onToggleCollapsed} type="button">
        {block.collapsed ? "Expand" : "Collapse"}
      </button>
      <strong>Oracle</strong>
      <span>{formatPayloadValue(payload.question ?? block.commandText)}</span>
      {!block.collapsed && (
        <span>
          Odds: {formatPayloadValue(payload.odds ?? "unknown")} | Answer:{" "}
          {formatPayloadValue(payload.answer ?? "pending")}
        </span>
      )}
    </>
  );
}
