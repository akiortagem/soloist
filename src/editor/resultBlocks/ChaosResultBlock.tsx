import { formatPayloadValue, payloadRecord, type ResultBlockViewProps } from "./resultBlockViewTypes";

export function ChaosResultBlock({ block }: ResultBlockViewProps) {
  const payload = payloadRecord(block);

  return (
    <>
      <strong>Chaos</strong>
      <span>
        {formatPayloadValue(payload.before ?? "?")} to{" "}
        {formatPayloadValue(payload.after ?? "?")}
      </span>
    </>
  );
}
