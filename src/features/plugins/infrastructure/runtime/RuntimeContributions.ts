import {
  registerOracleProvider,
  unregisterOracleProvider,
  unregisterPluginOracleProviders,
} from "../../../../oracle/oracleRegistry";
import type { OracleProvider } from "../../../../oracle/OracleProvider";

export interface RuntimeContributions {
  registerOracleProvider(pluginId: string, provider: OracleProvider): void;
  unregisterOracleProvider(id: string): void;
  unregisterPlugin(pluginId: string): void;
}

export function createGlobalRuntimeContributions(): RuntimeContributions {
  return {
    registerOracleProvider(pluginId, provider) {
      registerOracleProvider(provider, pluginId);
    },
    unregisterOracleProvider,
    unregisterPlugin: unregisterPluginOracleProviders,
  };
}
