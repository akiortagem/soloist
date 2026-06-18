import type { ParsedCommand } from "./commandTypes";

export function parseCommand(raw: string): ParsedCommand {
  return { type: "unknown", raw };
}
