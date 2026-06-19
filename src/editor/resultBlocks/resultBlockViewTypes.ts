import type { ResultBlock } from "../../domain/domainTypes";

export type ResultBlockViewProps = {
  block: ResultBlock;
  selected?: boolean;
  onToggleCollapsed?: () => void;
};

export function payloadRecord(block: ResultBlock): Record<string, unknown> {
  return block.payload && typeof block.payload === "object"
    ? (block.payload as Record<string, unknown>)
    : {};
}

export function formatPayloadValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}
