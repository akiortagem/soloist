import { formatPayloadValue, payloadRecord, type ResultBlockViewProps } from "./resultBlockViewTypes";

export function ChaosResultBlock({ block }: ResultBlockViewProps) {
  const payload = payloadRecord(block);

  return (
    <>
      <strong>CF :</strong>
      <span>
        {formatPayloadValue(payload.beforeValue ?? "?")} {"->"}{" "}
        {formatPayloadValue(payload.afterValue ?? "?")}
      </span>
    </>
  );
}
