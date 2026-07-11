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

export type ResultRow = {
  event_id: number;
  person_key: string;
  name: string;
  club: string | null;
  class_name: string | null;
  place: number | null;
  time: string | null;
  status: string | null;
  parse_source: string;
  parse_confidence: string;
};

export type PersonResult = {
  event_id: number;
  event_name: string;
  date: string | null;
  location: string;
  type: string;
  class_name: string | null;
  place: number | null;
  time: string | null;
  status: string | null;
};

export type Person = {
  person_key: string;
  display_name: string;
  result_count: number;
  first_date: string | null;
  last_date: string | null;
  event_ids: number[];
  results: PersonResult[];
};
