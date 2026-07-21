import { Plug, X } from "lucide-react";

export function SettingsNavigation() {
  return (
    <aside className="settings-modal-nav" aria-label="Settings sections">
      <div>
        <h2>Settings</h2>
        <button className="active" type="button">
          <Plug aria-hidden="true" />
          Plugins
        </button>
      </div>
    </aside>
  );
}

export function SettingsHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="settings-modal-header">
      <div>
        <p>Plugin Settings</p>
        <h3>Plugins</h3>
      </div>
      <button
        aria-label="Close settings"
        onClick={onClose}
        title="Close settings"
        type="button"
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
