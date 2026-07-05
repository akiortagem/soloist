import { formatPayloadValue, payloadRecord, type ResultBlockViewProps } from "./resultBlockViewTypes";

export function OracleResultBlock({ block, onToggleCollapsed }: ResultBlockViewProps) {
  const payload = payloadRecord(block);
  const entry = payloadRecord({ ...block, payload: payload.entry });

  if (typeof payload.pluginId === "string" && typeof payload.tableId === "string") {
    const roll = payloadRecord({ ...block, payload: payload.roll });
    const details = [
      `Plugin: ${formatPayloadValue(payload.pluginId)}`,
      `Table: ${formatPayloadValue(payload.tableName ?? payload.tableId)}`,
      roll.total !== undefined ? `Roll: ${formatPayloadValue(roll.total)}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    return (
      <>
        <button className="result-block-collapse" onClick={onToggleCollapsed} type="button">
          {block.collapsed ? "Expand" : "Collapse"}
        </button>
        <strong>{formatPayloadValue(payload.tableName ?? "Random Table")}</strong>
        <span>{formatPayloadValue(entry.text ?? payload.entry)}</span>
        {!block.collapsed && (
          <span className="result-block-details">{details}</span>
        )}
      </>
    );
  }

  const answer = formatPayloadValue(payload.answer ?? "pending");
  const details = [
    `Odds: ${formatPayloadValue(payload.odds ?? "unknown")}`,
    `Roll: ${formatPayloadValue(payload.roll ?? "unknown")}`,
    `Chaos: ${formatPayloadValue(payload.chaosFactor ?? "unknown")}`,
    `Exceptional: ${formatPayloadValue(payload.exceptional ?? false)}`,
    formatPayloadValue(payload.explanation),
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <>
      <button className="result-block-collapse" onClick={onToggleCollapsed} type="button">
        {block.collapsed ? "Expand" : "Collapse"}
      </button>
      <strong>Oracle</strong>
      <span>{formatPayloadValue(payload.question ?? block.commandText)}</span>
      <span
        className="result-block-oracle-answer"
        data-answer={answer.toLowerCase()}
        title={details}
      >
        {answer}
      </span>
      {!block.collapsed && (
        <span className="result-block-details">{details}</span>
      )}
    </>
  );
}
