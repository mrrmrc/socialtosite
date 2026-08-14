-- Aggiunge campi per agente editoriale, deduplica semantica e layout sito.
-- Esegui su database esistenti gia' creati con db/schema.sql.

ALTER TABLE posts
  ADD COLUMN content_hash CHAR(64) AFTER imported_at,
  ADD COLUMN relevance_score INT DEFAULT 0 AFTER content_hash,
  ADD COLUMN agent_notes TEXT AFTER relevance_score;

ALTER TABLE sites
  ADD COLUMN role_mission TEXT AFTER profile_summary,
  ADD COLUMN content_strategy TEXT AFTER role_mission,
  MODIFY COLUMN theme VARCHAR(50) DEFAULT 'classic';
