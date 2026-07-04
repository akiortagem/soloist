import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  LayoutTemplate,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { CharacterSheetTemplatePanel } from "../characterSheets/CharacterSheetTemplatePanel";
import type { Document } from "../domain/domainTypes";
import { CombatPanel } from "../combat/CombatPanel";
import { Editor } from "../editor/Editor";
import { appStore, useAppStore } from "../state/appStore";

const navigationRoutes = [
  { key: "templates", label: "Templates" },
] as const;

function DocumentMenu({
  document,
  onClose,
}: {
  document: Document;
  onClose: () => void;
}) {
  function deleteDocument() {
    if (!window.confirm(`Delete "${document.title}"?`)) {
      return;
    }

    void appStore.deleteDocument(document.id);
    onClose();
  }

  if (document.folderKind === "characters") {
    return (
      <>
        <button
          onClick={() => {
            void appStore.createCharacterInFolder(document.id);
            onClose();
          }}
          type="button"
        >
          Add character
        </button>
        <button onClick={deleteDocument} type="button">
          <Trash2 aria-hidden="true" />
          Delete
        </button>
      </>
    );
  }

  if (document.folderKind === "sessions") {
    return (
      <>
        <button
          onClick={() => {
            void appStore.createDocumentInFolder({
              parentId: document.id,
              kind: "session",
            });
            onClose();
          }}
          type="button"
        >
          Add session
        </button>
        <button onClick={deleteDocument} type="button">
          <Trash2 aria-hidden="true" />
          Delete
        </button>
      </>
    );
  }

  if (document.kind !== "folder") {
    return (
      <button onClick={deleteDocument} type="button">
        <Trash2 aria-hidden="true" />
        Delete
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          void appStore.createDocumentInFolder({
            parentId: document.id,
            kind: "document",
          });
          onClose();
        }}
        type="button"
      >
        Add document
      </button>
      <button onClick={deleteDocument} type="button">
        <Trash2 aria-hidden="true" />
        Delete
      </button>
    </>
  );
}

