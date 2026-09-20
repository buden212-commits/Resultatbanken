-- Resultatbanken hybrid store (Postgres / PGlite)

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  organizer TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  free_text TEXT NOT NULL DEFAULT '',
  result_file TEXT NOT NULL DEFAULT '',
  file_size INTEGER,
  file_type TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  local_file TEXT,
  content_url TEXT,
  downloaded_at TEXT
);

CREATE TABLE IF NOT EXISTS results (
  id BIGSERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_key TEXT NOT NULL,
  name TEXT NOT NULL,
  club TEXT,
  class_name TEXT,
  place INTEGER,
  time TEXT,
  status TEXT,
  parse_source TEXT NOT NULL DEFAULT '',
  parse_confidence TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS results_event_id_idx ON results(event_id);
CREATE INDEX IF NOT EXISTS results_person_key_idx ON results(person_key);

-- JSON documents: people-index, person-aliases, type-aliases,
-- stats-exclusions, mastarnas
CREATE TABLE IF NOT EXISTS app_documents (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
