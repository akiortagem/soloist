import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppRoute } from "../state/appStore";
import {
  createRepositories,
  type SessionRecord,
} from "../persistence/sessionRepository";

const routeLabels: Record<AppRoute, string> = {
  sessions: "Sessions",
  templates: "Templates",
  settings: "Settings",
};

export function App() {
  const [route, setRoute] = useState<AppRoute>("sessions");
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [persistenceMessage, setPersistenceMessage] = useState(
    "Opening local database...",
  );
  const [persistenceError, setPersistenceError] = useState<string>();

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions],
  );

  const loadSessions = useCallback(async () => {
    setPersistenceError(undefined);

    try {
      const repositories = await createRepositories();
      const persistedSessions = await repositories.sessions.list();

      setSessions(persistedSessions);
      setActiveSessionId((currentId) => {
        if (currentId && persistedSessions.some((session) => session.id === currentId)) {
          return currentId;
        }

        return persistedSessions[0]?.id;
      });
      setPersistenceMessage(
        persistedSessions.length > 0
          ? `Read ${persistedSessions.length} session${
              persistedSessions.length === 1 ? "" : "s"
            } from SQLite.`
          : "SQLite ready. Create a smoke test session.",
      );
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : String(error));
      setPersistenceMessage("SQLite unavailable.");
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const createSmokeSession = async () => {
    setIsCreatingSession(true);
    setPersistenceError(undefined);

    try {
      const repositories = await createRepositories();
      const createdSession = await repositories.sessions.create({
        name: `Smoke Session ${new Date().toLocaleTimeString()}`,
      });
      const readSession = await repositories.sessions.get(createdSession.id);

      await loadSessions();
      setActiveSessionId(createdSession.id);
      setPersistenceMessage(
        readSession
          ? `Inserted and read ${readSession.name}.`
          : "Inserted a session, but read-back returned no row.",
      );
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : String(error));
      setPersistenceMessage("SQLite smoke test failed.");
    } finally {
      setIsCreatingSession(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <h1>Soloist</h1>
          <p>Solo TRPG markdown workspace</p>
        </div>
        <div className="session-status">
          <span>{activeSession?.name ?? "No session"}</span>
          <strong>{isLoadingSessions ? "Loading SQLite" : "SQLite local"}</strong>
        </div>
      </header>

      <div className="workspace">
        <aside className="left-sidebar" aria-label="Primary navigation">
          <nav>
            {(Object.keys(routeLabels) as AppRoute[]).map((routeKey) => (
              <button
                className={route === routeKey ? "active" : ""}
                key={routeKey}
                onClick={() => setRoute(routeKey)}
                type="button"
              >
                {routeLabels[routeKey]}
              </button>
            ))}
          </nav>

          <section>
            <h2>Documents</h2>
            <div className="session-list">
              {sessions.length === 0 && (
                <p className="empty-state">
                  {isLoadingSessions ? "Loading sessions..." : "No sessions yet."}
                </p>
              )}

              {sessions.map((session) => (
                <button
                  className={session.id === activeSession?.id ? "selected" : ""}
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  type="button"
                >
                  <span>{session.name}</span>
                  <small>Chaos {session.chaosFactor}</small>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="editor-area" aria-label="Editor placeholder">
          <div className="editor-toolbar">
            <span>{routeLabels[route]}</span>
            <button
              disabled={isCreatingSession}
              onClick={createSmokeSession}
              type="button"
            >
              {isCreatingSession ? "Creating..." : "New Session"}
            </button>
          </div>

          <article className="editor-placeholder">
            <p className="kicker">SQLite smoke test</p>
            <h2>{activeSession?.name ?? "No persisted session selected"}</h2>
            <p>
              This screen loads sessions from the local SQLite database. Use New
              Session to insert a row and immediately read it back through the
              TypeScript repository.
            </p>
            <pre>{persistenceMessage}</pre>
            {persistenceError && <p className="error-state">{persistenceError}</p>}
          </article>
        </section>

        <aside className="right-panel" aria-label="Session tools">
          <section>
            <h2>Character Sheets</h2>
            <p>No sheets yet. This panel will list freeform session characters.</p>
          </section>

          <section>
            <h2>Combat Tracker</h2>
            <p>Manual initiative and status controls will appear here.</p>
          </section>

          <section>
            <h2>Oracle Settings</h2>
            <dl>
              <div>
                <dt>Provider</dt>
                <dd>Demo oracle</dd>
              </div>
              <div>
                <dt>Chaos Factor</dt>
                <dd>{activeSession?.chaosFactor ?? 5}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
