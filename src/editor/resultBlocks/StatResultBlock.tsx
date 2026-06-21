import { formatPayloadValue, payloadRecord, type ResultBlockViewProps } from "./resultBlockViewTypes";

export function StatResultBlock({ block }: ResultBlockViewProps) {
  const payload = payloadRecord(block);
  const sheet = formatPayloadValue(payload.sheet ?? "Unknown sheet");
  const stat = formatPayloadValue(payload.stat ?? "stat");
  const delta = formatPayloadValue(payload.delta ?? "");
  const beforeValue = formatPayloadValue(payload.beforeValue);
  const afterValue = formatPayloadValue(payload.afterValue);
  const details =
    beforeValue.length > 0 && afterValue.length > 0
      ? `${stat} was ${beforeValue}; now ${afterValue}.`
      : "";

  return (
    <>
      <span title={details || undefined}>
        {sheet} {stat} {delta}
      </span>
      {details.length > 0 && (
        <span className="result-block-details">{details}</span>
      )}
    </>
  );
}
