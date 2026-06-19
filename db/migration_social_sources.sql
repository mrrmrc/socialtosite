-- Aggiunge sorgenti/canali social per utente e link originale dei contenuti.
-- Esegui su database esistenti gia' creati con db/schema.sql.

CREATE TABLE IF NOT EXISTS social_sources (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  platform      VARCHAR(50) NOT NULL,
  label         VARCHAR(255),
  url           TEXT NOT NULL,
  topic_summary TEXT,
  active        TINYINT DEFAULT 1,
  created_at    DATETIME DEFAULT NOW(),
  UNIQUE KEY unique_user_source (user_id, platform, url(191)),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE posts
  ADD COLUMN source_url TEXT AFTER media_type;
