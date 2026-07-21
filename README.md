# Zeevelo 

Job-search & application-assistant platform.

| Surface | Domain | Stack |
|---|---|---|
| Marketing site | jobs.zeevelo.com | Static HTML/CSS (Cloudflare Pages) |
| Web app | apply.zeevelo.com | React + Vite SPA (Cloudflare Pages) |

## Repo structure

```
zeevelo/
├─ apps/
│  ├─ marketing/              # jobs.zeevelo.com
│  │  ├─ index.html           # single-page landing (hero, how-it-works, ATS, pricing, FAQ)
│  │  └─ assets/              # logo.svg, og-image, favicons
│  └─ app/                    # apply.zeevelo.com
│     ├─ index.html
│     ├─ vite.config.js
│     └─ src/
│        ├─ main.jsx / App.jsx
│        ├─ pages/            # Dashboard, Profile, Jobs, Queue, Receipts, Settings
│        ├─ components/       # ScoreDial, KeywordBreakdown, DiffView, RulesEngine, ReceiptLog
│        ├─ lib/              # resume parser, ATS scoring, tailoring, store (localStorage)
│        └─ data/             # sample resume + job descriptions
├─ packages/
│  └─ shared/                 # brand tokens (colors, type), scoring constants
└─ README.md
```

## Product rules

- Submission mode is a **per-user setting**: "Review every application" (default) or
  "Auto-submit above threshold" (user sets ATS-score + profile-completeness thresholds;
  everything below the bar queues for one-click batch approval).
- Every application — auto or manual — writes a **receipt**: payload sent, timestamp,
  ATS confirmation ID.
- Admin account (Harsha / basani.hvreddy@gmail.com): unlimited applications and resume
  generations, all submission modes unlocked.

## Pricing (Tsenta parity placeholders)

Free $0 (25 lifetime) · Starter $19/mo (600) · Pro $49/mo (1,500) · Premium $99/mo (4,500)

## Deploy

Two Cloudflare Pages projects:
- `zeevelo-marketing` → build: none, output: `apps/marketing` → custom domain jobs.zeevelo.com
- `zeevelo-app` → build: `npm run build` in `apps/app`, output: `dist` → custom domain apply.zeevelo.com
