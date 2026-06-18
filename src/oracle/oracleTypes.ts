export type OracleOdds =
  | "impossible"
  | "no_way"
  | "very_unlikely"
  | "unlikely"
  | "50_50"
  | "likely"
  | "very_likely"
  | "near_sure"
  | "sure_thing";

export type AskOracleInput = {
  question: string;
  odds: OracleOdds;
  d100: number;
  chaosFactor: number;
};

export type AskOracleResult = {
  question: string;
  odds: OracleOdds;
  roll: number;
  answer: "Yes" | "No";
  exceptional: boolean;
  chaosFactor: number;
  providerId: string;
  providerName: string;
  explanation: string;
};

export type SceneSetupInput = {
  prompt: string;
  roll: number;
  chaosFactor: number;
};

export type SceneSetupResult = {
  prompt: string;
  roll: number;
  chaosFactor: number;
  adjustmentType: string;
  providerId: string;
  providerName: string;
  explanation: string;
};
