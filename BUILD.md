# Resultatbanken 2.0 — Byggdokumentation

Detta dokument beskriver vad som exporterats från den gamla sidan och hur vi kan bygga den nya Resultatbanken ovanpå datan.

**Källa (legacy):** https://www2.ifkmora.se/ok/web/kavlar/resultatbanken.asp  
**Export klar:** 2026-07-11

---

## Status

| Del | Status |
|-----|--------|
| Metadata (`data/manifest.json`) | 415 poster |
| Nedladdade filer (`data/content/`) | 414 filer |
| Saknad fil | 1 (id=232, HTTP 500 från servern) |
| Exportscript | `scraper/download.py` |
| Ny webbplats | **Ej påbörjad** |

---

## Projektstruktur idag

```
Resultatbanken 2.0/
├── BUILD.md              ← denna fil
├── README.md             ← exportscript-dokumentation
├── data/
│   ├── manifest.json     ← metadata för alla events
│   ├── results-index.json ← en rad per deltagande (genereras)
│   ├── people-index.json  ← aggregerat per person (genereras)
│   ├── parse-errors.json  ← filer som inte kunde parsas
│   ├── content/          ← råfiler per event-id
│   ├── errors.json       ← misslyckade nedladdningar
│   └── progress.json
├── scripts/
│   ├── rename_bin_files.py
│   ├── extract_participants.py
│   └── rebuild_index.py
```

---

## Datamodell (manifest.json)

Varje post representerar ett träningspass, lopp eller annan aktivitet.

```json
{
  "id": 632,
  "name": "Träningsorientering",
  "type": "träningsorientering",
  "date": "2026-06-25",
  "organizer": "arbetsgrupp 5",
  "location": "Bonäs",
  "free_text": "",
  "result_file": "Träningsorientering 260625.pdf",
  "file_size": 41663,
  "file_type": "application/pdf",
  "source_url": "https://www2.ifkmora.se/ok/web/kavlar/Getresultat.asp?id=632",
  "local_file": "content/632.pdf",
  "downloaded_at": "2026-07-11T19:04:30+00:00"
}
```

### Fält

| Fält | Beskrivning |
|------|-------------|
| `id` | Unikt ID från gamla databasen — **behåll i URL:er** (`/resultat/632`) |
| `name` | Träningsnamn / tävlingsnamn |
| `type` | Typ: Motionsorientering, Tränings-OL, KM, Klubbmästerskap, Gatlopp m.m. |
| `date` | ISO-datum (`YYYY-MM-DD`), ibland felaktigt (t.ex. 1917, 1967) |
| `organizer` | Arrangör / grupp |
| `location` | Plats |
| `free_text` | Fritext (väder, antal startande, kommentarer) |
| `result_file` | Originalfilnamn i Access-databasen |
| `file_size` | Förväntad filstorlek i bytes |
| `file_type` | MIME-typ från databasen |
| `local_file` | Relativ sökväg till nedladdad fil |
| `source_url` | Legacy-URL |

---

## Innehållstyper på disk

Faktisk fördelning i `data/content/` (414 filer):

| Filtyp | Antal | Hur det visas |
|--------|------:|---------------|
| `.pdf` | 303 | Inbäddad PDF eller länk till nedladdning |
| `.xls` | 45 | Länk till nedladdning (Excel) |
| `.doc` | 42 | Länk till nedladdning (Word) |
| `.txt` | 12 | Rendera som `<pre>` eller formaterad text |
| `.html` | 6 | Rendera HTML direkt (MeOS/OE2003/Eventor) |
| `.ods` | 2 | Länk till nedladdning |
| `.docx` | 1 | Länk till nedladdning |
| `.rtf` | 1 | Länk till nedladdning |
| `.jpeg` | 1 | Visa som bild |
| `.bin` | 1 | Okänd — kontrollera manuellt |

### Innehållskategorier (renderingsstrategi)

1. **PDF (majoritet)** — skannade resultatlistor och exporterade officiella listor. Visa med `<iframe>` eller PDF.js. Ingen OCR i första versionen.

2. **HTML (6 st)** — strukturerade resultat från MeOS/OE2003/Eventor. Kan renderas direkt eller parsas till tabeller senare.

3. **Text (12 st)** — fritextlistor med placering, namn och tid. Visa som `<pre>` med monospace.

4. **Office (.doc, .xls, …)** — gamla binära Office-filer. **Länka för nedladdning** — webbläsare kan inte visa dem inline.

5. **Bild (.jpeg)** — visa inline.

### Vanligaste typer (metadata)

