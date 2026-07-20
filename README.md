# Soloist

Soloist is a local-first solo TRPG markdown writing app built with React, Vite, Tauri, and SQLite.

## Architecture and contribution standards

- [Architecture and directory guide](docs/architecture/README.md)
- [Engineering practices](docs/architecture/engineering-practices.md)
- [Clean Architecture refactor plan](docs/architecture/refactor-plan.md)

New code should follow these standards. Existing code is being migrated one
vertical feature slice at a time according to the refactor plan.

## Development

Install dependencies:

```sh
npm ci
```

Run the desktop app in development mode:

```sh
npm run tauri:dev
```

This starts Vite on `http://localhost:1420` for the Tauri dev shell. The production app does not require a server.

## Portable Builds

Build the portable desktop executable:

```sh
npm run tauri:build
```

This runs `tauri build --no-bundle --ci`, embeds the compiled frontend from `dist`, and skips installer packaging. The output executable is:

- Windows: `src-tauri/target/release/soloist.exe`
- Linux: `src-tauri/target/release/soloist`

Run the executable directly from any folder. On Windows, the portable executable uses the system WebView2 runtime; install WebView2 separately only if the target machine does not already have it.

An installer build is still available for release experiments:

```sh
npm run tauri:bundle
```

The installer is optional. The primary distributable is the portable executable.

## Local Data

Soloist stores its SQLite database as `soloist.db` in Tauri's app config directory for the app identifier `com.soloist.app`:

- Windows: `%APPDATA%\com.soloist.app\soloist.db`
- Linux: `${XDG_CONFIG_HOME:-~/.config}/com.soloist.app/soloist.db`
- macOS: `~/Library/Application Support/com.soloist.app/soloist.db`

The database is not stored next to the executable, so moving or replacing the portable executable does not reset local data.

## Reset Local Data

Close Soloist, then remove the app config directory:

```powershell
Remove-Item -Recurse -Force "$env:APPDATA\com.soloist.app"
```

```sh
rm -rf "${XDG_CONFIG_HOME:-$HOME/.config}/com.soloist.app"
```

The app recreates `soloist.db` and runs migrations the next time it starts.
