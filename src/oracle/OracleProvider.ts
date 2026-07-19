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
  askYesNo(input: AskOracleInput): Promise<AskOracleResult> | AskOracleResult;
  setupScene(input: SceneSetupInput): Promise<SceneSetupResult> | SceneSetupResult;
};
