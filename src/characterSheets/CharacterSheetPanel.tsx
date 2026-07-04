import { useEffect, useState } from "react";
import { CharacterSheetBuilder } from "./CharacterSheetBuilder";
import { appStore, useAppStore } from "../state/appStore";

export function CharacterSheetPanel() {
  const {
    activeSession,
    characterSheets,
    characterSheetTemplates,
    isLoadingTemplates,
    route,
  } = useAppStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSheetName, setNewSheetName] = useState("Kael");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  useEffect(() => {
    void appStore.loadTemplates();
  }, []);

  useEffect(() => {
    setSelectedTemplateId((currentId) => {
      if (
        currentId &&
        characterSheetTemplates.some((template) => template.id === currentId)
      ) {
        return currentId;
      }

      return characterSheetTemplates[0]?.id ?? "";
    });
  }, [characterSheetTemplates]);

  async function createSheet() {
    if (!selectedTemplateId) {
      return;
    }

    const created = await appStore.createCharacterSheet({
      name: newSheetName,
      templateId: selectedTemplateId,
    });

    if (created) {
      setNewSheetName("");
      setIsCreateModalOpen(false);
      appStore.setRoute("characterSheetBuilder");
    }
  }

  if (route === "characterSheetBuilder") {
    return (
      <div className="sheet-screen">
        <CharacterSheetBuilder />
      </div>
    );
  }

  return (
    <div className="sheet-screen">
      <div className="sheet-list-page">
        <div className="sheet-page-header">
          <div>
            <p>Character Sheets</p>
            <h2>Characters</h2>
          </div>
          <button
            disabled={!activeSession}
            onClick={() => setIsCreateModalOpen(true)}
            type="button"
          >
            New Sheet
          </button>
        </div>

        {!activeSession ? (
          <p className="empty-state">Create a session to use character sheets.</p>
        ) : (
          <>
            {characterSheets.length === 0 ? (
              <p className="empty-state">
                No sheets in this session. Create one from a template to get
                started.
              </p>
            ) : (
              <div className="sheet-card-grid">
                {characterSheets.map((sheet) => (
                  <article className="sheet-card" key={sheet.id}>
                    <div>
                      <h3>{sheet.name}</h3>
                      <p>
                        Template:{" "}
                        <strong>
                          {sheet.templateName ?? "Unknown template"}
                        </strong>
                      </p>
                      {sheet.nick ? (
                        <p>
                          Nick: <strong>{sheet.nick}</strong>
                        </p>
                      ) : null}
                    </div>
                    <dl>
                      <div>
                        <dt>Fields</dt>
                        <dd>{sheet.fields.length}</dd>
                      </div>
                    </dl>
                    <button
                      onClick={async () => {
                        await appStore.selectCharacterSheet(sheet.id);
                        appStore.setRoute("characterSheetBuilder");
                      }}
                      type="button"
                    >
                      Open Builder
                    </button>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {isCreateModalOpen ? (
          <div
            aria-labelledby="create-sheet-title"
            aria-modal="true"
            className="sheet-modal-backdrop"
            role="dialog"
          >
            <div className="sheet-modal">
              <div className="sheet-modal-header">
                <h3 id="create-sheet-title">New Character Sheet</h3>
                <button
                  aria-label="Close new sheet dialog"
                  onClick={() => setIsCreateModalOpen(false)}
                  type="button"
                >
                  x
                </button>
              </div>

              <label>
                Sheet name
                <input
                  autoFocus
                  onChange={(event) => setNewSheetName(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && selectedTemplateId) {
                      event.preventDefault();
                      void createSheet();
                    }
                  }}
                  placeholder="Character name"
                  type="text"
                  value={newSheetName}
                />
              </label>
              <label>
                Template
                <select
                  disabled={characterSheetTemplates.length === 0}
                  onChange={(event) =>
                    setSelectedTemplateId(event.currentTarget.value)
                  }
                  value={selectedTemplateId}
                >
                  {characterSheetTemplates.length === 0 ? (
                    <option value="">
                      {isLoadingTemplates ? "Loading templates..." : "No templates"}
                    </option>
                  ) : (
                    characterSheetTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <div className="sheet-modal-actions">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  disabled={!selectedTemplateId || !newSheetName.trim()}
                  onClick={() => void createSheet()}
                  type="button"
                >
                  Create Sheet
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
