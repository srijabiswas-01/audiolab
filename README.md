# AudioLab

A responsive audio workspace using the requested palette: peach `#F8B2B2`, mauve `#AF719D`, purple `#8B639B`, and indigo `#403D88`.

## Run

Requires Node.js 22.13 or newer and a modern browser. Node 24 is recommended.

```sh
npm start
```

Open **http://127.0.0.1:4173**. On Windows PowerShell, use `npm.cmd start` if execution policy blocks `npm.ps1`.

For development with automatic restart, use `npm run dev` instead. Run only one server command at a time. If port 4173 is already in use, an earlier instance may still be running: open its address or stop it with **Ctrl+C** in the terminal that launched it. Alternatively, choose another port using the command below. Changing ports also changes the browser's storage origin, so existing local projects remain at the original address.

The running app has no third-party runtime dependencies. `npm install` is only needed for the optional Playwright development tests.

To change the port in PowerShell:

```powershell
$env:PORT = '4180'
npm.cmd start
```

## What works

- Responsive dashboard, project library, search, export center, settings, and administrator account approvals.
- Light and dark themes: use the sun/moon button in the top bar. Your choice persists in this browser and syncs across tabs; until you choose, the app follows your device theme.
- A themed startup splash with animated audio bars, real loading-stage messages, reduced-motion support, and recovery if application code fails to load. It dismisses when the workspace is ready without a forced wait.
- Original, synthesized 48-second demo with four independently playable layers: melody, drums, bass, and atmosphere. These are composed stems, not fabricated AI separation results.
- Email/password registration, first-administrator setup from localhost, pending-user approval, login/logout, rejected and suspended accounts, session revocation, and an approval audit log.
- Audio import through the browser, plus video files whose audio the browser can decode. Limit: 100 MB and 10 minutes per file. Codec support varies by browser.
- Actual waveform rendering, zoom, seeking, playback, repeat, and listening volume.
- Analysis of decoded audio: duration, sample rate, channels, sample peak, RMS, and near-full-scale sample count.
- Track level, stereo pan, mute, solo, reset, synchronized playback, and saved mix settings.
- WAV conversion/export, start/end trimming, fade in/out, and selectable sample rate. Output is 16-bit stereo PCM WAV.
- Manual transcript editing, saved text, and TXT download.
- Browser-local project and export persistence, project/export deletion, and download of saved exports.

## First use

1. Explore the demo without signing in.
2. Click **New project** to create the first administrator account. There is no default password. First-admin creation only accepts a connection from localhost.
3. Upload a supported audio or video file. Files are read and processed on your device.
4. Open **Analysis** for measurements or **Remix studio** for track controls.
5. Choose **Export audio** to trim, add fades, render, save, and download a WAV.
6. Later registrations are pending until approved under **User approvals** in the admin sidebar.

## Data and privacy

Account hashes, sessions, and approval logs are stored in Neon Postgres. Set `DATABASE_URL` in `.env` to the Neon connection string before starting the server. Passwords use salted scrypt; session cookies are HttpOnly and SameSite=Strict, with a 24-hour lifetime. The server limits authentication attempts, checks JSON request origins, and only serves explicitly allowed public files.

Audio, project settings, and exports are stored in IndexedDB in the current browser, partitioned by the signed-in account identifier. Demo mix settings use localStorage. Audio files are **not uploaded to the server**. Different browsers and devices will not share project libraries. Browser storage is not a security boundary against someone with access to the browser profile or developer tools. Use separate browser/OS profiles on shared devices.

The 2 GB allowance is an application limit, not a guarantee of browser storage availability. Browser data may be cleared or evicted. Download important work separately. Export creates a new file and preserves the original. Track levels can exceed full scale; reduce them if a mix distorts. Listening volume affects preview only, not export.

## Explicit integration boundaries

These features have informative UI states, but **are not implemented processing services**:

- AI vocal/instrument separation of uploaded music.
- Automatic speech recognition, language identification, speaker diarization, and automatic subtitle generation.
- YouTube or other remote URL imports.
- MP3/FLAC encoding and universal video extraction.
- LUFS/true-peak metering, tempo/key estimation, noise reduction, mastering, EQ, reverb, and automated quality recommendations.

The demo does not stand in for processing uploaded audio. For real AI and universal media handling, add FFmpeg plus tested separation/ASR providers in background workers, with private object storage and a durable job queue. No external service keys are required or configured in this build.

This is a **local application foundation**, not a production internet deployment. Before public hosting, implement email verification and recovery, admin MFA, HTTPS, durable server-side project storage and access control, backups/retention, upload and worker sandboxing, and operational monitoring. The default listener is localhost. `HOST`, `PORT`, `DATA_DIR`, and `COOKIE_SECURE=true` are supported environment settings; changing the listener alone does not make the system production-ready.

## Tests

```sh
npm test
npm run test:e2e
```

The account and browser tests require a separate empty Neon database connection in `TEST_DATABASE_URL`; they are skipped or will not start without it. Never point `TEST_DATABASE_URL` at your production database. Run `npm run migrate:neon` once to copy the existing local `data/studio.db` account data into Neon (it will not copy browser-local audio files).

Unit/integration tests use the Node.js test runner and cover audio measurement, PCM encoding, waveform edge cases, administrator approval, authorization, session revocation, request-origin checks, and private file protection.

The browser test uses Playwright with an installed Microsoft Edge (`channel: 'msedge'`). It starts an isolated server on port 4174 with a separate test database and checks playback, persistence, upload, WAV download, account approval, mobile navigation, and overflow. To use Chromium instead, install it with `npx playwright install chromium` and remove `channel: 'msedge'` from `playwright.config.mjs`.

Screenshots and traces are written under `test-results/` and excluded from version control.

## Files

| File | Responsibility |
| --- | --- |
| `server.mjs` | Static server, Neon accounts, sessions, approval APIs |
| `app.js` | Application views, routing, IndexedDB, interaction |
| `audio.js` | Demo synthesis, analysis, Web Audio playback/mixing, WAV encoding |
| `styles.css` | Palette, desktop/mobile layout, interaction states |
| `tests/` | Audio, API, and browser tests |
