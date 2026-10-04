# 🎙️ Shenanigans Studio

> A production-grade Progressive Web App for live audio production, session automation, and studio management — built with SvelteKit, Supabase, and a suite of Windows automation servers.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Supabase Integration](#supabase-integration)
- [Automation Servers](#automation-servers)
  - [FADR Automation](#fadr-automation)
  - [REAPER Bridge](#reaper-bridge)
  - [X32 Control](#x32-control)
- [PWA Development](#pwa-development)
- [Windows Launch Scripts](#windows-launch-scripts)
- [Development Workflow](#development-workflow)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Project Overview

**Shenanigans Studio** is a browser-based studio control surface and session management PWA designed for live performance, podcast production, and hybrid recording environments. It provides:

- Real-time mixer control via OSC (Behringer X32/M32)
- DAW automation and session management via the REAPER Bridge server
- AI-assisted stem separation and audio analysis via FADR
- Persistent session data, user auth, and media assets via Supabase
- Full offline capability and installability via PWA service worker

The app is designed to run locally on a Windows studio machine and optionally be served to tablets or phones on the same LAN as a touch-friendly control surface.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | SvelteKit (Vite) |
| Styling | TailwindCSS |
| Backend / Auth / DB | Supabase (PostgreSQL + Auth + Storage) |
| DAW Control | REAPER + OSC / HTTP bridge (Node.js) |
| Mixer Control | Behringer X32 via OSC (UDP) |
| Audio AI | FADR stem separation API |
| PWA | Vite PWA Plugin + Workbox |
| Runtime (Windows) | Node.js 22 LTS |
| Package Manager | npm |

---

## Project Structure

```
shenanigans-studio/
├── src/
│   ├── lib/
│   │   ├── components/       # Svelte UI components
│   │   ├── stores/           # Svelte stores (mixer state, session, user)
│   │   ├── supabase.ts       # Supabase client singleton
│   │   ├── reaper.ts         # REAPER bridge API helpers
│   │   ├── x32.ts            # X32 OSC command helpers
│   │   └── fadr.ts           # FADR API helpers
│   ├── routes/
│   │   ├── +layout.svelte    # Root layout (auth gate, nav)
│   │   ├── +page.svelte      # Dashboard / home
│   │   ├── mixer/            # X32 control surface
│   │   ├── sessions/         # Session browser & recorder
│   │   ├── stems/            # FADR stem workspace
│   │   └── settings/         # Env & server config UI
│   └── app.html
├── servers/
│   ├── reaper-bridge/        # Node.js HTTP → REAPER OSC bridge
│   ├── x32-proxy/            # Node.js UDP OSC proxy for X32
│   └── fadr-worker/          # FADR polling / webhook worker
├── scripts/
│   ├── launch-all.bat        # Launch all servers + dev server
│   ├── launch-prod.bat       # Launch all servers + static preview
│   └── stop-all.bat          # Kill all studio processes
├── static/
│   ├── icons/                # PWA icons (192×192, 512×512)
│   └── manifest.webmanifest  # PWA manifest
├── supabase/
│   ├── migrations/           # SQL migration files
│   └── seed.sql              # Dev seed data
├── .env.example              # Template for required env vars
├── CONTRIBUTING.md           # Contribution guidelines
├── svelte.config.js
├── vite.config.js
└── package.json
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in every value before starting any server.

```dotenv
# ─── Supabase ────────────────────────────────────────────────
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Service role key — server-side only, never expose to browser
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ─── REAPER Bridge ───────────────────────────────────────────
VITE_REAPER_BRIDGE_URL=http://localhost:9090
REAPER_OSC_HOST=127.0.0.1
REAPER_OSC_PORT=8000         # Must match REAPER's OSC listener port

# ─── X32 Mixer ───────────────────────────────────────────────
VITE_X32_PROXY_URL=http://localhost:9091
X32_HOST=192.168.1.200       # IP address of your X32/M32 on LAN
X32_PORT=10023               # Default X32 OSC port

# ─── FADR ────────────────────────────────────────────────────
FADR_API_KEY=your-fadr-api-key
FADR_WEBHOOK_SECRET=your-webhook-secret
VITE_FADR_WORKER_URL=http://localhost:9092

# ─── App ─────────────────────────────────────────────────────
VITE_APP_NAME="Shenanigans Studio"
VITE_APP_VERSION=1.0.0
NODE_ENV=development
```

> **Security:** Variables prefixed with `VITE_` are bundled into the browser build. Never prefix server-only secrets (service role keys, API keys) with `VITE_`.

---

## Supabase Integration

### Setup

1. Create a new project at [supabase.com](https://supabase.com).
2. Copy your project URL and anon key into `.env`.
3. Apply migrations:

```bash
npx supabase db push
# or manually run files in supabase/migrations/ via the SQL editor
```

4. (Optional) Seed development data:

```bash
npx supabase db reset   # applies migrations + seed.sql
```

### Auth

Authentication uses Supabase Auth with email/password (magic link optional). The root layout (`+layout.svelte`) gates all routes behind a session check. The Supabase client is initialized once in `src/lib/supabase.ts` and imported wherever needed:

```js
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
```

### Key Tables

| Table | Purpose |
|---|---|
| `sessions` | Recording session metadata (title, date, notes, status) |
| `tracks` | Tracks within a session (name, channel, color) |
| `stems` | FADR stem jobs (source file, status, output URLs) |
| `snapshots` | X32 mixer scene snapshots (JSON blob) |
| `profiles` | Extended user profile linked to `auth.users` |

### Storage Buckets

| Bucket | Contents | Access |
|---|---|---|
| `recordings` | Raw session audio files | Private (authenticated) |
| `stems` | FADR output stem files | Private (authenticated) |
| `exports` | Mixdown exports | Private (authenticated) |

---

## Automation Servers

Three lightweight Node.js servers live in `servers/` and run alongside the SvelteKit app. Each exposes a local HTTP API that the frontend calls, then translates commands to the appropriate protocol.

### FADR Automation

**Location:** `servers/fadr-worker/`  
**Port:** `9092`  
**Purpose:** Manages FADR stem separation jobs — submits audio files to the FADR API, polls for completion, stores output URLs in Supabase, and notifies the frontend via server-sent events (SSE).

> **Note:** FADR does not provide native webhook support. The worker uses a **polling strategy** — after submitting a job it calls `GET /jobs/:id` on a configurable interval until the job reaches a terminal state (`complete` or `error`), then writes results to Supabase and pushes an SSE event to the frontend. No public-facing URL or webhook secret is required.

**Key endpoints:**

| Method | Path | Description |
|---|---|---|
| `POST` | `/jobs` | Submit a new stem separation job |
| `GET` | `/jobs/:id` | Get current status of a job |
| `GET` | `/jobs` | List all jobs (with optional status filter) |
| `DELETE` | `/jobs/:id` | Cancel a pending job |
| `GET` | `/events` | SSE stream for real-time job status updates |

**Polling behaviour:**  
Configure the poll interval via `FADR_POLL_INTERVAL_MS` (default: `5000`). The worker uses exponential backoff after repeated non-terminal responses and stops polling after `FADR_POLL_MAX_ATTEMPTS` (default: `60`, i.e. 5 minutes at 5 s intervals).

**Start manually:**

```bash
cd servers/fadr-worker
node index.js
```

---

### REAPER Bridge

**Location:** `servers/reaper-bridge/`  
**Port:** `9090`  
**Purpose:** Translates HTTP requests from the SvelteKit frontend into OSC messages sent to REAPER's built-in OSC listener. Enables transport control, track arming, marker navigation, and custom actions without requiring REAPER's web interface.

**REAPER OSC setup:**  
In REAPER → Preferences → Control/OSC/web → Add → OSC (Open Sound Control).  
Set the local listen port to the value of `REAPER_OSC_PORT` in your `.env`.

**Key endpoints:**

| Method | Path | Description |
|---|---|---|
| `POST` | `/transport/play` | Send Play |
| `POST` | `/transport/stop` | Send Stop |
| `POST` | `/transport/record` | Arm + Record |
| `POST` | `/track/:n/arm` | Arm track N |
| `POST` | `/track/:n/mute` | Mute track N |
| `POST` | `/marker/goto/:n` | Jump to marker N |
| `POST` | `/action/:id` | Trigger custom action by command ID |

**Start manually:**

```bash
cd servers/reaper-bridge
node index.js
```

---

### X32 Control

**Location:** `servers/x32-proxy/`  
**Port:** `9091`  
**Purpose:** Acts as a UDP ↔ HTTP proxy between the browser and the Behringer X32/M32 mixer. The browser cannot send raw UDP packets, so this server receives HTTP requests from the frontend and forwards them as OSC/UDP datagrams to the mixer. It also maintains a subscription loop to receive metering and state updates, caching the mixer state in memory and exposing it via REST and SSE.

**Key endpoints:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/state` | Full cached mixer state snapshot |
| `POST` | `/channel/:n/fader` | Set fader level (0.0–1.0) |
| `POST` | `/channel/:n/mute` | Toggle mute on channel N |
| `POST` | `/channel/:n/name` | Set channel name |
| `POST` | `/scene/load/:n` | Load scene/snapshot N |
| `POST` | `/scene/save/:n` | Save current state to scene N |
| `GET` | `/meters` | SSE stream of live meter values |

**Start manually:**

```bash
cd servers/x32-proxy
node index.js
```

---

## PWA Development

The app is configured as a full PWA using `vite-plugin-pwa` with a Workbox-generated service worker.

### Manifest

`static/manifest.webmanifest` defines the app name, icons, theme color, display mode (`standalone`), and start URL. Update icons in `static/icons/` — at minimum provide `icon-192.png` and `icon-512.png`.

### Service Worker Strategy

| Asset Type | Strategy |
|---|---|
| App shell (JS/CSS/HTML) | Cache First (versioned) |
| Supabase API calls | Network First |
| Server automation endpoints | Network Only (no caching) |
| Static assets (fonts, icons) | Cache First |

### Installing Locally

On Chrome/Edge: navigate to the app URL → address bar install icon → **Install**.  
On mobile: **Share → Add to Home Screen**.

The app is fully functional offline for previously loaded sessions and mixer snapshots. Network-dependent features (FADR submission, Supabase writes) queue and retry when the connection is restored.

---

## Windows Launch Scripts

All scripts are in `scripts/`. Right-click → **Run as administrator** is not required unless your Node.js install is system-wide.

See the `scripts/` folder for `launch-all.bat`, `launch-prod.bat`, and `stop-all.bat`.

> **Tip:** Pin `launch-all.bat` to your taskbar or create a desktop shortcut for one-click studio startup.

---

## Development Workflow

### First-Time Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-org/shenanigans-studio.git
cd shenanigans-studio

# 2. Install dependencies
npm install
cd servers/reaper-bridge && npm install && cd ../..
cd servers/x32-proxy     && npm install && cd ../..
cd servers/fadr-worker   && npm install && cd ../..

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase keys, X32 IP, FADR key, etc.

# 4. Apply Supabase migrations
npx supabase db push

# 5. Launch everything
scripts\launch-all.bat   # Windows
# or manually: npm run dev  (after starting servers individually)
```

### Daily Development

```bash
# Start all servers + dev server (Windows)
scripts\launch-all.bat

# Run only the SvelteKit dev server (if servers already running)
npm run dev

# Type-check
npm run check

# Lint
npm run lint

# Format
npm run format
```

### Useful Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start SvelteKit dev server with HMR |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run check` | Svelte + TypeScript type check |
| `npm run lint` | ESLint + Prettier check |
| `npm run format` | Auto-format with Prettier |
| `npx supabase db push` | Apply pending migrations |
| `npx supabase db reset` | Reset DB and apply seed data |

---

## Deployment

### Local Network (Recommended)

Run `launch-prod.bat` and access the app from any device on your studio LAN:

```
http://<your-studio-pc-ip>:4173
```

Ensure Windows Firewall allows inbound TCP on ports `4173`, `9090`, `9091`, and `9092`.

### Static Hosting (Frontend Only)

The SvelteKit app can be built as a static site using the static adapter. The automation servers must still run on a reachable local machine — update the `VITE_*_URL` env vars to point to their LAN addresses before building.

```bash
# svelte.config.js — switch to static adapter
import adapter from '@sveltejs/adapter-static';
```

Deploy the `build/` output to any static host (Netlify, Cloudflare Pages, local Nginx, etc.).

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branch conventions, code style, and PR guidelines.

---

## License

MIT © Shenanigans Studio
