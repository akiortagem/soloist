import {
  formatPayloadValue,
  payloadRecord,
  type ResultBlockViewProps,
} from "./resultBlockViewTypes";

function formatRollTerms(terms: unknown): string {
  if (!Array.isArray(terms)) {
    return "";
  }

  return terms
    .map((term) => {
      if (!term || typeof term !== "object") {
        return "";
      }

      const record = term as Record<string, unknown>;
      if (record.type === "modifier") {
        return `${formatPayloadValue(record.notation)} = ${formatPayloadValue(record.subtotal)}`;
      }

      const rolls = Array.isArray(record.rolls)
        ? record.rolls
            .map((roll) => {
              if (!roll || typeof roll !== "object") {
                return "";
              }

              const rollRecord = roll as Record<string, unknown>;
              const suffix = rollRecord.kept === false ? " dropped" : "";
              return `${formatPayloadValue(rollRecord.value)}${suffix}`;
            })
            .filter(Boolean)
            .join(", ")
        : "";

      return `${formatPayloadValue(record.notation)} [${rolls}] = ${formatPayloadValue(
        record.subtotal,
      )}`;
    })
    .filter(Boolean)
    .join("; ");
}

export function RollResultBlock({ block }: ResultBlockViewProps) {
  const payload = payloadRecord(block);
  const details = formatRollTerms(payload.terms);

  return (
    <>
      <strong>Roll</strong>
      <span>{formatPayloadValue(payload.formula ?? block.commandText)}</span>
      <span>Total: {formatPayloadValue(payload.total ?? "pending")}</span>
      {details.length > 0 && (
        <span className="result-block-details">{details}</span>
      )}
    </>
  );
}
