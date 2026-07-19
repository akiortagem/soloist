import { useEffect, useState } from "react";
import { pluginUiRegistry } from "../plugins/pluginUiRegistry";

export function PluginFeedback() {
  const [, render] = useState(0);
  useEffect(() => pluginUiRegistry.subscribe(() => render((value) => value + 1)), []);

  const notifications = pluginUiRegistry.listNotifications();
  const statuses = pluginUiRegistry.listStatuses();
  if (notifications.length === 0 && statuses.length === 0) return null;

  return (
    <aside className="plugin-feedback" aria-label="Plugin activity">
      {statuses.map((status) => (
        <div className={`plugin-feedback-item ${status.level}`} key={status.id} role="status">
          {status.message}
        </div>
      ))}
      {notifications.map((notification) => (
        <div className={`plugin-feedback-item ${notification.level}`} key={notification.id} role="alert">
          <strong>{notification.title}</strong>
          {notification.message ? <span>{notification.message}</span> : null}
          <button aria-label={`Dismiss ${notification.title}`} onClick={() => pluginUiRegistry.dismissNotification(notification.id)} type="button">×</button>
        </div>
      ))}
    </aside>
  );
}
