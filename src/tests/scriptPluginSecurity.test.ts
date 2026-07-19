import { describe, expect, it } from "vitest";
import { SCRIPT_PLUGIN_WORKER_SOURCE } from "../plugins/scriptPluginRuntime";
import {
  SCRIPT_PLUGIN_AMBIENT_CAPABILITIES,
  SCRIPT_PLUGIN_TRUST_WARNING,
} from "../plugins/scriptPluginSecurity";
import { SCRIPT_PLUGIN_PERMISSIONS } from "../plugins/pluginTypes";

describe("trusted script plugin security policy", () => {
  it("warns about every audited ambient network and storage capability", () => {
    expect(SCRIPT_PLUGIN_TRUST_WARNING).toContain("not sandboxed");
    expect(SCRIPT_PLUGIN_TRUST_WARNING).toContain("Only enable");

    for (const capability of SCRIPT_PLUGIN_AMBIENT_CAPABILITIES) {
      const displayName = capability === "indexedDB" ? "IndexedDB" : capability;
      expect(SCRIPT_PLUGIN_TRUST_WARNING).toContain(displayName);
    }
  });

  it("does not misrepresent ambient browser globals as manifest permissions", () => {
    expect(SCRIPT_PLUGIN_PERMISSIONS).not.toContain("fetch");
    expect(SCRIPT_PLUGIN_PERMISSIONS).not.toContain("indexedDB");
    expect(SCRIPT_PLUGIN_PERMISSIONS).not.toContain("caches");
    expect(SCRIPT_PLUGIN_PERMISSIONS).not.toContain("Worker");
  });

  it("does not shadow audited globals in the trusted worker runtime", () => {
    for (const capability of SCRIPT_PLUGIN_AMBIENT_CAPABILITIES) {
      expect(SCRIPT_PLUGIN_WORKER_SOURCE).not.toMatch(
        new RegExp(`(?:const|let|var)\\s+${capability}\\s*=`),
      );
      expect(SCRIPT_PLUGIN_WORKER_SOURCE).not.toContain(`"${capability}",`);
    }

    expect(SCRIPT_PLUGIN_WORKER_SOURCE).toContain("new Function(");
  });
});
