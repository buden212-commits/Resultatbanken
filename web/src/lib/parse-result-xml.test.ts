import { describe, expect, it } from "vitest";

import { parseResultListXml } from "./parse-result-xml";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<ResultList xmlns="http://www.orienteering.org/datastandard/3.0">
  <ClassResult>
    <Class><Name>H21</Name></Class>
    <PersonResult>
      <Person>
        <Name><Given>Anna</Given><Family>Andersson</Family></Name>
      </Person>
      <Organisation><Name>IFK Mora OK</Name></Organisation>
      <Result>
        <Time>2145</Time>
        <ResultPosition>1</ResultPosition>
        <Status>OK</Status>
      </Result>
    </PersonResult>
    <PersonResult>
      <Person>
        <Name><Given>Bosse</Given><Family>Berg</Family></Name>
      </Person>
      <Organisation><ShortName>IFK Mora</ShortName></Organisation>
      <Result>
        <Status>DidNotStart</Status>
      </Result>
    </PersonResult>
  </ClassResult>
</ResultList>`;

describe("parseResultListXml", () => {
  it("parses IOF ResultList rows", () => {
    const rows = parseResultListXml(SAMPLE, 640);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      event_id: 640,
      name: "Anna Andersson",
      person_key: "anna-andersson",
      club: "IFK Mora OK",
      class_name: "H21",
      place: 1,
      time: "35:45",
      status: null,
      parse_source: "xml_eventor",
    });
    expect(rows[1]).toMatchObject({
      name: "Bosse Berg",
      club: "IFK Mora",
      status: "dns",
      place: null,
      time: null,
    });
  });
});
