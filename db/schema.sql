-- LinkSeoWeb — Schema MySQL
-- Esegui questo file una volta sul tuo hosting via phpMyAdmin

CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  name       VARCHAR(255),
  slug       VARCHAR(100) UNIQUE,
  role       VARCHAR(20) DEFAULT 'user',
  plan       VARCHAR(20) DEFAULT 'base',
  token_version INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT NOW()
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

-- Nuovo nucleo Content Import: conserva esclusivamente sorgenti, esecuzioni
-- di acquisizione e payload originali. Le tabelle legacy restano separate.
CREATE TABLE IF NOT EXISTS content_sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  platform VARCHAR(30) NOT NULL,
  label VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  url_hash CHAR(64) NOT NULL,
  since_date DATE NULL,
  acquisition_limit INT NOT NULL DEFAULT 500,
  status VARCHAR(30) NOT NULL DEFAULT 'ready',
  last_message TEXT NULL,
  last_import_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_content_source (user_id, url_hash),
  KEY source_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS import_runs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  source_id INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  phase VARCHAR(30) NOT NULL DEFAULT 'queued',
  message VARCHAR(500) NOT NULL DEFAULT 'Acquisizione in coda',
  found_count INT NOT NULL DEFAULT 0,
  imported_count INT NOT NULL DEFAULT 0,
  duplicate_count INT NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY run_user (user_id, created_at),
  KEY run_source (source_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS raw_contents (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  source_id INT NOT NULL,
  import_run_id BIGINT NULL,
  platform VARCHAR(30) NOT NULL,
  external_id VARCHAR(255) NULL,
  source_url TEXT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  title TEXT NULL,
  body_text LONGTEXT NULL,
  media_url TEXT NULL,
  image_urls LONGTEXT NULL,
  media_type VARCHAR(40) NULL,
  post_status VARCHAR(30) NOT NULL DEFAULT 'potential',
  published_at DATETIME NULL,
  raw_payload LONGTEXT NOT NULL,
  imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_raw_content (user_id, source_id, content_hash),
  KEY raw_user_date (user_id, imported_at),
  KEY raw_source (source_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE CASCADE,
  FOREIGN KEY (import_run_id) REFERENCES import_runs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_content_profiles (
  user_id INT PRIMARY KEY,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  display_name VARCHAR(255) NULL,
  activity_type VARCHAR(255) NULL,
  summary TEXT NULL,
  audiences LONGTEXT NULL,
  topics LONGTEXT NULL,
  tone VARCHAR(255) NULL,
  goals LONGTEXT NULL,
  locations LONGTEXT NULL,
  offers LONGTEXT NULL,
  evidence LONGTEXT NULL,
  confidence DECIMAL(5,4) NOT NULL DEFAULT 0,
  source_count INT NOT NULL DEFAULT 0,
  content_count INT NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  generated_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS profile_questions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  question_key VARCHAR(100) NOT NULL,
  question TEXT NOT NULL,
  reason TEXT NULL,
  answer TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_profile_question (user_id, question_key),
  KEY profile_question_user (user_id, status),
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
  edited_title      VARCHAR(255),
  edited_body       LONGTEXT,
  edited_excerpt    TEXT,
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
  design_prompt LONGTEXT,
  last_sync     DATETIME,
  created_at    DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_prompts (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  agent_name     VARCHAR(50) UNIQUE NOT NULL,
  instructions   TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_attempts (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  email        VARCHAR(255) NOT NULL,
  ip           VARCHAR(45) NOT NULL,
  succeeded    TINYINT NOT NULL DEFAULT 0,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_attempts_email_time (email, attempted_at),
  INDEX idx_login_attempts_ip_time (ip, attempted_at)
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
