import { type CSSProperties, useEffect, useRef, useState } from "react";
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
  Settings,
  Trash2,
  UserRound,
} from "lucide-react";
import { SettingsModal } from "../features/plugins/presentation/SettingsModal";
import { PluginFeedback } from "./PluginFeedback";
import type { Application } from "./composition/application";
import { CharacterSheetTemplatePanel } from "../characterSheets/CharacterSheetTemplatePanel";
import type { Document } from "../domain/domainTypes";
import { CombatPanel } from "../combat/CombatPanel";
import { Editor } from "../editor/Editor";
import {
  getActiveOracleProvider,
  getOracleProvider,
} from "../oracle/oracleRegistry";
import { appStore, useAppStore } from "../state/appStore";
import { createSession } from "../state/appStore/campaignActions";

const navigationRoutes = [{ key: "templates", label: "Templates" }] as const;

const LEFT_PANEL_MIN_WIDTH = 240;
const LEFT_PANEL_MAX_WIDTH = LEFT_PANEL_MIN_WIDTH * 2;
const RIGHT_PANEL_MIN_WIDTH = 300;
const RIGHT_PANEL_MAX_WIDTH = RIGHT_PANEL_MIN_WIDTH * 2;
const PANEL_RESIZE_STEP = 24;

function clampWidth(width: number, minWidth: number, maxWidth: number) {
  return Math.min(maxWidth, Math.max(minWidth, width));
}

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

