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

## Deploy (Netlify)

```bash
cd web && npm run build
```

Konfiguration i `netlify.toml`. Vid deploy körs Python-scripten automatiskt för att bygga om personsökningsindex.

### Admin i produktion (Git-deploy)

På Netlify kan servern inte skriva filer direkt. När `GITHUB_TOKEN` och `GITHUB_REPO` är satta committar admin-uppladdningar i stället till GitHub, och Netlify bygger om sajten.

**Miljövariabler på Netlify:**

| Variabel | Beskrivning |
|----------|-------------|
| `ADMIN_PASSWORD` | Lösenord för `/admin` |
| `GITHUB_TOKEN` | Personal Access Token med `Contents: Read and write` |
| `GITHUB_REPO` | `ägare/reponamn`, t.ex. `jonas/resultatbanken` |
| `GITHUB_BRANCH` | Branch att committa till (standard: `main`) |
| `NETLIFY_BUILD_HOOK_URL` | Valfri build hook-URL för omedelbar deploy |

**Steg:**

1. Skapa en [GitHub PAT](https://github.com/settings/tokens) med scope `repo` (eller fine-grained med Contents write).
2. Koppla repot till Netlify (Site settings → Build & deploy → Continuous deployment).
3. Sätt miljövariablerna ovan under Site settings → Environment variables.
4. (Valfritt) Skapa en [build hook](https://docs.netlify.com/configure-builds/build-hooks/) och sätt `NETLIFY_BUILD_HOOK_URL`.

Lokalt (utan `GITHUB_TOKEN`) sparas filer direkt i `data/` och index uppdateras via Python.

**Lokal admin:**

```bash
# web/.env.local
ADMIN_PASSWORD=ditt-lösenord
```
