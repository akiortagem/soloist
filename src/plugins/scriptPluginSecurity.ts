export const SCRIPT_PLUGIN_TRUST_WARNING =
  "Script plugins are trusted local code, not sandboxed extensions. They can use " +
  "network APIs (fetch, WebSocket, and EventSource), browser storage (IndexedDB " +
  "and caches/Cache Storage), load scripts (importScripts), and create Worker " +
  "instances without declaring a " +
  "Soloist permission. Only enable this plugin if you trust its source and author.";

/** Ambient Worker capabilities audited as part of the trusted-code policy. */
export const SCRIPT_PLUGIN_AMBIENT_CAPABILITIES = [
  "fetch",
  "WebSocket",
  "EventSource",
  "importScripts",
  "indexedDB",
  "caches",
  "Worker",
] as const;
