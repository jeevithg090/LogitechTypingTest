# Typing Test Giveaway Kiosk

A lightweight, two-screen web kiosk for running a typing-speed challenge at an event booth.
Visitors watch a looping background video, tap **Enter User Details**, and register their name
and contact details; a volunteer then unlocks the WPM field, enters the visitor's typing-test
score, and the entry is appended to a Google Sheet through a Google Apps Script web app.

> **Independent project.** This repository is not affiliated with, sponsored by, or endorsed by
> any hardware manufacturer. Product names that may appear in your own configuration (for example
> the prize name) are used only to describe the giveaway.

## Features

- **Kiosk home screen** – full-screen background video playlist that loops, skips files that fail
  to load, and falls back to a gradient when no video is configured. Press <kbd>L</kbd> to hide the
  buttons and let the video play unobstructed.
- **Registration form** – name, email, contact number (with an enforced `+91` prefix that survives
  backspace, cut and paste) and WPM score, with inline, accessible validation messages and a
  completion progress bar.
- **Volunteer-only WPM field** – unlocked with a volunteer code that is checked **on the server**
  (stored as an Apps Script property, never shipped to the browser) and re-checked on every
  submission.
- **Google Sheets backend** – rows are matched to the sheet's header row, writes are serialised
  with a script lock, inputs are validated server-side, and values are sanitised against
  spreadsheet formula injection.
- **Clear feedback** – loading states on buttons, success/error status messages, request
  timeouts, and an explicit warning when the endpoint isn't configured.
- **Accessible and responsive** – semantic labels, `aria-invalid`/`aria-live` error reporting,
  native `<dialog>` for the volunteer prompt, visible focus rings, reduced-motion support, and
  layouts tested at phone and desktop widths.

## Tech stack

| Layer    | Technology                                                      |
| -------- | --------------------------------------------------------------- |
| Frontend | Vanilla HTML, CSS and JavaScript (ES modules), no UI framework  |
| Build    | [Vite](https://vite.dev/) (multi-page build, env-var injection) |
| Backend  | Google Apps Script web app writing to Google Sheets             |
| Quality  | Vitest, ESLint (flat config), Prettier                          |

## Architecture

```
┌────────────────────┐   click    ┌──────────────────────┐
│ index.html         │ ─────────▶ │ register.html        │
│ video playlist     │            │ form + volunteer lock│
└────────────────────┘            └──────────┬───────────┘
                                             │ POST (form-encoded)
                                             │  action=verify | registration
                                             ▼
                                  ┌──────────────────────┐   write row   ┌──────────────┐
                                  │ Apps Script doPost   │ ────────────▶ │ Google Sheet │
                                  │ code check, validate,│               │ (Sheet1)     │
                                  │ sanitise, lock       │               └──────────────┘
                                  └──────────────────────┘
```

- The browser never knows the volunteer code. Unlocking sends `action=verify` with the code the
  volunteer typed; the final submission sends the code again and the script rejects the row if it
  doesn't match the `VOLUNTEER_CODE` script property.
- Columns are driven by the sheet's first row. Any header named `timestamp` receives the server
  time; other headers are filled from the matching form field (`name`, `email`,
  `contact_number`, `wpm_count`). The volunteer code is never written to the sheet.

## Getting started

### Prerequisites

- Node.js 20.19+ (22 recommended; see `.nvmrc`)
- A Google account for the Sheet and Apps Script

### 1. Install and run locally

```bash
npm install
cp .env.example .env.local   # then edit the values
npm run dev                  # http://localhost:5173
```

Without `VITE_SCRIPT_URL` the app still runs; the form shows a configuration warning and
submission is disabled.

### 2. Set up the Google Sheet and Apps Script

1. Create a Google Sheet with a tab named `Sheet1` and this header row:

   | timestamp | name | email | contact_number | wpm_count |
   | --------- | ---- | ----- | -------------- | --------- |

2. Open **Extensions → Apps Script**, replace the default code with
   [`apps-script/Code.gs`](apps-script/Code.gs), and (optionally) copy the manifest from
   [`apps-script/appsscript.json`](apps-script/appsscript.json) (enable "Show manifest file" in
   Project Settings).
3. Run `initialSetup` once from the editor and grant the requested permissions. This stores the
   spreadsheet ID as the `SPREADSHEET_ID` script property.
4. In **Project Settings → Script properties**, add `VOLUNTEER_CODE` with a strong code of your
   choice. Share it only with volunteers.
5. **Deploy → New deployment → Web app**, execute as **Me**, access **Anyone**. Copy the `/exec`
   URL into `VITE_SCRIPT_URL`.

After editing the script, create a new deployment version for the changes to go live.

### 3. Add background videos (optional)

Put MP4 files you have the rights to use in `public/videos/` (the folder is git-ignored) and list
them in `VITE_BACKGROUND_VIDEOS`.

## Environment variables

All variables are read by Vite at **build time** and embedded in the public bundle, so none of
them may be secret.

| Variable                 | Required | Default            | Description                                           |
| ------------------------ | -------- | ------------------ | ----------------------------------------------------- |
| `VITE_SCRIPT_URL`        | Yes\*    | –                  | Apps Script web app `/exec` URL. \*Needed to submit.  |
| `VITE_PRIZE_NAME`        | No       | `a wireless mouse` | Prize text in "Stand a chance to win …".              |
| `VITE_LEARN_MORE_URL`    | No       | –                  | Adds a secondary button on the home screen.           |
| `VITE_LEARN_MORE_LABEL`  | No       | `Learn more`       | Label for that button.                                |
| `VITE_BACKGROUND_VIDEOS` | No       | –                  | Comma-separated video paths, e.g. `/videos/a.mp4`.    |
| `VITE_REDIRECT_SECONDS`  | No       | `5`                | Delay before returning home after a successful entry. |

Apps Script **script properties** (server-side, secret): `VOLUNTEER_CODE` (required) and
`SPREADSHEET_ID` (set by `initialSetup`).

## Scripts

| Command                | What it does                                   |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Start the Vite dev server                      |
| `npm run build`        | Production build to `dist/`                    |
| `npm run preview`      | Serve the production build locally             |
| `npm test`             | Run the unit tests (Vitest)                    |
| `npm run lint`         | Lint JS and the Apps Script source with ESLint |
| `npm run format`       | Format everything with Prettier                |
| `npm run format:check` | Verify formatting                              |
| `npm run check`        | Lint + format check + tests + build in one go  |

Tests cover the client validation rules, phone-prefix editing, progress calculation, video
playlist behaviour, the API client's error handling, and the Apps Script backend (loaded into a
Node `vm` sandbox with fake `SpreadsheetApp`/`LockService` services), including volunteer-code
enforcement and formula-injection sanitising.

