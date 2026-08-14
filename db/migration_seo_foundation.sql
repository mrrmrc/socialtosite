ALTER TABLE sites
  ADD COLUMN seo_foundation LONGTEXT NULL AFTER site_understanding_corrections,
  ADD COLUMN seo_foundation_hash CHAR(64) NULL AFTER seo_foundation,
  ADD COLUMN seo_foundation_updated_at DATETIME NULL AFTER seo_foundation_hash;
