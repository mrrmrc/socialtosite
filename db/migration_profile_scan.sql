-- Aggiunge il profilo sintetico/editabile generato dalla scansione social.
-- Esegui su database esistenti gia' creati con db/schema.sql.

ALTER TABLE sites
  ADD COLUMN profile_summary TEXT AFTER avatar_url;
