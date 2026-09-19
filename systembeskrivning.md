# Systembeskrivning — Resultatbanken

Resultatbanken är IFK Mora OK:s arkiv för orienteringsresultat. Den samlar träningar, klubbmästerskap och tävlingar från 2004 och framåt, visar personhistorik och statistik, och räknar **Mästarnas Mästare**.

Sajten är öppen att läsa. Administration (uppladdning, namnkoppling, MM-redigering) kräver lösenord.

Källkod: [github.com/buden212-commits/Resultatbanken](https://github.com/buden212-commits/Resultatbanken).  
Ursprung: den gamla ASP-sidan `https://www2.ifkmora.se/ok/web/kavlar/resultatbanken.asp` (exporterad 2026).

---

## 1. Hur det hänger ihop

```
Webbläsare  →  Next.js-app (web/)  →  JSON + filer i data/
                                      ↑
Python-script (scripts/) bygger personsök-index från resultatfilerna.
På Vercel committar admin till GitHub, och Vercel bygger om sajten.
```

- **`web/`** — Next.js 16 (App Router), React 19, Tailwind CSS 4. Det är Vercel-projektets rotkatalog.
- **`data/`** — kanonisk data: manifest, parsade starter, personer, alias, MM-cup och originalfiler.
- **`scripts/`** — Python-parsers som läser PDF/Excel/HTML m.m. och skriver indexfiler.
- **`scraper/`** — engångsexport från den gamla sidan. Behövs inte för daglig drift.

Appen läser alltid `../data` relativt `web/` (alltså repo-rotens `data/`). På Vercel paketeras den mappen in i serverless-bundle via `web/next.config.ts`.

---

## 2. Publika sidor

| Sökväg | Innehåll |
|--------|----------|
| `/` | Sök, översiktssiffror, aktuell MM-ledare, senaste resultat |
| `/resultat` | Alla tävlingar och träningar |
| `/resultat/[id]` | Ett event: metadata, originalfil, parsade starter |
| `/sok?q=` | Sök bland personer **och** tävlingar |
| `/person/[key]` | En persons historik |
| `/statistik` | Klubbstatistik + MM-statistik (bl.a. marathon de senaste fem åren) |
| `/mastarnas` | Redirect till senaste MM-säsong |
| `/mastarnas/[year]` | Ställning, grenar och priser för ett år |

Sökförslag kommer från `GET /api/search/suggest?q=…` (personer + tävlingar). Originalfiler visas via `GET /api/content/[id]`.

Personnyckeln (`person_key`) är ett slug-namn utan diakritik, t.ex. `erik-zander`. Aliasgrupper i `data/person-aliases.json` slås ihop vid visning så att samma människa inte splittras på flera stavningar.

---

## 3. Administration

Inloggning: cookie `admin_session` (HMAC av ett fast värde med `ADMIN_PASSWORD`, 7 dagar). Utan miljövariabeln är admin avstängt.

| Sida | Vad den gör |
|------|-------------|
| `/ladda-upp` | Ny tävling/träning + resultatfil |
| `/koppla-namn` | Personalias och typalias |
| `/mastarnas/importera` | Importera MM från arkivet eller källfiler |
| `/resultat/[id]` (inloggad) | Byta eventtyp, exkludera från statistik, rätta tid |
| `/mastarnas/[year]` (inloggad) | Redigera klasser, grenar och resultat |

API under `/api/admin/…` (login, logout, events, event-type, person-aliases, type-aliases, stats-exclusions, result-time, mastarnas).

**Lokalt** (utan GitHub-token): filer skrivs direkt till `data/` och Python-index körs på servern.

**På Vercel** kan disken inte sparas. När `GITHUB_TOKEN` och `GITHUB_REPO` är satta committar admin-ändringar till GitHub. Vercel bygger om och kör om parsers. Valfri `VERCEL_DEPLOY_HOOK_URL` triggar deploy direkt.

---

## 4. Data

| Fil / mapp | Roll |
|------------|------|
| `data/manifest.json` | Ett event per post (id, namn, typ, datum, plats, filhänvisning) |
| `data/content/{id}.{ext}` | Originalfil: PDF, HTML, Excel, Word, text, bild |
| `data/results-index.json` | En rad per parsad start (namn, klass, plats, tid, status) |
| `data/people-index.json` | Aggregering per person (antal starter, datumspann, inbäddade resultat) |
| `data/person-aliases.json` | Samma person, flera namnvarianter |
| `data/type-aliases.json` | Samma tävlingstyp, flera stavningar (t.ex. KM-varianter) |
| `data/stats-exclusions.json` | Event-id:n som inte ska räknas i statistik |
| `data/mastarnas.json` | Hela Mästarnas Mästare (klasser, grenar, säsonger, resultat) |
| `data/parse-errors.json` | Filer som inte gick att parsa |
| `data/mastarnas-source/` | Rå-PDF:er för MM-import — **committas inte** |

Event-id från den gamla databasen behålls i URL:er (`/resultat/632`). Nya uppladdningar får nästa lediga id.

Index byggs så här:

```text
manifest + content/{id}.*
    → scripts/extract_participants.py  → results-index.json
    → scripts/rebuild_index.py         → people-index.json
```

Ett enstaka event:

```bash
python scripts/extract_participants.py --event-id 637
python scripts/rebuild_index.py
```

Parsers ligger i `scripts/parsers/` (HTML, text, Excel, Office, PDF, bild/OCR). Statusvärden som `dns`, `dnf`, `felst`, `deltagit` kommer därifrån.

---

## 5. Mästarnas Mästare

Klubbens totalkup över nio grenar (Skidor, Skid-o, Indoor, Medel, Lång, Sprint, Mtb-o, Terräng, Natt). Data: `data/mastarnas.json`. Beräkning: `web/src/lib/mastarnas-points.ts` och `mastarnas-standings.ts`.

### Poäng i en klass

- **Startande** = alla utom DNS.
- **1 startande:** 21 p till den som går i mål.
- **2 startande:** 22 / 20.
- **3 eller fler:** 24, 22, 20, 19 … ner till 10. Plats 14 och senare får 10.
- **Delad placering:** medel av de tabellplatser gruppen upptar (två på 3:e → 19,5).
- **DNS:** 0 p, räknas inte som startande.
- **DNF** (vid import även felst/deltagit): räknas som startande, 10 p.
- Historiska PDF:er kan ha lagrad `points`. Då används det värdet i stället för tabellen.

### Säsongställning

- Sex bästa grenarna räknas.
- Vid lika poäng: flest starter, därefter medel-KM.
- Ungdomstitel för klasser markerade `is_youth` (D/H 10–16).
- Delad ledning är möjlig.

På startsidan visas aktuell säsongsledare. På `/statistik` finns bland annat en **marathon**-tabell: summan av sex-bästa-poängen de senaste fem säsongerna.

Batchimport från käll-PDF: `python scripts/import_mastarnas.py` (läser `data/mastarnas-source/`).

---

## 6. Installation lokalt

### Förutsättningar

- **Node.js 20 eller nyare** (för Next.js 16)
- **Python 3** (för parsers; på Vercel anropas `python3`)
- Git

### Webb

```bash
cd web
npm install
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000).

Om Node tar slut på minne i dev:

```bash
# PowerShell
$env:NODE_OPTIONS="--max-old-space-size=8192"
npx next dev --webpack
```

### Python (index och import)

Från repo-roten:

```bash
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r scripts/requirements.txt
```

Kräver bland annat `pdfplumber`, `openpyxl`/`xlrd`, `beautifulsoup4`. OCR-vägen behöver dessutom Tesseract installerat på maskinen.

### Admin-lösenord

Skapa `web/.env.local` (filen ska inte committas):

```
ADMIN_PASSWORD=ditt-lösenord
```

Utan den variabeln syns inloggning inte. Lokalt, utan `GITHUB_TOKEN`, skrivs ändringar direkt till `data/`.

---

## 7. Deploy (Vercel)

1. Importera GitHub-repot `buden212-commits/Resultatbanken`.
2. Sätt **Root Directory** till `web`.
3. Sätt miljövariabler (tabellen nedan).
4. Deploy. Bygget kör `npm run vercel-build`:

```text
skapa Python-venv → pip install scripts/requirements.txt
→ extract_participants.py → rebuild_index.py
→ next build
```

Det styrs av `web/vercel.json` (`buildCommand`: `npm run vercel-build`). Push till `main` triggar produktion.

### Miljövariabler

| Variabel | Var | Syfte |
|----------|-----|--------|
| `ADMIN_PASSWORD` | Vercel + `web/.env.local` | Admininloggning |
| `GITHUB_TOKEN` | Vercel | PAT med Contents: Read and write — så admin kan committa |
| `GITHUB_REPO` | Vercel | `buden212-commits/Resultatbanken` |
| `GITHUB_BRANCH` | Vercel, valfri | Standard `main` |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel, valfri | Deploy hook för omedelbar ombyggnad |

### Vad som committas / inte committas

**Committas:** källkod, `data/manifest.json`, indexfiler, alias, `mastarnas.json`, resultatfiler i `data/content/`.

**Committas inte:** `.env*`, `node_modules`, `.next`, `.venv`, `.build-venv`, `data/mastarnas-source/`.

---

## 8. Vanlig drift

| Jag vill… | Gör så här |
|-----------|------------|
| Lägga till en träning i produktion | Logga in → Ladda upp. Filen committas till GitHub och Vercel bygger om. |
| Lägga till en träning lokalt | Samma, eller lägg filen i `data/content/` + rad i manifest och kör extract + rebuild. |
| Koppla två namn till samma person | `/koppla-namn` |
| Rätta en tid | Öppna eventet inloggad och redigera tiden |
| Uppdatera MM | `/mastarnas/importera` eller redigera på årsidan |
| Bygga om sökindex | `python scripts/extract_participants.py` sedan `rebuild_index.py` |
| Ny export från gamla sidan | `scraper/download.py` — används sällan nu när nya resultat går in via uppladdning |

Äldre bakgrund om exportformat och parsers finns i `BUILD.md` (delar där är historiska; sajten körs på Vercel, inte Netlify). Kort snabbstart finns i `README.md`.

---

## 9. Nyckelkod

| Område | Fil |
|--------|-----|
| Läsa events/personer | `web/src/lib/data.ts` |
| Admin-skrivning | `web/src/lib/admin-data.ts` |
| Auth | `web/src/lib/admin-auth.ts` |
| GitHub-commit från admin | `web/src/lib/github-deploy.ts` |
| MM-poäng | `web/src/lib/mastarnas-points.ts` |
| MM-ställning | `web/src/lib/mastarnas-standings.ts` |
| Parse av resultatfiler | `scripts/extract_participants.py`, `scripts/parsers/` |
| Vercel-bygge | `web/package.json` → `vercel-build`, `web/vercel.json` |
