import type { Session } from "../../domain/domainTypes";
import { createRepositories } from "../../persistence/sessionRepository";
import { setState, state } from "./stateCore";
import type { ChaosDeltaResult } from "./types";

export const chaosActions = {
  applyChaosDelta(input: { delta: number }): ChaosDeltaResult {
    if (!state.activeSession) {
      return {
        ok: false,
        reason: "No active session",
      };
    }

    const beforeValue = state.activeSession.chaosFactor;
    const afterValue = Math.min(9, Math.max(1, beforeValue + input.delta));
    const activeSession: Session = {
      ...state.activeSession,
      chaosFactor: afterValue,
      updatedAt: new Date().toISOString(),
    };

    setState({
      activeSession,
      chaosFactor: afterValue,
      sessions: state.sessions.map((session) =>
        session.id === activeSession.id ? activeSession : session,
      ),
      persistenceError: undefined,
      persistenceMessage: "Updated Chaos Factor.",
    });

    void createRepositories()
      .then((repositories) =>
        repositories.sessions.update({
          id: activeSession.id,
          chaosFactor: afterValue,
        }),
      )
      .then((savedSession) => {
        if (!savedSession) {
          return;
        }

        setState({
          activeSession: savedSession,
          chaosFactor: savedSession.chaosFactor,
          sessions: state.sessions.map((session) =>
            session.id === savedSession.id ? savedSession : session,
          ),
        });
      })
      .catch((error) => {
        setState({
          persistenceError: error instanceof Error ? error.message : String(error),
          persistenceMessage: "Chaos Factor update failed.",
        });
      });

    return {
      ok: true,
      delta: input.delta,
      beforeValue,
      afterValue,
    };
  },

  async saveChaosFactor(chaosFactor: number) {
    if (!state.activeSession) {
      return null;
    }

    const repositories = await createRepositories();
    const activeSession = await repositories.sessions.update({
      id: state.activeSession.id,
      chaosFactor,
    });

    if (!activeSession) {
      return null;
    }

    setState({
      activeSession,
      chaosFactor: activeSession.chaosFactor,
      sessions: state.sessions.map((session) =>
        session.id === activeSession.id ? activeSession : session,
      ),
    });

    return activeSession;
  },
};
