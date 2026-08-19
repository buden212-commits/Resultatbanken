# Resultatbanken 2.0

Resultatarkiv för IFK Mora OK — exporterat från legacy-sidan och byggt som modern Next.js-app.

## Snabbstart (webb)

```bash
cd web
npm install
npm run dev
```

Öppna http://localhost:3000

## Data

- `data/manifest.json` — alla events (415 st)
- `data/results-index.json` — extraherade starter (4517 st)
- `data/people-index.json` — personer (1455 st)
- `data/content/` — PDF, HTML, Excel m.m.

Uppdatera index efter nya filer:

```bash
python scripts/extract_participants.py
python scripts/rebuild_index.py
```

## Export från legacy-sidan

Se [README export](README.md) i `scraper/`.

## Byggplan

Se [BUILD.md](BUILD.md).

## Deploy (Vercel)

Konfiguration i `web/vercel.json`. Vid deploy körs Python-scripten automatiskt för att bygga om personsökningsindex.

### Koppla till Vercel

1. Gå till [vercel.com/new](https://vercel.com/new) och importera GitHub-repot `buden212-commits/Resultatbanken`
2. Sätt **Root Directory** till `web`
3. Klicka **Deploy**

### Admin i produktion (Git-deploy)

På Vercel kan servern inte skriva filer direkt. När `GITHUB_TOKEN` och `GITHUB_REPO` är satta committar admin-uppladdningar i stället till GitHub, och Vercel bygger om sajten.

**Miljövariabler på Vercel** (Project → Settings → Environment Variables):

| Variabel | Beskrivning |
|----------|-------------|
| `ADMIN_PASSWORD` | Lösenord för `/admin` |
| `GITHUB_TOKEN` | Personal Access Token med `Contents: Read and write` |
| `GITHUB_REPO` | `ägare/reponamn`, t.ex. `buden212-commits/Resultatbanken` |
| `GITHUB_BRANCH` | Branch att committa till (standard: `main`) |
| `VERCEL_DEPLOY_HOOK_URL` | Valfri deploy hook-URL för omedelbar deploy |

**Deploy hook (valfritt):**

1. Vercel → Project → Settings → **Git** → **Deploy Hooks**
2. Skapa hook för branch `main`
3. Sätt URL:en som `VERCEL_DEPLOY_HOOK_URL`

Lokalt (utan `GITHUB_TOKEN`) sparas filer direkt i `data/` och index uppdateras via Python.

**Lokal admin:**

```bash
# web/.env.local
ADMIN_PASSWORD=ditt-lösenord
```
