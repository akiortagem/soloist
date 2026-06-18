import { getActiveOracleProvider } from "../oracle/oracleRegistry";

export function setupScene(prompt: string, chaosFactor: number) {
  return getActiveOracleProvider().setupScene({
    prompt,
    roll: Math.floor(Math.random() * 10) + 1,
    chaosFactor,
  });
}
