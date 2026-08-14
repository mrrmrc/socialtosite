-- migration_auth_hardening.sql — Protezione del login (rilievo A7)
--
-- 1. login_attempts: traccia i tentativi falliti per bloccare gli attacchi a
--    dizionario, che oggi possono girare senza incontrare resistenza.
-- 2. users.token_version: permette di invalidare TUTTI i token già emessi per
--    un utente incrementando un numero. Senza, un token rubato resta valido
--    fino alla scadenza e non esiste modo di revocarlo.

CREATE TABLE IF NOT EXISTS login_attempts (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  email        VARCHAR(255) NOT NULL,
  ip           VARCHAR(45) NOT NULL,
  succeeded    TINYINT NOT NULL DEFAULT 0,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_attempts_email_time (email, attempted_at),
  INDEX idx_login_attempts_ip_time (ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0;

-- Interruttore "Fatti trovare da Google", per sito.
-- Default 1: i siti già online restano visibili, nessuno viene deindicizzato
-- di soppiatto dall'applicazione della migrazione.
ALTER TABLE sites ADD COLUMN search_visible TINYINT NOT NULL DEFAULT 1;
