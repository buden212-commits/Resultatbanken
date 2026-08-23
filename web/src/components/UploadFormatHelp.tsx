export function UploadFormatHelp() {
  return (
    <details className="card group">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-slate-800 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          <span>Hjälp: så ska resultatfilen vara uppbyggd</span>
          <span
            aria-hidden
            className="text-slate-400 transition group-open:rotate-180"
          >
            ▾
          </span>
        </span>
      </summary>

      <div className="space-y-6 border-t border-slate-100 px-5 py-5 text-sm text-slate-700">
        <section className="space-y-2">
          <h3 className="font-medium text-slate-900">Filformat</h3>
          <p>
            Du kan ladda upp PDF, Excel (.xlsx, .xls, .ods), HTML, text (.txt), Word
            (.doc, .docx) eller bild. För bäst resultat:{" "}
            <strong className="font-medium text-slate-900">Excel eller en textbaserad PDF</strong>{" "}
            där texten går att markera (inte en skannad bild). Exporter från MeOS och
            OE2003 (HTML) fungerar oftast direkt.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium text-slate-900">Grundprinciper</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="font-medium text-slate-900">En rad per deltagare</strong> — namn,
              tid och eventuell placering på samma rad.
            </li>
            <li>
              <strong className="font-medium text-slate-900">Klassrubriker på egen rad</strong>{" "}
              före deltagarna i klassen, t.ex. <code className="rounded bg-slate-100 px-1">Mellan bana</code>{" "}
              eller <code className="rounded bg-slate-100 px-1">Blå bana 5,4 km</code>.
            </li>
            <li>
              <strong className="font-medium text-slate-900">Tider</strong> i format{" "}
              <code className="rounded bg-slate-100 px-1">mm:ss</code> eller{" "}
              <code className="rounded bg-slate-100 px-1">hh:mm:ss</code>, t.ex.{" "}
              <code className="rounded bg-slate-100 px-1">34:20</code> eller{" "}
              <code className="rounded bg-slate-100 px-1">00:34:20</code>.
            </li>
            <li>
              Deltagare <strong className="font-medium text-slate-900">utan tid</strong> skrivs med{" "}
              <code className="rounded bg-slate-100 px-1">Deltagit</code> efter namnet.
            </li>
            <li>
              Använd <strong className="font-medium text-slate-900">hela namn</strong> (för- och
              efternamn) när det går — det underlättar personsökning och statistik.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="font-medium text-slate-900">Rekommenderat: Excel med kolumnrubriker</h3>
          <p>
            Det enklaste sättet att skapa en fil som importeras korrekt är en tabell med
            tydliga kolumnnamn. Klass kan ligga i en kolumn eller som avsnittsrubrik mellan
            raderna.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">
{`Plac   Namn                 Klass          Tid
1      Anna Andersson       Mellan bana    00:34:20
2      Erik Eriksson        Mellan bana    00:39:13
       Lisa Holm            Mellan bana    Deltagit
1      Tage Bratt           Kort bana      00:24:40
2      Sven-Åke Persson     Kort bana      00:33:38`}
          </pre>
          <p className="text-xs text-slate-500">
            Kolumnnamn som känns igen: Plac/Placering, Namn, Klass/Kategori/Bana, Tid,
            Klubb. Placering kan utelämnas vid träningar utan placering.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="font-medium text-slate-900">Alternativ: textfil eller PDF med listformat</h3>
          <p>
            Fungerar bra för träningsorientering och enklare resultatlistor. Skriv
            klassrubriken först, sedan en rad per deltagare.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">
{`Nybörjarbana
Martin Bratt Deltagit
Alma Bratt Deltagit

Kort bana
Tage Bratt 00:24:40
Sven-Åke Persson 00:33:38

Mellan bana
Tony Karlsson 00:24:11
Erik Eriksson 00:30:10
Elin Wrahme Deltagit

Lång bana
Thomas Hermansson 00:28:03
Alice Eggöy-Markhester Deltagit`}
          </pre>
          <p className="text-xs text-slate-500">
            Med placering (t.ex. vid tävling):{" "}
            <code className="rounded bg-slate-100 px-1">1. Anna Andersson 45:23</code>
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium text-slate-900">Status och specialfall</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code className="rounded bg-slate-100 px-1">Deltagit</code> — deltog utan tid
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">DNS</code> /{" "}
              <code className="rounded bg-slate-100 px-1">Ej start</code> — startade inte
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">DNF</code> — startade men gick inte i mål
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">Ej godkänd</code> /{" "}
              <code className="rounded bg-slate-100 px-1">Felstämplat</code> — ogiltig tid
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium text-slate-900">Undvik om möjligt</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Skannade bilder utan tydlig text (OCR ger sämre kvalitet)</li>
            <li>Ungefärliga tider som &quot;cirka 46 min&quot; — ange tid eller Deltagit</li>
            <li>Flera deltagare på samma rad utan tydlig struktur</li>
            <li>Blandade kolumnformat utan rubriker i samma fil</li>
          </ul>
        </section>
      </div>
    </details>
  );
}
