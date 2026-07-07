-- ════════════════════════════════════════════════════
--  UNIC Academic — Hasura/Postgres schema
--  Run this in Hasura Console → Data → SQL (or via psql)
-- ════════════════════════════════════════════════════

-- Registrations (welcome modal sign-ups)
CREATE TABLE IF NOT EXISTS registrations (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  email       TEXT,
  mobile      TEXT,
  source      TEXT,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(email);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at DESC);

-- Question attempts (every Check Answer click)
CREATE TABLE IF NOT EXISTS attempts (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  question_id  TEXT NOT NULL,
  subject      TEXT NOT NULL,
  chapter_id   TEXT NOT NULL,
  question_type TEXT,
  selected     JSONB,
  correct      JSONB,
  is_correct   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_subject ON attempts(subject);
CREATE INDEX IF NOT EXISTS idx_attempts_created_at ON attempts(created_at DESC);

-- Subject content (units → chapters → concept + questions), stored as JSONB.
-- One row per subject code (PH, CH, MA, BIO, ...). Edited via the Admin
-- Question Builder UI in admin.html, and read by the main app as a fallback
-- when no local /data/<subject>.json override is found.
CREATE TABLE IF NOT EXISTS subject_content (
  code        TEXT PRIMARY KEY,        -- e.g. 'PH', 'CH', 'MA', 'BIO'
  subject     TEXT NOT NULL,           -- display name, e.g. 'Physics'
  color       TEXT,
  data        JSONB NOT NULL,          -- full { subject, code, color, units:[...] } document
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── After creating these tables, in Hasura Console: ──
-- 1. Go to Data → track all three tables (registrations, attempts, subject_content)
-- 2. Go to Settings → set up an admin secret (HASURA_ADMIN_SECRET)
-- 3. (Optional) Add permissions if you expose GraphQL directly to the browser.
--    This project calls Hasura only from serverless functions using the
--    admin secret, so public permissions are not required.
