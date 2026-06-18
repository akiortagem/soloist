import { useEffect } from "react";
import {
  appStore,
  type AppRoute,
  useAppStore,
} from "../state/appStore";

const routeLabels: Record<AppRoute, string> = {
  sessions: "Sessions",
  templates: "Templates",
  settings: "Settings",
};

export function App() {
  const {
    activeCharacterSheet,
    activeDocument,
    activeSession,
    chaosFactor,
    combatState,
    isCreatingSession,
    isLoadingSessions,
    persistenceError,
    persistenceMessage,
    route,
    sessions,
  } = useAppStore();

  useEffect(() => {
    void appStore.loadSessions();
  }, []);

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
                onClick={() => appStore.setRoute(routeKey)}
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
                  onClick={() => void appStore.selectSession(session.id)}
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
              onClick={() => void appStore.createSession()}
              type="button"
            >
              {isCreatingSession ? "Creating..." : "New Session"}
            </button>
          </div>

          <article className="editor-placeholder">
            <p className="kicker">SQLite workspace</p>
            <h2>{activeSession?.name ?? "No persisted session selected"}</h2>
            <p>
              {activeDocument
                ? `${activeDocument.title} is loaded from the session document.`
                : "Create a session to start a document."}
            </p>
            <pre>{persistenceMessage}</pre>
            {persistenceError && <p className="error-state">{persistenceError}</p>}
          </article>
        </section>

        <aside className="right-panel" aria-label="Session tools">
          <section>
            <h2>Character Sheets</h2>
            <p>
              {activeCharacterSheet
                ? activeCharacterSheet.name
                : "No active sheet for this session."}
            </p>
          </section>

          <section>
            <h2>Combat Tracker</h2>
            <p>
              {combatState?.active
                ? `${combatState.combatants.length} combatants`
                : "No active combat."}
            </p>
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
                <dd>{chaosFactor}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
