import { formatPayloadValue, payloadRecord, type ResultBlockViewProps } from "./resultBlockViewTypes";

export function StatResultBlock({ block }: ResultBlockViewProps) {
  const payload = payloadRecord(block);

  return (
    <>
      <strong>Stat</strong>
      <span>
        {formatPayloadValue(payload.sheet ?? "Unknown sheet")}{" "}
        {formatPayloadValue(payload.stat ?? "stat")}{" "}
        {formatPayloadValue(payload.delta ?? "")}
      </span>
    </>
  );
}
