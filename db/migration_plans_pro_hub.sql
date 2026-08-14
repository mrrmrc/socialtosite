-- LinkSeoWeb — normalizzazione piani commerciali
-- Piani supportati: base, professional, agency

ALTER TABLE users
  MODIFY COLUMN plan VARCHAR(20) NOT NULL DEFAULT 'base';

UPDATE users
   SET plan = 'base'
 WHERE plan IS NULL
    OR TRIM(plan) = ''
    OR LOWER(TRIM(plan)) IN ('free', 'starter');

UPDATE users
   SET plan = 'professional'
 WHERE LOWER(TRIM(plan)) = 'pro';

UPDATE users
   SET plan = LOWER(TRIM(plan))
 WHERE LOWER(TRIM(plan)) IN ('base', 'professional', 'agency');

-- Qualunque valore legacy/non riconosciuto torna al piano base.
UPDATE users
   SET plan = 'base'
 WHERE LOWER(TRIM(plan)) NOT IN ('base', 'professional', 'agency');

-- Utente pilota della versione Professional.
UPDATE users
   SET plan = 'professional'
 WHERE LOWER(TRIM(name)) = LOWER('Maurizio Bottino');

-- Indici utili per Hub e amministrazione con molte utenze.
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);
CREATE INDEX IF NOT EXISTS idx_sites_visibility_sync ON sites(search_visible, last_sync);
