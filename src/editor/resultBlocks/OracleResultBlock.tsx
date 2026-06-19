import { formatPayloadValue, payloadRecord, type ResultBlockViewProps } from "./resultBlockViewTypes";

export function OracleResultBlock({ block, onToggleCollapsed }: ResultBlockViewProps) {
  const payload = payloadRecord(block);
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