export function App() {
  const {
    activeDocument,
    activeSession,
    campaignDocuments,
    chaosFactor,
    isCreatingSession,
    isLoadingSessions,
    route,
    sessions,
    rightPanelCloseRequest,
    rightPanelOpenRequest,
  } = useAppStore();
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campaignNameDraft, setCampaignNameDraft] = useState("");
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    void appStore.loadSessions();
  }, []);

  useEffect(() => {
    if (rightPanelOpenRequest > 0) {
      setIsRightPanelOpen(true);
    }
  }, [rightPanelOpenRequest]);

  useEffect(() => {
    if (rightPanelCloseRequest > 0) {
      setIsRightPanelOpen(false);
    }
  }, [rightPanelCloseRequest]);

  function getChildDocuments(parentId: string) {
    return campaignDocuments.filter((document) => document.parentId === parentId);
  }

  function startCampaignRename(session: (typeof sessions)[number]) {
    setEditingCampaignId(session.id);
    setCampaignNameDraft(session.name);
  }

  async function finishCampaignRename(sessionId: string) {
    if (editingCampaignId !== sessionId) {
      return;
    }

    await appStore.renameSession(sessionId, campaignNameDraft.trim() || "Untitled");
    setEditingCampaignId(null);
    setCampaignNameDraft("");
  }

  function toggleFolder(folderId: string) {
    setCollapsedFolderIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(folderId)) {
        nextIds.delete(folderId);
      } else {
        nextIds.add(folderId);
      }

      return nextIds;
    });
  }

  function renderDocument(document: Document) {
    return (
      <div className="tree-row document-row" key={document.id}>
        <button
          className={document.id === activeDocument?.id ? "selected" : ""}
          onClick={() => void appStore.selectDocument(document.id)}
          type="button"
        >
          {document.kind === "character" ? (
            <UserRound aria-hidden="true" />
          ) : document.kind === "session" ? (
            <BookOpen aria-hidden="true" />
          ) : (
            <FileText aria-hidden="true" />
          )}
          <span>{document.title}</span>
        </button>
        <div className="tree-menu">
          <button
            aria-expanded={openMenuId === document.id}
            aria-label={`Options for ${document.title}`}
            onClick={() =>
              setOpenMenuId((currentId) =>
                currentId === document.id ? null : document.id,
              )
            }
            title="Document options"
            type="button"
          >
            <MoreHorizontal aria-hidden="true" />
          </button>
          {openMenuId === document.id ? (
            <div className="tree-menu-popover" role="menu">
              <DocumentMenu
                document={document}
                onClose={() => setOpenMenuId(null)}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderFolder(document: Document) {
    const children = getChildDocuments(document.id);
    const isCollapsed = collapsedFolderIds.has(document.id);

    return (
      <div className="tree-node" key={document.id}>
        <div className="tree-row folder-row">
          <button
            className={document.id === activeDocument?.id ? "selected" : ""}
            onClick={() => {
              void appStore.selectDocument(document.id);
              toggleFolder(document.id);
            }}
            type="button"
          >
            {isCollapsed ? (
              <ChevronRight aria-hidden="true" />
            ) : (
              <ChevronDown aria-hidden="true" />
            )}
            <Folder aria-hidden="true" />
            <span>{document.title}</span>
          </button>
          <div className="tree-menu">
            <button
              aria-expanded={openMenuId === document.id}
              aria-label={`Options for ${document.title}`}
              onClick={() =>
                setOpenMenuId((currentId) =>
                  currentId === document.id ? null : document.id,
                )
              }
              title="Folder options"
              type="button"
            >
              <MoreHorizontal aria-hidden="true" />
            </button>
            {openMenuId === document.id ? (
              <div className="tree-menu-popover" role="menu">
                <DocumentMenu
                  document={document}
                  onClose={() => setOpenMenuId(null)}
                />
              </div>
            ) : null}
          </div>
        </div>

        {!isCollapsed ? (
          <div className="tree-children">
            {children.length === 0 ? (
              <p className="tree-empty">Nothing here.</p>
            ) : (
              children.map((child) =>
                child.kind === "folder" ? (
                  renderFolder(child)
                ) : (
                  renderDocument(child)
                ),
              )
            )}
          </div>
        ) : null}
      </div>
    );
  }

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
                <LayoutTemplate aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>

          <section>
            <div className="sidebar-section-header">
              <h2>Documents</h2>
              <button
                aria-label="New campaign"
                disabled={isCreatingSession}
                onClick={async () => {
                  const createdSession = await appStore.createSession("Untitled");

                  if (createdSession) {
                    startCampaignRename(createdSession);
                  }
                }}
                title="New campaign"
                type="button"
              >
                <Plus aria-hidden="true" />
              </button>
            </div>
            <div className="document-tree">
              {sessions.length === 0 && (
                <p className="empty-state">
                  {isLoadingSessions ? "Loading sessions..." : "No sessions yet."}
                </p>
              )}

              {sessions.map((session) => (
                <div className="tree-campaign" key={session.id}>
                  <div
                    className={`tree-row campaign-row${
                      session.id === activeSession?.id ? " selected" : ""
                    }`}
                  >
                    {editingCampaignId === session.id ? (
                      <form
                        className="tree-name-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void finishCampaignRename(session.id);
                        }}
                      >
                        <ChevronDown aria-hidden="true" />
                        <input
                          aria-label="Campaign name"
                          autoFocus
                          onBlur={() => void finishCampaignRename(session.id)}
                          onChange={(event) =>
                            setCampaignNameDraft(event.currentTarget.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              setEditingCampaignId(null);
                              setCampaignNameDraft("");
                            }
                          }}
                          value={campaignNameDraft}
                        />
                      </form>
                    ) : (
                      <button
                        onClick={() => void appStore.selectSession(session.id)}
                        onDoubleClick={() => startCampaignRename(session)}
                        type="button"
                      >
                        <ChevronDown aria-hidden="true" />
                        <BookOpen aria-hidden="true" />
                        <span>{session.name}</span>
                      </button>
                    )}
                    <div className="tree-menu">
                      <button
                        aria-expanded={openMenuId === session.id}
                        aria-label={`Options for ${session.name}`}
                        onClick={() =>
                          setOpenMenuId((currentId) =>
                            currentId === session.id ? null : session.id,
                          )
                        }
                        title="Campaign options"
                        type="button"
                      >
                        <MoreHorizontal aria-hidden="true" />
                      </button>
                      {openMenuId === session.id ? (
                        <div className="tree-menu-popover" role="menu">
                          <button
                            onClick={() => {
                              void appStore
                                .selectSession(session.id)
                                .then(() => appStore.createFolder());
                              setOpenMenuId(null);
                            }}
                            role="menuitem"
                            type="button"
                          >
                            Add folder
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete "${session.name}"?`)) {
                                void appStore.deleteSession(session.id);
                              }
                              setOpenMenuId(null);
                            }}
                            role="menuitem"
                            type="button"
                          >
                            <Trash2 aria-hidden="true" />
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {session.id === activeSession?.id ? (
                    <div className="tree-children">
                      {campaignDocuments
                        .filter(
                          (document) =>
                            !document.parentId &&
                            document.id !== activeSession.documentId,
                        )
                        .map((document) =>
                          document.kind === "folder"
                            ? renderFolder(document)
                            : renderDocument(document),
                        )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="editor-area" aria-label="Main editor">
          {route === "templates" ? (
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
          {isRightPanelOpen ? (
            <PanelRightClose aria-hidden="true" />
          ) : (
            <PanelRightOpen aria-hidden="true" />
          )}
        </button>

        {isRightPanelOpen ? (
          <aside className="right-panel" aria-label="Session tools">
            <CombatPanel />

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
