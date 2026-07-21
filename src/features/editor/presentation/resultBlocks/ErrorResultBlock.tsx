import {
  formatPayloadValue,
  payloadRecord,
  type ResultBlockViewProps,
} from "./resultBlockViewTypes";

export function ErrorResultBlock({ block }: ResultBlockViewProps) {
  const payload = payloadRecord(block);

  return (
    <>
      <strong>Error</strong>
      <span>
        {formatPayloadValue(payload.reason ?? "Command could not be handled")}
      </span>
      <code>{block.commandText}</code>
    </>
  );
}
