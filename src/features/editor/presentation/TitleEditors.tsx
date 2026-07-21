import { useEffect, useState } from "react";

export function EditableTitle({
  ariaLabel,
  onSaveTitle,
  title,
}: {
  ariaLabel: string;
  onSaveTitle: (title: string) => Promise<unknown>;
  title: string;
}) {
  const [draftTitle, setDraftTitle] = useState(title);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  async function saveTitle() {
    const nextTitle = draftTitle.trim() || "Untitled";

    setDraftTitle(nextTitle);

    if (nextTitle !== title) {
      await onSaveTitle(nextTitle);
    }
  }

  return (
    <input
      aria-label={ariaLabel}
      className="document-title-input"
      onBlur={() => void saveTitle()}
      onChange={(event) => setDraftTitle(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      type="text"
      value={draftTitle}
    />
  );
}

export function TitleOnlyEditor({
  eyebrow,
  onSaveTitle,
  title,
}: {
  eyebrow: string;
  onSaveTitle: (title: string) => Promise<unknown>;
  title: string;
}) {
  return (
    <article className="editor-frame">
      <header className="document-heading">
        <p>{eyebrow}</p>
        <EditableTitle
          ariaLabel="Document title"
          onSaveTitle={onSaveTitle}
          title={title}
        />
      </header>
      <p className="editor-title-only-note">
        Create or select a document to edit markdown content.
      </p>
    </article>
  );
}
