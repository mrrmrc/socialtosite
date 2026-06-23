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
  source_url        TEXT,
  published_at      DATETIME,
  imported_at       DATETIME DEFAULT NOW(),
  content_hash      CHAR(64),
  relevance_score   INT DEFAULT 0,
  agent_notes       TEXT,
  seo_score         INT DEFAULT 0,
  slug              VARCHAR(255),
  published         TINYINT DEFAULT 1,
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
  menu_links    TEXT,
  footer_text   TEXT,
  accent_color  VARCHAR(50),
  header_layout VARCHAR(50) DEFAULT 'standard',
  custom_css    TEXT,
  profile_summary TEXT,
  role_mission  TEXT,
  content_strategy TEXT,
  custom_domain VARCHAR(255),
  theme         VARCHAR(50) DEFAULT 'classic',
  seo_score     INT DEFAULT 0,
  generated_layouts LONGTEXT,
  site_ai_data  LONGTEXT,
  last_sync     DATETIME,
  created_at    DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_prompts (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  agent_name     VARCHAR(50) UNIQUE NOT NULL,
  instructions   TEXT NOT NULL
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
