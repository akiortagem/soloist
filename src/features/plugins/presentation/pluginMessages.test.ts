import { describe, expect, it } from "vitest";
import { PluginApplicationError } from "../application/PluginApplicationError";
import { pluginErrorText, pluginFailureMessage } from "./pluginMessages";

describe("plugin presentation messages", () => {
  it("distinguishes committed refresh failures from failed mutations", () => {
    const refreshFailure = new PluginApplicationError(
      "install_failed",
      new Error("runtime unavailable"),
      ["plugin-id"],
      "refresh",
      true,
    );

    expect(pluginErrorText(refreshFailure)).toBe("runtime unavailable");
    expect(
      pluginFailureMessage(
        refreshFailure,
        "Plugin install",
        "Plugin install failed.",
      ),
    ).toBe("Plugin install succeeded, but plugin refresh failed.");
  });

  it("keeps failure copy for an uncommitted mutation", () => {
    const persistenceFailure = new PluginApplicationError(
      "install_failed",
      new Error("database unavailable"),
    );

    expect(
      pluginFailureMessage(
        persistenceFailure,
        "Plugin install",
        "Plugin install failed.",
      ),
    ).toBe("Plugin install failed.");
  });
});
