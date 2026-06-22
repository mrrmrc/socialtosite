-- Aggiunge la colonna since_date per permettere la retroattività selettiva
ALTER TABLE social_connections ADD COLUMN since_date DATE NULL;
ALTER TABLE social_sources ADD COLUMN since_date DATE NULL;
