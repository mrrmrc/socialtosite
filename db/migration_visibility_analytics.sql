CREATE TABLE IF NOT EXISTS site_events (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  post_id       INT NULL,
  event_type    VARCHAR(40) NOT NULL,
  path          VARCHAR(1024) NOT NULL,
  target_url    VARCHAR(2048) NULL,
  referrer_host VARCHAR(255) NULL,
  visitor_hash  CHAR(64) NULL,
  occurred_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_site_events_user_date (user_id, occurred_at),
  INDEX idx_site_events_user_type_date (user_id, event_type, occurred_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS seo_search_details (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  record_date DATE NOT NULL,
  page_url    VARCHAR(1024) NOT NULL,
  query_text  VARCHAR(255) NOT NULL DEFAULT '',
  impressions INT NOT NULL DEFAULT 0,
  clicks      INT NOT NULL DEFAULT 0,
  ctr         FLOAT NOT NULL DEFAULT 0,
  position    FLOAT NOT NULL DEFAULT 0,
  INDEX idx_seo_details_user_date (user_id, record_date),
  INDEX idx_seo_details_user_page (user_id, page_url(191)),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS analytics_schema_migrations (
  migration_key VARCHAR(100) PRIMARY KEY,
  applied_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
