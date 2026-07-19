import { demoOracleProvider } from "./DemoOracleProvider";
import type { OracleProvider } from "./OracleProvider";
import type { OracleTableContribution } from "../plugins/pluginTypes";

export type OracleTableSource = "plugin";

export type OracleTableDefinition = OracleTableContribution & {
  source: OracleTableSource;
  pluginId: string;
  contributionId: string;
};

export class OracleTableRegistry {
  private readonly tables = new Map<string, OracleTableDefinition>();

  register(table: OracleTableDefinition): void {
    if (this.tables.has(table.id)) {
      throw new Error(`Oracle table already registered: ${table.id}`);
    }

    this.tables.set(table.id, cloneOracleTable(table));
  }

  list(): OracleTableDefinition[] {
    return Array.from(this.tables.values(), cloneOracleTable);
  }

  get(id: string): OracleTableDefinition | undefined {
    const table = this.tables.get(id);
    return table ? cloneOracleTable(table) : undefined;
  }

  unregisterPlugin(pluginId: string): void {
    for (const table of this.tables.values()) {
      if (table.pluginId === pluginId) {
        this.tables.delete(table.id);
      }
    }
  }
}

export const DEFAULT_ORACLE_PROVIDER_ID = demoOracleProvider.id;

const providers = new Map<string, OracleProvider>([
  [demoOracleProvider.id, demoOracleProvider],
]);
const pluginProviderOwners = new Map<string, string>();
export const oracleTableRegistry = new OracleTableRegistry();

let activeOracleProviderId = DEFAULT_ORACLE_PROVIDER_ID;

export function registerOracleProvider(provider: OracleProvider, pluginId?: string) {
  if (pluginId && providers.has(provider.id)) {
    throw new Error(`Oracle provider already registered: ${provider.id}`);
  }
  providers.set(provider.id, provider);
  if (pluginId) pluginProviderOwners.set(provider.id, pluginId);
  return provider;
}

export function unregisterOracleProvider(id: string): void {
  if (id === DEFAULT_ORACLE_PROVIDER_ID) return;
  providers.delete(id);
  pluginProviderOwners.delete(id);
  if (activeOracleProviderId === id) activeOracleProviderId = DEFAULT_ORACLE_PROVIDER_ID;
}

export function unregisterPluginOracleProviders(pluginId: string): void {
  for (const [id, owner] of pluginProviderOwners) {
    if (owner === pluginId) unregisterOracleProvider(id);
  }
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

function cloneOracleTable(table: OracleTableDefinition): OracleTableDefinition {
  return {
    ...table,
    entries: table.entries.map((entry) => ({ ...entry })),
  };
}
