-- Migrazione additiva: eseguire esplicitamente dopo backup. Nessuna modifica
-- al vincolo sites.user_id finché tutti i percorsi legacy non sono isolati.
CREATE TABLE IF NOT EXISTS publication_connections (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 user_id INT NOT NULL,
 site_id INT NOT NULL,
 provider VARCHAR(24) NOT NULL,
 label VARCHAR(120) NOT NULL,
 endpoint VARCHAR(1000) NOT NULL,
 secret_ciphertext TEXT NOT NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'pending',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY publication_site_provider (site_id, provider),
 FOREIGN KEY (user_id) REFERENCES users(id),
 FOREIGN KEY (site_id) REFERENCES sites(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS publication_jobs (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 user_id INT NOT NULL,
 connection_id BIGINT NOT NULL,
 post_id INT NOT NULL,
 delivery_key CHAR(64) NOT NULL,
 payload LONGTEXT NOT NULL,
 payload_hash CHAR(64) NOT NULL,
 state VARCHAR(24) NOT NULL DEFAULT 'queued',
 action VARCHAR(16) NOT NULL DEFAULT 'draft',
 attempts INT NOT NULL DEFAULT 0,
 lease_token CHAR(32) NULL,
 lease_until DATETIME NULL,
 next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 remote_id BIGINT NULL,
 remote_url TEXT NULL,
 last_error VARCHAR(500) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY publication_delivery (delivery_key),
 UNIQUE KEY publication_post_destination (connection_id, post_id),
 KEY publication_queue (state, next_attempt_at),
 FOREIGN KEY (user_id) REFERENCES users(id),
 FOREIGN KEY (connection_id) REFERENCES publication_connections(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS publication_events (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 job_id BIGINT NOT NULL,
 state VARCHAR(24) NOT NULL,
 message VARCHAR(500) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (job_id) REFERENCES publication_jobs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
