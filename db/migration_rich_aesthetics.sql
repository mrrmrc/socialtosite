-- Aggiunge campi per personalizzazione layout, cover, menu e footer.
-- Esegui su database esistenti gia' creati.

ALTER TABLE sites
  ADD COLUMN cover_url TEXT AFTER avatar_url,
  ADD COLUMN logo_url TEXT AFTER cover_url,
  ADD COLUMN menu_links TEXT AFTER logo_url,
  ADD COLUMN footer_text TEXT AFTER menu_links,
  ADD COLUMN accent_color VARCHAR(50) AFTER footer_text,
  ADD COLUMN header_layout VARCHAR(50) DEFAULT 'standard' AFTER accent_color,
  ADD COLUMN custom_css TEXT AFTER header_layout;