- Motionsorientering (~76)
- Tränings-OL (~61)
- Träningsorientering (~34)
- KM (~22)
- Klubbmästerskap (~19)
- Gatlopp (~14)

### Tidsperiod

- **2004–2026** (huvuddelen)
- Enstaka poster med misstänkt datum (1917, 1967, 1987) — troligen dataskrivfel

---

## Kända problem

### 1. Saknad fil: id=232

- **Metadata finns** (Träningsol, 2015-07-02, Gummusänget)
- **Fil:** `TräningsOL 15-07-02.bmp` (12 MB BMP-bild)
- **Fel:** HTTP 500 från legacy-servern
- **Åtgärd:** Visa eventsidan med metadata men markera "Resultat saknas". Ev. manuell räddning från backup.

### 2. `local_file` i manifest kan vara inaktuell

Många poster har `"local_file": "content/123.bin"` i manifest, men filerna har bytt namn på disk till `.doc`/`.xls` via `scripts/rename_bin_files.py`.

**Lösning vid implementation:** Slå upp fil via mönster `data/content/{id}.*` istället för att lita på `local_file`:

```typescript
function findContentFile(id: number): string | null {
  const matches = globSync(`data/content/${id}.*`);
  return matches[0] ?? null;
}
```

Alternativt: kör ett sync-script som uppdaterar `local_file` i manifest.

### 3. Inkonsekvent `type`-fält

Samma typ kan stavas olika (`Tränings ol`, `Tränings-OL`, `Träningsorientering`, `träningsorientering`). Normalisera vid visning eller skapa en mappningstabell.

---

## Förslag: Ny sajt

### Fas 1 — MVP

Mål: Ersätta legacy-sidan med något som fungerar i moderna webbläsare.

| Funktion | Beskrivning |
|----------|-------------|
| **Startsida** | Senaste resultat (kronologisk lista, nyast först) |
| **Lista** | Alla events, sorterbara på datum, typ, plats |
| **Detaljsida** | `/resultat/[id]` — metadata + visa/länka innehåll |
| **PDF** | Inline-visning i webbläsaren (iframe) |
| **HTML-resultat** | Parsa och visa som tabeller (MeOS/OE2003/Eventor) |
| **Personsökning** | Extrahera deltagarnamn, knyt ihop per person, sökbar index |
| **Personsida** | `/person/[namn]` — alla resultat för en deltagare |
| **Admin** | Enkel uppladdning: namn, typ, datum, plats, arrangör, fritext, PDF |
| **Permalänkar** | `/resultat/632` (legacy-id behålls internt) |

Läsning är **helt öppen** — ingen inloggning för besökare. Admin skyddas med **enkel lösenordsautentisering**.

### Fas 2 (senare)

- OCR av skannade PDF:er (handskrivna ark) för bättre namntäckning
- Fuzzy match av namn (Klaus Csúcs ≈ Klaus Csucs)
- Statistik (antal starter per år, personliga rekord)
- Avancerad filtrering (typ, plats, klass)

---

## Personsökning (kärnfunktion)

Mål: Användaren ska kunna söka på **"Erik Zander"** och få alla träffar — vilka lopp, datum, placering, tid — med länk till respektive resultatsida.

### Datamodell

Två indexfiler genereras vid build (eller via `scripts/extract_participants.py`):

**`data/results-index.json`** — en rad per deltagande:

```json
{
  "event_id": 35,
  "person_key": "erik-zander",
  "name": "Erik Zander",
  "club": "IFK Moras OK",
  "class": "H18",
  "place": 1,
  "time": "11:49",
  "status": null,
  "parse_source": "html",
  "parse_confidence": "high"
}
```

**`data/people-index.json`** — aggregerat per person:

```json
{
  "person_key": "erik-zander",
  "display_name": "Erik Zander",
  "result_count": 47,
  "first_date": "2004-06-23",
  "last_date": "2024-09-05",
  "event_ids": [35, 552, 632]
}
```

| Fält | Beskrivning |
|------|-------------|
| `person_key` | Normaliserat slug för URL och sök (`erik-zander`) |
| `name` / `display_name` | Originalstavning från resultatlistan |
| `parse_source` | `html`, `text`, `xls`, `pdf-text`, `pdf-ocr`, `manual` |
| `parse_confidence` | `high` / `medium` / `low` — styr om raden visas i personsök |
| `status` | `null`, `dns`, `dnf`, `felst`, `deltagit`, `ej-godkänd` |

### Namnnormalisering

