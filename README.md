# Yobble

Yobble is a unfinished game publishing platform with a web UI, API server, and desktop clients (AppImage/Windows builds). The server hosts game uploads, user accounts, moderation tools, and marketplace features, while the web frontend ships from `web_src/` and is minified into `temp/web-runtime/` at startup.

## Features
- Game hosting with versioned assets and access controls
- User accounts, profiles, reviews, notifications, and chat
- Moderation, reports, appeals, and support tooling
- Marketplace, inventory, and wallet flows
- Web IDE and 3D studio integration

## Project layout
- `server/src` API server and websocket chat
- `web_src` web frontend source (served/minified at runtime)
- `temp/web-runtime` generated web runtime output
- `desktop` Electron shell for the Windows launcher
- `launcher` C++ bootstrapper that updates Electron dependencies and starts the desktop shell
- `save/uploads/games` uploaded game builds
- `save` data assets (TOS, item icons, levels)
- `Client_linux` packaged Linux client assets
- `Client_win` packaged Windows client assets
- `scripts` helper scripts (AppImage build)

## Quick start (server)
1) Install dependencies

```sh
npm --prefix server install
```

2) Start the server

```sh
npm --prefix server start
```

By default the server listens on `PORT=5050` and optionally `PORT2=3000`. If TLS certs exist at `Benno111 Chat/cert.pem` and `Benno111 Chat/key.pem`, HTTPS starts on `HTTPS_PORT=5443`.

## Configuration
Environment variables used by the server:
- `PORT` primary HTTP port (default: `5050`)
- `PORT2` secondary HTTP port (default: `3000`)
- `HTTPS_PORT` HTTPS port (default: `5443`)
- `JWT_SECRET` secret used to sign and verify auth tokens; a local development fallback is used if unset
- `GOOGLE_AI_API_KEY` *(optional)* Google AI Studio API key for Gemini 2.0 Flash AI content moderation. When set, chat messages, item uploads, and user reports are automatically screened. High-severity content is blocked outright; medium-severity content triggers an automatic moderator report. If unset, AI moderation is disabled and content passes through unchanged. Obtain a key at https://aistudio.google.com/app/apikey

## AppImage build (Linux)
The AppImage build pulls from `Client_linux/` and produces `dist/Yobble.appimage`.

```sh
scripts/build-appimage.sh 0.7.0
```

## Windows desktop launcher
The Windows launcher lives in `launcher/` and starts the Electron shell from `desktop/`.

```sh
cmake -S launcher -B launcher/build
cmake --build launcher/build --config Release
```

The launcher expects `npm` and a working Node.js toolchain on `PATH`. It looks for a `desktop/` folder next to the EXE, installs or updates the Electron desktop dependencies in that folder, and then launches the Electron shell.

Set `YOBBLE_LIVE_URL` before launching if your live platform is not `https://yobble.live`. The Electron shell opens that URL and routes in-app game launches through the same origin.

## Android build
The Android app lives in `Android src/Yobble/`.

- GitHub Actions workflow: `.github/workflows/android-build.yml`
- Debug APKs are built on every push, pull request, or manual run when Android files change
- Signed release APKs are built when these GitHub repository secrets are set:
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The workflow decodes the keystore at runtime and passes signing values into Gradle through environment variables, so no signing material needs to be committed to the repository.

## Data locations
- Uploaded games: `save/uploads/games/`
- Uploaded items/icons: `save/item_icons/`
- TOS content: `save/tos`
- Custom levels: `save/custom_levels/`

## Notes
- The server minifies `web_src/` into `temp/web-runtime/` on startup.
- A legacy entrypoint exists at `index.js` in the repo root; current server entrypoint is `server/src/index.js`.