export function App({ application }: { application: Application }) {
  const {
    activeDocument,
    activeOracleProviderId,
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
  const activeOracleProvider =
    getOracleProvider(activeOracleProviderId) ?? getActiveOracleProvider();
  const [leftPanelWidth, setLeftPanelWidth] = useState(LEFT_PANEL_MIN_WIDTH);
  const [isResizingLeftPanel, setIsResizingLeftPanel] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(RIGHT_PANEL_MIN_WIDTH);
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campaignNameDraft, setCampaignNameDraft] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const closeSettings = () => setIsSettingsOpen(false);
  const stopLeftPanelResizeRef = useRef<(() => void) | null>(null);
  const stopRightPanelResizeRef = useRef<(() => void) | null>(null);
  const [collapsedCampaignIds, setCollapsedCampaignIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    void appStore.loadSessions(application);
  }, [application]);

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

  useEffect(() => {
    return () => {
      stopLeftPanelResizeRef.current?.();
      stopRightPanelResizeRef.current?.();
    };
  }, []);

  function startLeftPanelResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = leftPanelWidth;

    stopLeftPanelResizeRef.current?.();
    setIsResizingLeftPanel(true);

    function handlePointerMove(pointerEvent: PointerEvent) {
      setLeftPanelWidth(
        clampWidth(
          startWidth + pointerEvent.clientX - startX,
          LEFT_PANEL_MIN_WIDTH,
          LEFT_PANEL_MAX_WIDTH,
        ),
      );
    }

    function stopLeftPanelResize() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopLeftPanelResize);
      window.removeEventListener("pointercancel", stopLeftPanelResize);
      stopLeftPanelResizeRef.current = null;
      setIsResizingLeftPanel(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopLeftPanelResize);
    window.addEventListener("pointercancel", stopLeftPanelResize);
    stopLeftPanelResizeRef.current = stopLeftPanelResize;
  }

  function startRightPanelResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = rightPanelWidth;

    stopRightPanelResizeRef.current?.();
    setIsResizingRightPanel(true);

    function handlePointerMove(pointerEvent: PointerEvent) {
      setRightPanelWidth(
        clampWidth(
          startWidth + startX - pointerEvent.clientX,
          RIGHT_PANEL_MIN_WIDTH,
          RIGHT_PANEL_MAX_WIDTH,
        ),
      );
    }

    function stopRightPanelResize() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopRightPanelResize);
      window.removeEventListener("pointercancel", stopRightPanelResize);
      stopRightPanelResizeRef.current = null;
      setIsResizingRightPanel(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopRightPanelResize);
    window.addEventListener("pointercancel", stopRightPanelResize);
    stopRightPanelResizeRef.current = stopRightPanelResize;
  }

  function nudgeLeftPanelWidth(delta: number) {
    setLeftPanelWidth((currentWidth) =>
      clampWidth(currentWidth + delta, LEFT_PANEL_MIN_WIDTH, LEFT_PANEL_MAX_WIDTH),
    );
  }

  function nudgeRightPanelWidth(delta: number) {
    setRightPanelWidth((currentWidth) =>
      clampWidth(
        currentWidth + delta,
        RIGHT_PANEL_MIN_WIDTH,
        RIGHT_PANEL_MAX_WIDTH,
      ),
    );
  }

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

  function toggleCampaign(sessionId: string) {
    setCollapsedCampaignIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(sessionId)) {
        nextIds.delete(sessionId);
      } else {
        nextIds.add(sessionId);
      }

      return nextIds;
    });
  }

  function expandCampaign(sessionId: string) {
    setCollapsedCampaignIds((currentIds) => {
      if (!currentIds.has(sessionId)) {
        return currentIds;
      }

      const nextIds = new Set(currentIds);
      nextIds.delete(sessionId);
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
      <PluginFeedback />
      <div
        className={`workspace${isRightPanelOpen ? " tools-open" : ""}${
          isResizingRightPanel ? " is-resizing-right-panel" : ""
        }${isResizingLeftPanel ? " is-resizing-left-panel" : ""}`}
        style={
          {
            "--left-panel-width": `${leftPanelWidth}px`,
            "--right-panel-width": `${rightPanelWidth}px`,
          } as CSSProperties
        }
      >
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
                  const createdSession = await createSession(application, "Untitled");
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

              {sessions.map((session) => {
                const isActiveCampaign = session.id === activeSession?.id;
                const isCampaignCollapsed = collapsedCampaignIds.has(session.id);

                return (
                  <div className="tree-campaign" key={session.id}>
                    <div
                      className={`tree-row campaign-row${
                        isActiveCampaign ? " selected" : ""
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
                          {isCampaignCollapsed ? (
                            <ChevronRight aria-hidden="true" />
                          ) : (
                            <ChevronDown aria-hidden="true" />
                          )}
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
                          aria-expanded={isActiveCampaign && !isCampaignCollapsed}
                          onClick={() => {
                            if (isActiveCampaign) {
                              toggleCampaign(session.id);
                              void appStore.selectSession(session.id);
                              return;
                            }

                            expandCampaign(session.id);
                            void appStore.selectSession(session.id);
                          }}
                          onDoubleClick={() => startCampaignRename(session)}
                          type="button"
                        >
                          {isCampaignCollapsed ? (
                            <ChevronRight aria-hidden="true" />
                          ) : (
                            <ChevronDown aria-hidden="true" />
                          )}
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

                    {isActiveCampaign && !isCampaignCollapsed ? (
                      <div className="tree-children">
                        {campaignDocuments
                          .filter(
                            (document) =>
                              !document.parentId &&
                              document.id !== session.documentId,
                          )
                          .map((document) =>
                            document.kind === "folder"
                              ? renderFolder(document)
                              : renderDocument(document),
                          )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="left-sidebar-footer">
            <button
              aria-label="Open settings"
              onClick={() => setIsSettingsOpen(true)}
              title="Settings"
              type="button"
            >
              <Settings aria-hidden="true" />
            </button>
          </div>
        </aside>

        <div
          aria-label="Resize navigation panel"
          aria-orientation="vertical"
          aria-valuemax={LEFT_PANEL_MAX_WIDTH}
          aria-valuemin={LEFT_PANEL_MIN_WIDTH}
          aria-valuenow={leftPanelWidth}
          className="left-panel-resizer"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              nudgeLeftPanelWidth(PANEL_RESIZE_STEP);
            }

            if (event.key === "ArrowLeft") {
              event.preventDefault();
              nudgeLeftPanelWidth(-PANEL_RESIZE_STEP);
            }

            if (event.key === "Home") {
              event.preventDefault();
              setLeftPanelWidth(LEFT_PANEL_MIN_WIDTH);
            }

            if (event.key === "End") {
              event.preventDefault();
              setLeftPanelWidth(LEFT_PANEL_MAX_WIDTH);
            }
          }}
          onPointerDown={startLeftPanelResize}
          role="separator"
          tabIndex={0}
          title="Resize navigation panel"
        />

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
          <>
            <div
              aria-label="Resize tools panel"
              aria-orientation="vertical"
              aria-valuemax={RIGHT_PANEL_MAX_WIDTH}
              aria-valuemin={RIGHT_PANEL_MIN_WIDTH}
              aria-valuenow={rightPanelWidth}
              className="right-panel-resizer"
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  nudgeRightPanelWidth(PANEL_RESIZE_STEP);
                }

                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  nudgeRightPanelWidth(-PANEL_RESIZE_STEP);
                }

                if (event.key === "Home") {
                  event.preventDefault();
                  setRightPanelWidth(RIGHT_PANEL_MIN_WIDTH);
                }

                if (event.key === "End") {
                  event.preventDefault();
                  setRightPanelWidth(RIGHT_PANEL_MAX_WIDTH);
                }
              }}
              onPointerDown={startRightPanelResize}
              role="separator"
              tabIndex={0}
              title="Resize tools panel"
            />
            <aside className="right-panel" aria-label="Session tools">
              <CombatPanel />

              <section>
                <h2>Oracle Settings</h2>
                <dl>
                  <div>
                    <dt>Provider</dt>
                    <dd>{activeOracleProvider.name}</dd>
                  </div>
                  <div>
                    <dt>Chaos Factor</dt>
                    <dd>{chaosFactor}</dd>
                  </div>
                </dl>
              </section>
            </aside>
          </>
        ) : null}
      </div>
      {isSettingsOpen ? (
        <SettingsModal application={application} onClose={closeSettings} />
      ) : null}
    </main>
  );
}
