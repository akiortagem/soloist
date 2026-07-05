import { demoOracleProvider } from "./DemoOracleProvider";
import type { OracleProvider } from "./OracleProvider";

export const DEFAULT_ORACLE_PROVIDER_ID = demoOracleProvider.id;

const providers = new Map<string, OracleProvider>([
  [demoOracleProvider.id, demoOracleProvider],
]);

let activeOracleProviderId = DEFAULT_ORACLE_PROVIDER_ID;

export function registerOracleProvider(provider: OracleProvider) {
  providers.set(provider.id, provider);
  return provider;
}

export function listOracleProviders() {
  return Array.from(providers.values());
}

export function getOracleProvider(id: string) {
  return providers.get(id);
}

export function getActiveOracleProvider() {
  return providers.get(activeOracleProviderId) ?? demoOracleProvider;
}

export function setActiveOracleProvider(id: string) {
  const provider = providers.get(id) ?? demoOracleProvider;
  activeOracleProviderId = provider.id;
  return provider;
}
