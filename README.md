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
- Optional YouTube source import: the app can fetch one authorized YouTube video, convert its audio to WAV, and save the resulting file locally in the browser.
- Actual waveform rendering, zoom, seeking, playback, repeat, and listening volume.
- Analysis of decoded audio: duration, sample rate, channels, sample peak, RMS, and near-full-scale sample count.
- Track level, stereo pan, mute, solo, reset, synchronized playback, and saved mix settings.
- WAV conversion/export, start/end trimming, fade in/out, and selectable sample rate. Output is 16-bit stereo PCM WAV.
- Manual transcript editing, saved text, and TXT download.
- Browser-local project and export persistence, project/export deletion, and download of saved exports.

## First use

1. Explore the demo without signing in.
2. Click **New project** to create the first administrator account. There is no default password. First-admin creation only accepts a connection from localhost.
3. Select **New project**, then either upload a supported audio/video file or choose **YouTube link**. Files are saved in this browser after import.
4. Open **Analysis** for measurements or **Remix studio** for track controls.
5. Choose **Export audio** to trim, add fades, render, save, and download a WAV.
6. Later registrations are pending until approved under **User approvals** in the admin sidebar.

## Data and privacy

Account hashes, sessions, and approval logs are stored in Neon Postgres. Set `DATABASE_URL` in `.env` to the Neon connection string before starting the server. Passwords use salted scrypt; session cookies are HttpOnly and SameSite=Strict, with a 24-hour lifetime. The server limits authentication attempts, checks JSON request origins, and only serves explicitly allowed public files.

Audio, project settings, and exports are stored in IndexedDB in the current browser, partitioned by the signed-in account identifier. Demo mix settings use localStorage. Local file audio is not uploaded to the server. When optional YouTube import is enabled, the server temporarily retrieves and converts the selected source, returns the WAV to the browser, then removes the temporary server file. Different browsers and devices will not share project libraries. Browser storage is not a security boundary against someone with access to the browser profile or developer tools. Use separate browser/OS profiles on shared devices.

The 2 GB allowance is an application limit, not a guarantee of browser storage availability. Browser data may be cleared or evicted. Download important work separately. Export creates a new file and preserves the original. Track levels can exceed full scale; reduce them if a mix distorts. Listening volume affects preview only, not export.

## Explicit integration boundaries

These features have informative UI states, but **are not implemented processing services**:

- AI vocal/instrument separation of uploaded music.
- Automatic speech recognition, language identification, speaker diarization, and automatic subtitle generation.
- Other remote URL imports (YouTube import is optional and described below).
- MP3/FLAC encoding and universal video extraction.
- LUFS/true-peak metering, tempo/key estimation, noise reduction, mastering, EQ, reverb, and automated quality recommendations.

The demo does not stand in for processing uploaded audio. For real AI and universal media handling, add FFmpeg plus tested separation/ASR providers in background workers, with private object storage and a durable job queue. No external service keys are required or configured in this build.

## YouTube import deployment

The site flow is: YouTube link → audio-only stream extraction → WAV conversion → normal AudioLab project processing. It is intended only for media the user owns or is authorized to use.

Vercel cannot run the extraction process or deliver large converted audio files reliably. Deploy the included [`worker`](worker) container to a container host (Railway, Render, or Google Cloud Run), then set these Vercel environment variables:

```text
YOUTUBE_WORKER_URL=https://your-worker.example.com
YOUTUBE_WORKER_SECRET=a-long-random-shared-secret
```

Set matching worker variables:

```text
YOUTUBE_WORKER_SECRET=the-same-long-random-shared-secret
ALLOWED_ORIGIN=https://your-vercel-domain.vercel.app
```

Use one manually generated value for `YOUTUBE_WORKER_SECRET` in both Vercel and Render. The Render blueprint asks for this value instead of generating a separate secret, because the API and worker must share the same signing key. After setting `YOUTUBE_WORKER_URL` and the matching secret in Vercel, redeploy the Vercel project and confirm `/api/status` reports `youtubeImport: true`.

The Vercel API authenticates the signed-in user and issues a five-minute, signed, single-import ticket from `/api/youtube-ticket`. The browser presents that ticket directly to the worker, so converted audio never has to pass through Vercel. The worker validates the ticket, accepts only a single HTTPS YouTube video URL, rejects playlists, limits source duration to 10 minutes and output to 100 MB, then deletes temporary conversion files.

If YouTube returns HTTP 403 from the worker host, configure an authorized Netscape-format browser cookie export as a Render secret file and set `YOUTUBE_COOKIES_FILE` to its mounted path. Do not commit or paste cookies into source control. Cookies should only be used for media the account owner is authorized to access.

### Production checklist

1. Create a Render Blueprint from this repository. Set `YOUTUBE_WORKER_SECRET` to a long random value and set `ALLOWED_ORIGIN` to the exact Vercel production origin, with no trailing slash.
2. Wait for the worker deployment, then open `https://your-worker.onrender.com/health` and confirm it returns `{"ok":true,...}`.
3. In the Vercel Production environment, set `DATABASE_URL`, `YOUTUBE_WORKER_URL`, and `YOUTUBE_WORKER_SECRET`. The secret must exactly match the Render value. Redeploy Vercel after changing variables.
4. Open `/api/status` on the deployed site and confirm `capabilities.youtubeImport` is `true`.
5. Temporarily set `ALLOW_FIRST_ADMIN_SIGNUP=true` only while creating the first administrator. Remove it or set it to `false` immediately afterward and redeploy.

Try authorized public videos without cookies first. If authentication is required, export a fresh Netscape-format cookie file from a dedicated YouTube account. In the Render worker service, open **Environment -> Secret Files**, create `youtube-cookies.txt`, and paste the file contents there. Render mounts it at `/etc/secrets/youtube-cookies.txt`; the Blueprint already configures that path. After deployment, `/health` should report both `cookiesConfigured` and `cookiesAvailable` as `true`.

Do not use a primary personal account for worker cookies. YouTube can require PO tokens, reject data-center IP addresses, or bind a session to the IP that created it. A cookie exported on your computer is therefore not guaranteed to work from Render and can expire or trigger account security checks. If repeated 403 or bot-verification errors continue, refresh the secret file or use an authorized media-ingestion provider; do not expose the worker without signed-ticket authentication.

For local development only, install `yt-dlp` and FFmpeg on the machine running AudioLab, then enable the local worker:

```powershell
$env:YTDLP_ENABLED = 'true'
npm.cmd start
```

If `yt-dlp` is not on `PATH`, set `YTDLP_PATH` to its executable path. Do not expose the local endpoint publicly. The included public worker has basic in-memory request and concurrency limits; production operators should still add platform monitoring and account-level quotas.

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
| `public/` | Browser application, styles, audio engine, and static assets |
| `server/server.mjs` | Local static server, accounts, sessions, and approval APIs |
| `server/db.mjs` | Shared Neon/Postgres schema and database connection |
| `api/` | Vercel serverless API routes |
| `scripts/` | One-off maintenance and database migration utilities |
| `worker/` | Containerized YouTube audio import worker |
| `tests/` | Audio, API, and browser tests |
