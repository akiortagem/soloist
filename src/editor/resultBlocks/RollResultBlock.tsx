import { formatPayloadValue, payloadRecord, type ResultBlockViewProps } from "./resultBlockViewTypes";

export function RollResultBlock({ block }: ResultBlockViewProps) {
  const payload = payloadRecord(block);

  return (
    <>
      <strong>Roll</strong>
      <span>{formatPayloadValue(payload.formula ?? block.commandText)}</span>
      <span>Total: {formatPayloadValue(payload.total ?? "pending")}</span>
    </>
  );
}
