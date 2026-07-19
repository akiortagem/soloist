import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { KeyboardEvent } from "react";
import type { SceneContainerPayload } from "../../domain/domainTypes";
import { confirmSceneDescription } from "../../scene/sceneContainerLogic";
import { appStore } from "../../state/appStore";

function scenePayload(value: unknown): SceneContainerPayload {
  const payload =
    value && typeof value === "object" ? (value as Partial<SceneContainerPayload>) : {};

  return {
    id: String(payload.id ?? `scene_${Date.now().toString(36)}`),
    description: String(payload.description ?? ""),
    descriptionLocked: payload.descriptionLocked === true,
    oracleResult: payload.oracleResult,
    oracleError:
      typeof payload.oracleError === "string" ? payload.oracleError : undefined,
    collapsed: payload.collapsed === true,
  };
}

export function SceneContainerView({
  node,
  editor,
  getPos,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const payload = scenePayload(node.attrs.payload);

  function updatePayload(patch: Partial<SceneContainerPayload>) {
    updateAttributes({
      payload: {
        ...payload,
        ...patch,
      },
    });
  }

  function focusSceneContent() {
    window.requestAnimationFrame(() => {
      const pos = typeof getPos === "function" ? getPos() : undefined;
      if (typeof pos === "number") {
        editor.commands.focus(pos + 1);
      } else {
        editor.commands.focus();
      }
    });
  }

  async function confirmDescription() {
    const session = appStore.getSnapshot().activeSession;
    const nextPayload = await confirmSceneDescription(payload, session?.chaosFactor);

    if (nextPayload === payload) {
      return;
    }

    updateAttributes({ payload: nextPayload });
    focusSceneContent();
  }

  function handleDescriptionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void confirmDescription();
  }

  return (
    <NodeViewWrapper
      as="section"
      className={`scene-container${selected ? " is-selected" : ""}`}
      data-scene-container-id={payload.id}
    >
      <header className="scene-container-tab-row" contentEditable={false}>
        <span className="scene-container-tab">Scene</span>
        <button
          aria-label="Delete scene"
          title="Delete scene"
          className="scene-container-action"
          onClick={deleteNode}
          type="button"
        >
          ×
        </button>
      </header>

      <div className="scene-container-heading" contentEditable={false}>
        {payload.descriptionLocked ? (
          <h2>{payload.description || "Untitled scene"}</h2>
        ) : (
          <textarea
            aria-label="Scene description"
            autoFocus
            onChange={(event) =>
              updatePayload({ description: event.currentTarget.value })
            }
            onKeyDown={handleDescriptionKeyDown}
            placeholder="Scene description"
            rows={1}
            value={payload.description}
          />
        )}
      </div>

      {(payload.oracleResult || payload.oracleError) && (
        <aside className="scene-oracle-box" contentEditable={false}>
          {payload.oracleError ? (
            <p className="scene-oracle-error">Warning: {payload.oracleError}</p>
          ) : payload.oracleResult ? (
            <>
              <button
                className="scene-oracle-collapse"
                onClick={() => updatePayload({ collapsed: !payload.collapsed })}
                type="button"
              >
                {payload.collapsed ? "Expand" : "Collapse"}
              </button>
              {payload.collapsed ? (
                <p>Scene setup: {payload.oracleResult.adjustmentType}</p>
              ) : (
                <dl>
                  <div>
                    <dt>Current Chaos Factor</dt>
                    <dd>{payload.oracleResult.chaosFactor}</dd>
                  </div>
                  <div>
                    <dt>Oracle rolled</dt>
                    <dd>{payload.oracleResult.roll}</dd>
                  </div>
                  <div>
                    <dt>Result</dt>
                    <dd>
                      {payload.oracleResult.adjustmentType}.{" "}
                      {payload.oracleResult.explanation}
                    </dd>
                  </div>
                </dl>
              )}
              <p className="scene-oracle-provider">
                Provider: {payload.oracleResult.providerName}
              </p>
            </>
          ) : null}
        </aside>
      )}

      <NodeViewContent className="scene-container-content" />
    </NodeViewWrapper>
  );
}