```typescript
function personKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '') // csúcs → csucs
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

Samma person med olika stavningar (t.ex. `IFK Mora` vs `IFK Moras OK` som klubb) hanteras via `person_key`. Sammanfogning av nästan-identiska namn (stavfel) → fas 2.

### Extraktion per filtyp

| Format | Antal | Metod | Förväntad täckning |
|--------|------:|-------|-------------------|
| `.html` | 6 | BeautifulSoup — tabellrader, MeOS/OE2003/Eventor | **Hög** |
| `.txt` | 12 | Regex — `1. Namn Klubb 23:45`, laglistor | **Medel–hög** |
| `.xls` / `.xlsx` / `.ods` | 48 | Python (`xlrd` / `openpyxl`) — läs kolumner Namn, Tid, Plac | **Hög** |
| `.doc` / `.docx` / `.rtf` | 44 | Python (`python-docx`, `striprtf`) — tabell/text | **Medel** |
| `.pdf` (digital text) | ~150–200 | `pdfplumber` — extrahera text, regex per layout | **Medel** |
| `.pdf` (skannade) | ~100+ | Kräver OCR (Tesseract) — **fas 2** | **Låg i v1** |
| `.jpeg` | 1 | OCR — fas 2 | **Låg** |
| Saknas (id=232) | 1 | — | — |

**Realistiskt i v1:** ~60–70 % av alla starter extraheras automatiskt. Resten visas fortfarande via PDF/Office på eventsidan, men syns inte i personsök förrän de parsats.

### Extraktionsscript

```
scripts/
├── extract_participants.py   # Huvudscript — kör alla parsers
├── parsers/
│   ├── html_parser.py        # MeOS, OE2003, Eventor, LibreOffice-export
│   ├── text_parser.py        # Fritextlistor
│   ├── excel_parser.py       # .xls, .xlsx, .ods
│   ├── office_parser.py      # .doc, .docx, .rtf
│   └── pdf_parser.py         # pdfplumber + layout-heuristik
└── rebuild_index.py          # Bygger people-index från results-index
```

Kör vid build och efter admin-uppladdning:

```bash
python scripts/extract_participants.py
python scripts/rebuild_index.py
```

Logga misslyckade filer i `data/parse-errors.json` (event_id, filtyp, fel).

### Sök i webbappen

| UI | Beteende |
|----|----------|
| **Sökfält i header** | Autocomplete på `people-index` (debounced) |
| **`/sok?q=erik+zander`** | Lista alla träffar med datum, lopp, placering, tid |
| **`/person/erik-zander`** | Personsida — alla resultat kronologiskt |
| **Eventsida** | Klickbara namn → `/person/[key]` |

Sök ska matcha på:
- Förnamn, efternamn, hela namnet
- Delvis match (`Zander` → Erik Zander, Martin Zander …)

Implementation: enkel `includes()` på normaliserad sträng i v1; **Fuse.js** eller SQLite FTS om indexet blir stort.

### Admin + personsökning

När admin laddar upp ny PDF:
1. Spara fil + uppdatera `manifest.json`
2. Kör extraktion på nya filen
3. Uppdatera `results-index.json` och `people-index.json`
4. Rebuild/deploy (Netlify hook)

### Begränsningar (v1)

- Skannade/handskrivna PDF:er (t.ex. id=200) ger inga sökbara namn utan OCR
- Excel/Word med ovanlig layout kan missa rader — loggas i `parse-errors.json`
- Dubbla personer med samma namn (homonymer) visas under samma `person_key` — acceptabelt i v1
- Klubbnamn extraheras där formatet tillåter, annars `null`

---

## Tech stack (fastställd)

| Lager | Val | Motivering |
|-------|-----|------------|
| Framework | **Next.js** | React, API routes för admin, bra Netlify-stöd |
| Data | **manifest.json** + **results-index.json** + **people-index.json** | Events + sökbara deltagare |
| PDF | `<iframe>` inline + `pdfplumber` för textextraktion | Visning + namnindex |
| Styling | **Tailwind CSS** | Ren, modern design med grön accent |
| Hosting | **Netlify** | Enkel deploy, gratis tier |
| Admin-auth | Lösenordsskyddad route | Enkel lösning för uppladdning |
| Språk | Enbart svenska | — |

---

## URL-struktur

```
/                          → Senaste resultat (kronologisk lista)
/sok?q=erik+zander         → Personsök — alla träffar
/person/erik-zander        → Alla resultat för en person
/resultat                  → Alla lopp/events
/resultat/632              → Enskilt resultat
/admin                     → Lägg till resultat (lösenordsskyddat)
/om                        → Info om Resultatbanken
```

**Legacy-redirect:** Nej — nya URL:er räcker. Gamla `Getresultat.asp?id=X`-länkar behöver inte fungera.

---

## Implementation — steg för steg

### Steg 1: Data-lager

```typescript
// lib/events.ts
import manifest from '../data/manifest.json';

