import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  FolderOpen,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Upload,
} from "lucide-react";
import type { Application } from "../../../app/composition/application";
import type { PluginManifest } from "../../../plugins/pluginTypes";
import { SCRIPT_PLUGIN_TRUST_WARNING } from "../../../plugins/scriptPluginSecurity";
import { appStore, useAppStore } from "../../../state/appStore";
import {
  createPluginTypeText,
  isCharacterSheetTemplateManifest,
  type PluginPackageInstallResult,
} from "./pluginSettingsModel";
import { SettingsHeader, SettingsNavigation } from "./SettingsModalParts";

type SettingsModalProps = { application: Application; onClose: () => void };
export function SettingsModal(props: SettingsModalProps) {
  const { application, onClose } = props;
  const { persistenceError, persistenceMessage, pluginStatuses } =
    useAppStore();
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [updatingPluginId, setUpdatingPluginId] = useState<string | null>(null);
  async function installPluginFromPackage() {
    setIsInstalling(true);
    setInstallError(null);

    try {
      const filePath = await open({
        title: "Install Soloist plugin package",
        multiple: false,
        filters: [
          {
            name: "Soloist Plugin Package",
            extensions: ["soloist-plugin"],
          },
        ],
      });

      if (!filePath || Array.isArray(filePath)) {
        return;
      }

      const result = await invoke<PluginPackageInstallResult>(
        "install_plugin_package",
        {
          filePath,
        },
      );
      const manifest = JSON.parse(result.manifestText) as PluginManifest;
      const isTemplatePlugin = isCharacterSheetTemplateManifest(manifest);
      await appStore.installPluginManifest(application, manifest, {
        disableAfterInstall: !isTemplatePlugin,
        enableAfterInstall: isTemplatePlugin,
      });
    } catch (error) {
      setInstallError(
        error instanceof Error
          ? error.message
          : "Plugin package could not be installed.",
      );
    } finally {
      setIsInstalling(false);
    }
  }

  async function openPluginFolder() {
    setInstallError(null);

    try {
      await invoke<string>("open_plugin_directory");
    } catch (error) {
      setInstallError(
        error instanceof Error
          ? error.message
          : "Plugin directory could not be opened.",
      );
    }
  }

  async function setPluginEnabled(
    pluginId: string,
    pluginName: string,
    pluginType: "data" | "script",
    enabled: boolean,
  ) {
    if (
      enabled &&
      pluginType === "script" &&
      !window.confirm(
        `Enable script plugin "${pluginName}"?\n\n${SCRIPT_PLUGIN_TRUST_WARNING}`,
      )
    ) {
      return;
    }

    setUpdatingPluginId(pluginId);
    setInstallError(null);

    try {
      await appStore.setPluginEnabled(application, pluginId, enabled);
    } catch (error) {
      setInstallError(
        error instanceof Error
          ? error.message
          : "Plugin setting could not be updated.",
      );
    } finally {
      setUpdatingPluginId(null);
    }
  }

  async function reinstallPluginTemplates(pluginId: string) {
    setUpdatingPluginId(pluginId);
    setInstallError(null);

    try {
      await appStore.reinstallPluginTemplates(application, pluginId);
    } catch (error) {
      setInstallError(
        error instanceof Error
          ? error.message
          : "Plugin templates could not be reinstalled.",
      );
    } finally {
      setUpdatingPluginId(null);
    }
  }

  async function uninstallPlugin(pluginId: string, pluginName: string) {
    if (!window.confirm(`Uninstall plugin "${pluginName}"?`)) {
      return;
    }

    setUpdatingPluginId(pluginId);
    setInstallError(null);

    try {
      await appStore.uninstallPlugin(application, pluginId);
    } catch (error) {
      setInstallError(
        error instanceof Error
          ? error.message
          : "Plugin could not be uninstalled.",
      );
    } finally {
      setUpdatingPluginId(null);
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
        <SettingsNavigation />

        <section className="settings-modal-content">
          <SettingsHeader onClose={onClose} />

          <div className="settings-panel">
            <div className="settings-panel-heading">
              <div>
                <h4>Installed Plugins</h4>
                <p>Install a Soloist plugin package.</p>
              </div>
              <div className="settings-panel-actions">
                <button
                  disabled={isInstalling}
                  onClick={() => void installPluginFromPackage()}
                  type="button"
                >
                  <Upload aria-hidden="true" />
                  Install Plugin
                </button>
                <button onClick={() => void openPluginFolder()} type="button">
                  <FolderOpen aria-hidden="true" />
                  Open Folder
                </button>
              </div>
            </div>

            {pluginStatuses.length === 0 ? (
              <p className="settings-empty">No plugins installed.</p>
            ) : (
              <div className="plugin-settings-list">
                {pluginStatuses.map((plugin) => (
                  <article
                    className="plugin-settings-item"
                    key={plugin.pluginId}
                  >
                    <div>
                      <h4>{plugin.name}</h4>
                      <p>
                        {plugin.pluginId} · v{plugin.version}
                      </p>
                      <p>{createPluginTypeText(plugin)}</p>
                      {plugin.pluginType === "script" ? (
                        <>
                          <p className="settings-warning">
                            Trusted code: has ambient network, browser storage,
                            script-loading, and worker access.
                          </p>
                          <p>
                            Soloist API permissions:{" "}
                            {plugin.permissions.length > 0
                              ? plugin.permissions.join(", ")
                              : "none"}
                          </p>
                        </>
                      ) : null}
                    </div>
                    <div className="plugin-settings-controls">
                      <span className={`plugin-status-badge ${plugin.status}`}>
                        {plugin.status}
                      </span>
                      {plugin.isCharacterSheetTemplatePlugin ? (
                        <button
                          disabled={updatingPluginId === plugin.pluginId}
                          onClick={() =>
                            void reinstallPluginTemplates(plugin.pluginId)
                          }
                          title="Add fresh copies of this plugin's templates"
                          type="button"
                        >
                          <RefreshCw aria-hidden="true" />
                          Reinstall
                        </button>
                      ) : (
                        <button
                          aria-pressed={plugin.enabled}
                          disabled={updatingPluginId === plugin.pluginId}
                          onClick={() =>
                            void setPluginEnabled(
                              plugin.pluginId,
                              plugin.name,
                              plugin.pluginType,
                              !plugin.enabled,
                            )
                          }
                          title={
                            plugin.enabled ? "Disable plugin" : "Enable plugin"
                          }
                          type="button"
                        >
                          {plugin.enabled ? (
                            <ToggleRight aria-hidden="true" />
                          ) : (
                            <ToggleLeft aria-hidden="true" />
                          )}
                          {plugin.enabled ? "Enabled" : "Disabled"}
                        </button>
                      )}
                      <button
                        disabled={updatingPluginId === plugin.pluginId}
                        onClick={() =>
                          void uninstallPlugin(plugin.pluginId, plugin.name)
                        }
                        title="Uninstall plugin"
                        type="button"
                      >
                        <Trash2 aria-hidden="true" />
                        Uninstall
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {persistenceMessage ? (
              <p className="settings-status">{persistenceMessage}</p>
            ) : null}
            {installError || persistenceError ? (
              <p className="settings-error">
                {installError ?? persistenceError}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
