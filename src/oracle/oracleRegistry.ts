import { demoOracleProvider } from "./DemoOracleProvider";
import type { OracleProvider } from "./OracleProvider";

const providers = new Map<string, OracleProvider>([
  [demoOracleProvider.id, demoOracleProvider],
]);

export function getActiveOracleProvider() {
  return demoOracleProvider;
}

export function getOracleProvider(id: string) {
  return providers.get(id);
}