export type Event = {
  id: number;
  name: string;
  type: string;
  date: string;
  organizer: string;
  location: string;
  free_text: string;
  result_file: string;
  file_size: number | null;
  file_type: string;
  source_url: string;
  local_file: string | null;
  downloaded_at: string | null;
};

export function getAllEvents(): Event[] {
  return manifest as Event[];
}

export function getEvent(id: number): Event | undefined {
  return getAllEvents().find(e => e.id === id);
}

export function getContentPath(id: number): string | null {
  // Använd glob/fs — se avsnitt "Kända problem"
}
```

### Steg 2: Visningskomponent per filtyp

```typescript
function ResultContent({ event, filePath }: Props) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.pdf':
      return <iframe src={filePath} className="w-full h-[80vh]" />;
    case '.html':
      return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
    case '.txt':
      return <pre className="whitespace-pre-wrap">{textContent}</pre>;
    case '.jpeg':
    case '.jpg':
      return <img src={filePath} alt={event.name} />;
    default:
      return <a href={filePath} download>Ladda ner {event.result_file}</a>;
  }
}
```

### Steg 3: Listvy

- Sortera på `date` descending (default) — **viktigast för användare**
- Gruppera per år
- Filter på typ/plats/personnamn → fas 2

### Steg 4: Design

- Ren och modern, neutral design med grön accent
- Responsiv på mobil
- Tydlig metadata-rad: datum, plats, arrangör, typ

### Steg 5: Admin (`/admin`)

Fält (samma som gamla sidan):

| Fält | Typ |
|------|-----|
| Träningsnamn | text |
| Typ | select (Motionsorientering, Tränings-OL, KM, …) |
| Datum | date |
| Plats | text |
| Arrangör | text |
| Fritext | textarea |
| Resultatfil | PDF-uppladdning |

Skyddad med lösenord (env-variabel `ADMIN_PASSWORD` på Netlify).

---

## Exempel på events att testa med

| ID | Typ | Innehåll | Användning |
|----|-----|----------|------------|
| 632 | PDF | Träningsorientering 2026 | Senaste PDF |
| 552 | PDF | 25-mannaträning 2024 | Eventor-export |
| 200 | PDF | Skannat handskrivet ark 2004 | Gammalt arkiv |
| 35 | HTML | Sprint-KM 2005 (OE2003) | Strukturerad HTML |
| 2 | TXT | Gängbudkavel 2004 | Fritextlista |
| 6 | XLS | Excel-resultat | Nedladdningslänk |
| 232 | — | Saknas | Felhantering |

---

## Legacy-system (referens)

| ASP-sida | Syfte |
|----------|--------|
| `resultatbanken.asp` | Huvudsida (frames — trasig) |
| `sok.asp` | Lista alla resultat |
| `Getresultat.asp?id=X` | Visa/ladda resultat |
| `Main.asp` | Lägg till nytt resultat |
| `meny.asp` | Navigering |

Ny sajt behöver inte ASP, Access eller frames. All data ligger lokalt.

---

## Fastställda beslut

| Fråga | Beslut |
|-------|--------|
| Hosting | **Netlify** |
| Framework | **Next.js** |
| Design | Ren och modern, grön accent |
| Språk | Enbart svenska |
| Läsning | Helt öppen (ingen inloggning) |
| Admin v1 | Ja — enkel uppladdning (metadata + PDF) |
| Admin-auth | Lösenordsskyddad sida |
| Admin-fält | Samma som gamla sidan |
| PDF | Inline i webbläsaren |
| Legacy-URL:er | Ingen redirect behövs |
| Prioritet v1 | Kronologisk lista + **personsökning** |
| HTML-parsing | Ja i v1 (6 HTML-filer → tabeller + namnindex) |
| Text/Excel/Office | Parsa och indexera deltagarnamn i v1 |
| PDF | Inline + textextraktion (`pdfplumber`); OCR för skannade → fas 2 |
| Personsökning | **Ja i v1** — kärnfunktion |

---

## Nästa steg

1. Initiera Next.js-projekt (t.ex. under `web/`)
2. **`scripts/extract_participants.py`** — extrahera namn från HTML, text, Excel, Office, PDF
3. Generera `results-index.json` + `people-index.json`
4. Implementera lista, detaljsida, **personsök** och **personsida**
5. PDF inline + klickbara namn på eventsidor
6. Admin-sida med uppladdning + omindexering
7. Deploy till Netlify
