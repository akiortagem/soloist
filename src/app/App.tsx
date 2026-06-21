import { useEffect, useState } from "react";
import { CharacterSheetPanel } from "../characterSheets/CharacterSheetPanel";
import { CharacterSheetTemplatePanel } from "../characterSheets/CharacterSheetTemplatePanel";
import { Editor } from "../editor/Editor";
import { appStore, useAppStore } from "../state/appStore";

const navigationRoutes = [
  { key: "sessions", label: "Sessions" },
  { key: "characterSheets", label: "Character Sheets" },
  { key: "templates", label: "Templates" },
  { key: "settings", label: "Settings" },
] as const;

export function App() {
  const {
    activeSession,
    chaosFactor,
    combatState,
    isCreatingSession,
    isLoadingSessions,
    route,
    sessions,
  } = useAppStore();
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

  useEffect(() => {
    void appStore.loadSessions();
  }, []);

  return (
    <main className="app-shell">
      <div className={`workspace${isRightPanelOpen ? " tools-open" : ""}`}>
        <aside className="left-sidebar" aria-label="Primary navigation">
          <nav>
            {navigationRoutes.map(({ key, label }) => (
              <button
                className={route === key ? "active" : ""}
                key={key}
                onClick={() => appStore.setRoute(key)}
                type="button"
              >
                {label}
              </button>
            ))}
          </nav>

          <section>
            <div className="sidebar-section-header">
              <h2>Documents</h2>
              <button
                aria-label="New session"
                disabled={isCreatingSession}
                onClick={() => void appStore.createSession()}
                title="New session"
                type="button"
              >
                +
              </button>
            </div>
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

        <section className="editor-area" aria-label="Main editor">
          {route === "characterSheets" || route === "characterSheetBuilder" ? (
            <CharacterSheetPanel />
          ) : route === "templates" ? (
            <CharacterSheetTemplatePanel />
          ) : (
            <Editor />
          )}
        </section>

        <button
          aria-expanded={isRightPanelOpen}
          aria-label={isRightPanelOpen ? "Hide tools panel" : "Show tools panel"}
          className="tools-edge-toggle"
          onClick={() => setIsRightPanelOpen((isOpen) => !isOpen)}
          title={isRightPanelOpen ? "Hide tools" : "Show tools"}
          type="button"
        >
          {isRightPanelOpen ? "›" : "‹"}
        </button>

        {isRightPanelOpen ? (
          <aside className="right-panel" aria-label="Session tools">
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
        ) : null}
      </div>
    </main>
  );
}
