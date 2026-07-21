import { ensureOnboardingContent } from "../../onboarding/onboardingContent";
import {
  getActiveOracleProvider,
  setActiveOracleProvider,
} from "../../oracle/oracleRegistry";
import { createRepositories } from "../../persistence/sessionRepository";
import type { Application } from "../../app/composition/application";
import {
  getActiveSession,
  loadActiveSessionData,
} from "./activeSessionData";
import {
  ACTIVE_ORACLE_PROVIDER_SETTING_KEY,
  DEFAULT_CHAOS_FACTOR,
  setState,
  state,
} from "./stateCore";

function parseActiveOracleProviderId(valueJson: string) {
  try {
    const parsed = JSON.parse(valueJson);
    return typeof parsed === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export const bootstrapActions = {
  async loadSessions(application: Application) {
    setState({
      isLoadingSessions: true,
      persistenceError: undefined,
    });

    try {
      const repositories = await createRepositories();
      const { statuses: pluginStatuses } = await application.reloadPlugins();
      await ensureOnboardingContent(repositories);
      const activeOracleProviderSetting = await repositories.settings.get(
        ACTIVE_ORACLE_PROVIDER_SETTING_KEY,
      );
      const activeOracleProvider = setActiveOracleProvider(
        activeOracleProviderSetting
          ? (parseActiveOracleProviderId(activeOracleProviderSetting.valueJson) ??
              "")
          : getActiveOracleProvider().id,
      );
      const sessions = await repositories.sessions.list();
      const activeSession = getActiveSession(sessions, state.activeSessionId);

      setState({
        sessions,
        activeSessionId: activeSession?.id,
        activeSession,
        activeOracleProviderId: activeOracleProvider.id,
        pluginStatuses,
        persistenceMessage:
          sessions.length > 0
            ? `Read ${sessions.length} session${
                sessions.length === 1 ? "" : "s"
              } from SQLite.`
            : "SQLite ready. Create a session.",
      });
      await loadActiveSessionData(activeSession);
    } catch (error) {
      setState({
        activeDocument: null,
        campaignDocuments: [],
        characterSheets: [],
        activeCharacterSheet: null,
        activeSession: null,
        activeSessionId: undefined,
        pluginStatuses: [],
        combatState: null,
        documentSaveState: "error",
        chaosFactor: DEFAULT_CHAOS_FACTOR,
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "SQLite unavailable.",
      });
    } finally {
      setState({ isLoadingSessions: false });
    }
  },

  async selectOracleProvider(providerId: string) {
    const activeOracleProvider = setActiveOracleProvider(providerId);

    try {
      const repositories = await createRepositories();
      await repositories.settings.set({
        key: ACTIVE_ORACLE_PROVIDER_SETTING_KEY,
        valueJson: JSON.stringify(activeOracleProvider.id),
      });

      setState({
        activeOracleProviderId: activeOracleProvider.id,
        persistenceError: undefined,
      });
    } catch (error) {
      setState({
        activeOracleProviderId: activeOracleProvider.id,
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Oracle provider setting save failed.",
      });
    }

    return activeOracleProvider;
  },
};
