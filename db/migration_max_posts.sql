-- Migration: limite massimo post importati per canale (max_posts)
-- Le colonne sono già create a runtime dall'endpoint pubblico ?action=migrate,
-- ma qui restano versionate per l'import manuale dello schema.
-- Idempotente su MySQL 8+ grazie a IF NOT EXISTS.

ALTER TABLE social_sources     ADD COLUMN IF NOT EXISTS max_posts INT NULL AFTER since_date;
ALTER TABLE social_connections ADD COLUMN IF NOT EXISTS max_posts INT NULL AFTER since_date;
