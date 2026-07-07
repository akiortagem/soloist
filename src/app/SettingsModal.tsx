import { useRef, useState } from "react";
import { Plug, Upload, X } from "lucide-react";
import { appStore, useAppStore } from "../state/appStore";
import type { PluginManifest } from "../plugins/pluginTypes";

type SettingsSection = "plugins";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { persistenceError, persistenceMessage, pluginStatuses } = useAppStore();
  const [activeSection, setActiveSection] = useState<SettingsSection>("plugins");
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function installPluginFromFile(file: File) {
    setIsInstalling(true);
    setInstallError(null);

    try {
      const manifest = JSON.parse(await file.text()) as PluginManifest;
      await appStore.installPluginManifest(manifest);
    } catch (error) {
      setInstallError(
        error instanceof Error ? error.message : "Plugin manifest could not be read.",
      );
    } finally {
      setIsInstalling(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div
      aria-label="Settings"
      aria-modal="true"
      className="settings-modal-backdrop"
      role="dialog"
    >
      <div className="settings-modal">
        <aside className="settings-modal-nav" aria-label="Settings sections">
          <div>
            <h2>Settings</h2>
            <button
              className={activeSection === "plugins" ? "active" : ""}
              onClick={() => setActiveSection("plugins")}
              type="button"
            >
              <Plug aria-hidden="true" />
              Plugins
            </button>
          </div>
        </aside>

        <section className="settings-modal-content">
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

          <div className="settings-panel">
            <div className="settings-panel-heading">
              <div>
                <h4>Installed Plugins</h4>
                <p>Install a plugin manifest JSON file.</p>
              </div>
              <button
                disabled={isInstalling}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <Upload aria-hidden="true" />
                Install Plugin
              </button>
              <input
                accept="application/json,.json"
                aria-label="Plugin manifest file"
                hidden
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];

                  if (file) {
                    void installPluginFromFile(file);
                  }
                }}
                ref={fileInputRef}
                type="file"
              />
            </div>

            {pluginStatuses.length === 0 ? (
              <p className="settings-empty">No plugins installed.</p>
            ) : (
              <div className="plugin-settings-list">
                {pluginStatuses.map((plugin) => (
                  <article className="plugin-settings-item" key={plugin.pluginId}>
                    <div>
                      <h4>{plugin.name}</h4>
                      <p>
                        {plugin.pluginId} · v{plugin.version}
                      </p>
                    </div>
                    <span className={`plugin-status-badge ${plugin.status}`}>
                      {plugin.status}
                    </span>
                  </article>
                ))}
              </div>
            )}

            {persistenceMessage ? (
              <p className="settings-status">{persistenceMessage}</p>
            ) : null}
            {installError || persistenceError ? (
              <p className="settings-error">{installError ?? persistenceError}</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
