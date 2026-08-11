-- SocialToSite — Schema MySQL
-- Esegui questo file una volta sul tuo hosting via phpMyAdmin

CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  name       VARCHAR(255),
  slug       VARCHAR(100) UNIQUE,
  role       VARCHAR(20) DEFAULT 'user',
  plan       VARCHAR(20) DEFAULT 'free',
  created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS social_connections (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  platform      VARCHAR(50) NOT NULL,
  platform_uid  VARCHAR(255),
  handle        VARCHAR(255),
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    DATETIME,
  connected_at  DATETIME DEFAULT NOW(),
  active        TINYINT DEFAULT 1,
  since_date    DATE NULL,
  auto_publish  TINYINT DEFAULT 1,
  auto_sync     TINYINT DEFAULT 1,
  max_posts     INT NULL,
  UNIQUE KEY unique_user_platform (user_id, platform),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS social_sources (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  platform      VARCHAR(50) NOT NULL,
  label         VARCHAR(255),
  url           TEXT NOT NULL,
  topic_summary TEXT,
  active        TINYINT DEFAULT 1,
  since_date    DATE NULL,
  auto_publish  TINYINT DEFAULT 1,
  auto_sync     TINYINT DEFAULT 1,
  max_posts     INT NULL,
  created_at    DATETIME DEFAULT NOW(),
  UNIQUE KEY unique_user_source (user_id, platform, url(191)),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS posts (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  user_id           INT NOT NULL,
  platform          VARCHAR(50) NOT NULL,
  platform_post_id  VARCHAR(255),
  raw_content       TEXT,
  transcript        TEXT,
  generated_title   VARCHAR(255),
  generated_body    LONGTEXT,
  generated_excerpt TEXT,
  tags              TEXT,
  meta_description  VARCHAR(255),
  media_url         TEXT,
  media_type        VARCHAR(50),
  media_display_width TINYINT UNSIGNED NULL,
  media_alignment   VARCHAR(20) NOT NULL DEFAULT 'center',
  noindex           TINYINT NOT NULL DEFAULT 0,
  source_url        TEXT,
  published_at      DATETIME,
  imported_at       DATETIME DEFAULT NOW(),
  content_hash      CHAR(64),
  relevance_score   INT DEFAULT 0,
  agent_notes       TEXT,
  seo_score         INT DEFAULT 0,
  processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  processing_started_at DATETIME NULL,
  processing_attempts INT NOT NULL DEFAULT 0,
  processing_error  TEXT,
  slug              VARCHAR(255),
  published         TINYINT DEFAULT 1,
  featured          TINYINT DEFAULT 0,
  UNIQUE KEY unique_post (user_id, platform, platform_post_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sites (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNIQUE NOT NULL,
  title         VARCHAR(255),
  bio           TEXT,
  avatar_url    TEXT,
  cover_url     TEXT,
  logo_url      TEXT,
  brand_visual_mode VARCHAR(20) NOT NULL DEFAULT 'logo',
  menu_links    TEXT,
  footer_text   TEXT,
  accent_color  VARCHAR(50),
  accent_secondary VARCHAR(50),
  header_layout VARCHAR(50) DEFAULT 'standard',
  custom_css    TEXT,
  hero_tagline  TEXT,
  cta_text      TEXT,
  profile_summary TEXT,
  role_mission  TEXT,
  content_strategy TEXT,
  rag_knowledge LONGTEXT,
  custom_domain VARCHAR(255),
  theme         VARCHAR(50) DEFAULT 'classic',
  search_visible TINYINT NOT NULL DEFAULT 1,
  seo_score     INT DEFAULT 0,
  generated_layouts LONGTEXT,
  site_ai_data  LONGTEXT,
  design_archetype VARCHAR(100),
  harmonize_agent VARCHAR(50) DEFAULT 'content_editor',
  account_type VARCHAR(50) DEFAULT 'business',
  editorial_dna LONGTEXT,
  editorial_memory LONGTEXT,
  editorial_engine_state LONGTEXT,
  editorial_settings LONGTEXT,
  dismissed_content_ideas LONGTEXT,
  editorial_last_run DATETIME,
  site_understanding LONGTEXT,
  site_understanding_corrections LONGTEXT,
  seo_foundation LONGTEXT,
  seo_foundation_hash CHAR(64),
  seo_foundation_updated_at DATETIME,
  reachability_profile LONGTEXT,
  reachability_updated_at DATETIME,
  gsc_verification VARCHAR(255),
  last_sync     DATETIME,
  created_at    DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_prompts (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  agent_name     VARCHAR(50) UNIQUE NOT NULL,
  instructions   TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS seo_analytics (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  record_date DATE NOT NULL,
  impressions INT DEFAULT 0,
  clicks      INT DEFAULT 0,
  ctr         FLOAT DEFAULT 0,
  position    FLOAT DEFAULT 0,
  UNIQUE KEY unique_user_seo_date (user_id, record_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE TABLE IF NOT EXISTS sync_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,
  platform    VARCHAR(50),
  status      VARCHAR(20),
  posts_found INT DEFAULT 0,
  posts_new   INT DEFAULT 0,
  error       TEXT,
  ran_at      DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
