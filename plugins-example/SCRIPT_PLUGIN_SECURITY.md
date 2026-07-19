# Script plugin security

## Supported model: trusted local code

Soloist script plugins are trusted local code. They run in a Web Worker to keep
plugin execution separate from the React UI thread, not to provide a security
sandbox. Install script plugins only from authors whose code you trust. Packages
are installed disabled, and Soloist shows the effective-capability warning before
enabling one.
When this trust model was introduced, the database migration disabled previously
enabled script plugins so they also require this explicit trust decision.

Data plugins are the appropriate format for untrusted declarative content because
they do not execute JavaScript.

## Trust boundary

The `permissions` manifest field controls calls through `SoloistPluginApi`, such
as plugin-local Soloist storage, slash-command registration, selected document
text, and result-block insertion. Both the worker API and the host validate those
permissions. The field does **not** restrict standard globals supplied by the
WebView's Worker environment and must not be used as a security review checklist.

Once enabled, script code is trusted up to the Worker/browser boundary. It cannot
directly access the React DOM, React state, or main-thread JavaScript objects, but
it can communicate externally and persist data using ambient browser APIs.

## Audited ambient globals

The current Worker runtime intentionally does not remove or mediate these globals:

| Capability | Worker global | Manifest permission required |
| --- | --- | --- |
| HTTP/network requests | `fetch` | No |
| Bidirectional sockets | `WebSocket` | No |
| Server-sent events | `EventSource` | No |
| Load additional classic scripts | `importScripts` | No |
| Browser database storage | `indexedDB` | No |
| Cache Storage | `caches` | No |
| Spawn more workers | `Worker` | No |

Availability can vary with the operating-system WebView and its origin/security
policy. Other ordinary Worker globals—timers, cryptography, URL/blob APIs,
messaging, and worker metadata—may also be present. The table is an audit of the
high-impact capabilities, not an allowlist.

## Remaining limitations

- A malicious enabled plugin can send plugin inputs or data it obtains to the
  network, store data outside Soloist's plugin storage, load more code, or consume
  CPU and storage resources.
- Soloist host permissions reduce accidental or unauthorized use of application
  APIs, but they do not make hostile JavaScript safe.
- Worker separation limits direct UI access and lets Soloist terminate the primary
  plugin worker; it does not contain workers spawned by plugin code or revoke data
  already transmitted or persisted.
- Updating a trusted package changes the code being trusted. Review its source and
  provenance again before enabling the updated version.
