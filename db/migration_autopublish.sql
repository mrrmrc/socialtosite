ALTER TABLE social_sources ADD COLUMN auto_publish TINYINT DEFAULT 1 AFTER since_date;
ALTER TABLE social_connections ADD COLUMN auto_publish TINYINT DEFAULT 1 AFTER since_date;
