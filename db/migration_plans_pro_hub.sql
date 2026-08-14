-- LinkSeoWeb — normalizzazione piani commerciali
-- Piani supportati: base, pro, agency

ALTER TABLE users
  MODIFY COLUMN plan VARCHAR(20) NOT NULL DEFAULT 'base';

UPDATE users
   SET plan = 'base'
 WHERE plan IS NULL
    OR TRIM(plan) = ''
    OR LOWER(TRIM(plan)) IN ('free', 'starter');

UPDATE users
   SET plan = LOWER(TRIM(plan))
 WHERE LOWER(TRIM(plan)) IN ('base', 'pro', 'agency');

-- Utente pilota della versione Pro.
UPDATE users
   SET plan = 'pro'
 WHERE LOWER(TRIM(name)) = LOWER('Maurizio Bottino');

-- Indici utili per Hub e amministrazione con molte utenze.
CREATE INDEX idx_users_plan ON users(plan);
CREATE INDEX idx_sites_visibility_sync ON sites(search_visible, last_sync);
