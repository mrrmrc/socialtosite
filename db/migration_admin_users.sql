-- Aggiunge il ruolo utente per abilitare l'area amministrativa.
-- Esegui su database esistenti gia' creati con db/schema.sql.

ALTER TABLE users
  ADD COLUMN role VARCHAR(20) DEFAULT 'user' AFTER slug;

-- Scegli almeno un amministratore sostituendo l'email qui sotto.
UPDATE users
SET role = 'admin'
WHERE email = 'admin@example.com';
