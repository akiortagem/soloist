import { getActiveOracleProvider } from "../oracle/oracleRegistry";

export async function setupScene(prompt: string, chaosFactor: number) {
  return await getActiveOracleProvider().setupScene({
    prompt,
    roll: Math.floor(Math.random() * 10) + 1,
    chaosFactor,
  });
}
