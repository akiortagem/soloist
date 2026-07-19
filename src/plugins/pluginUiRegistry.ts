import type { PluginNotification, PluginStatus } from "./pluginApi";

export type HostPluginNotification = PluginNotification & {
  pluginId: string;
  id: number;
};

export type HostPluginStatus = PluginStatus & {
  pluginId: string;
  id: string;
  contributionId: string;
};

export class PluginUiRegistry {
  private readonly notifications: HostPluginNotification[] = [];
  private readonly statuses = new Map<string, HostPluginStatus>();
  private readonly listeners = new Set<() => void>();
  private nextNotificationId = 1;

  notify(pluginId: string, notification: PluginNotification): HostPluginNotification {
    const item = { ...notification, pluginId, id: this.nextNotificationId++ };
    this.notifications.push(item);
    this.emit();
    return { ...item };
  }

  listNotifications(): HostPluginNotification[] {
    return this.notifications.map((item) => ({ ...item }));
  }

  dismissNotification(id: number): void {
    const index = this.notifications.findIndex((item) => item.id === id);
    if (index >= 0) {
      this.notifications.splice(index, 1);
      this.emit();
    }
  }

  setStatus(pluginId: string, status: PluginStatus): HostPluginStatus {
    const id = namespacePluginId(pluginId, status.id);
    const item = { ...status, pluginId, contributionId: status.id, id };
    this.statuses.set(id, item);
    this.emit();
    return { ...item };
  }

  clearStatus(pluginId: string, statusId: string): void {
    if (this.statuses.delete(namespacePluginId(pluginId, statusId))) this.emit();
  }

  listStatuses(): HostPluginStatus[] {
    return Array.from(this.statuses.values(), (item) => ({ ...item }));
  }

  unregisterPlugin(pluginId: string): void {
    let changed = false;
    for (const [id, status] of this.statuses) {
      if (status.pluginId === pluginId) {
        this.statuses.delete(id);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const pluginUiRegistry = new PluginUiRegistry();

function namespacePluginId(pluginId: string, contributionId: string): string {
  return `${pluginId}:${contributionId}`;
}
