-- Eseguire separatamente nel database staging e nel database produzione.
-- Aggiorna soltanto l'email dell'amministratore indicato e revoca le sue sessioni.
-- La password, lo slug, i contenuti e gli altri utenti restano invariati.
-- Se l'indirizzo di destinazione appartiene già a un altro utente, il vincolo
-- UNIQUE impedisce l'aggiornamento: non eliminare o unire gli account.
START TRANSACTION;
SELECT id,email,slug,role FROM users
WHERE email IN ('admin','admin@allsocialtoweb.com','mail@ideesitiweb.it');
UPDATE users
SET email='mail@ideesitiweb.it',token_version=token_version+1
WHERE role='admin' AND (email='admin@allsocialtoweb.com' OR (email='admin' AND slug='admin'));
SELECT ROW_COUNT() AS amministratori_aggiornati;
SELECT id,email,slug,role FROM users WHERE email='mail@ideesitiweb.it' AND role='admin';
COMMIT;