## Deployment

`npm run build` produces a fully static site in `dist/` (`index.html`, `register.html` and hashed
assets). Host it on any static host, for example GitHub Pages, Netlify, Vercel, Cloudflare Pages,
or a local web server on the kiosk machine. Set the `VITE_*` variables in the host's build
settings (or in `.env.local` before building) and copy your videos into `public/videos/` before
the build so they are included in `dist/videos/`.

For a booth, open the site in the browser's kiosk/full-screen mode. Browsers only autoplay muted
video, which is how the background player is configured.

## Project structure

```
.
├── index.html               # Kiosk home screen (video background)
├── register.html            # Registration form + volunteer dialog
├── src/
│   ├── home.js              # Home screen behaviour (playlist, L-key toggle)
│   ├── register.js          # Form wiring: validation, volunteer lock, submission
│   ├── lib/
│   │   ├── api.js           # Apps Script client with timeouts and typed errors
│   │   ├── config.js        # VITE_* env parsing and defaults
│   │   ├── particles.js     # Decorative canvas animation (reduced-motion aware)
│   │   ├── phone.js         # Country-code prefix helpers
│   │   ├── playlist.js      # Cyclic playlist that skips broken videos
│   │   ├── progress.js      # Form completion percentage
│   │   └── validation.js    # Client-side validation rules
│   └── styles/              # base.css, home.css, register.css
├── apps-script/
│   ├── Code.gs              # Apps Script web app (doPost)
│   └── appsscript.json      # Apps Script manifest (V8 runtime, web app settings)
├── public/                  # Static files copied as-is (favicon, videos/)
├── tests/                   # Vitest unit tests
├── .env.example             # Documented configuration template
└── vite.config.js           # Multi-page build + test config
```

## Security notes

- Keep `VOLUNTEER_CODE` in Apps Script properties only; anything in `VITE_*` is public.
- The Apps Script endpoint is publicly reachable by design (anonymous kiosk). The volunteer code
  gates every write, but it is not rate-limited; use a long code and rotate it per event.
- The sheet stores personal contact details. Restrict sharing of the spreadsheet and delete data
  when the giveaway is over.
