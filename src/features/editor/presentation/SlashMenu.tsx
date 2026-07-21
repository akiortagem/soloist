import type { SlashCommandDefinition } from "../../commands";
import type { SlashMenuState } from "./slashMenu";

export function SlashMenu({
  menu,
  options,
  selectedIndex,
  select,
}: {
  menu: SlashMenuState;
  options: SlashCommandDefinition[];
  selectedIndex: number;
  select: (commandText: string) => void;
}) {
  return (
    <div
      aria-label="Slash command menu"
      className="slash-menu"
      role="menu"
      style={{ left: menu.left, top: menu.top }}
    >
      {options.length > 0 ? (
        options.map((option, index) => (
          <button
            key={option.id}
            aria-selected={index === selectedIndex}
            className={index === selectedIndex ? "is-selected" : undefined}
            onMouseDown={(event) => {
              event.preventDefault();
              select(option.commandText ?? option.prefix);
            }}
            role="menuitem"
            type="button"
          >
            <span>{option.label}</span>
            <code>{option.prefix}</code>
          </button>
        ))
      ) : (
        <p className="slash-menu-empty">No commands found</p>
      )}
    </div>
  );
}
