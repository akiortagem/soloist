import {
  formatPayloadValue,
  payloadRecord,
  type ResultBlockViewProps,
} from "./resultBlockViewTypes";

export function CombatResultBlock({ block }: ResultBlockViewProps) {
  const payload = payloadRecord(block);

  return (
    <>
      <strong>Combat</strong>
      <span>{formatPayloadValue(payload.status ?? block.commandText)}</span>
    </>
  );
}
