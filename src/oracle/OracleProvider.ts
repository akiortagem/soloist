import type {
  AskOracleInput,
  AskOracleResult,
  SceneSetupInput,
  SceneSetupResult,
} from "./oracleTypes";

export type OracleProvider = {
  id: string;
  name: string;
  description: string;
  askYesNo(input: AskOracleInput): AskOracleResult;
  setupScene(input: SceneSetupInput): SceneSetupResult;
};
