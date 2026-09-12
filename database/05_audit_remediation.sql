-- M-007: Voice pending retry columns + daily_activity_log index (audit remediation)
SET @m007_col_exists = (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pending_voice_messages'
    AND COLUMN_NAME = 'attempt_count'
);
SET @m007_sql = IF(
  @m007_col_exists = 0,
  'ALTER TABLE pending_voice_messages
     ADD COLUMN attempt_count INT NOT NULL DEFAULT 0,
     ADD COLUMN last_attempt_at TIMESTAMP NULL DEFAULT NULL,
     ADD COLUMN next_retry_at TIMESTAMP NULL DEFAULT NULL',
  'SELECT "M-007: pending_voice_messages retry columns already exist" AS migration_status'
);
PREPARE m007_stmt FROM @m007_sql;
EXECUTE m007_stmt;
DEALLOCATE PREPARE m007_stmt;

SET @m007_idx_exists = (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'daily_activity_log'
    AND INDEX_NAME = 'idx_dal_activity_date'
);
SET @m007_idx_sql = IF(
  @m007_idx_exists = 0,
  'ALTER TABLE daily_activity_log ADD INDEX idx_dal_activity_date (activity_date)',
  'SELECT "M-007: idx_dal_activity_date already exists" AS migration_status'
);
PREPARE m007_idx_stmt FROM @m007_idx_sql;
EXECUTE m007_idx_stmt;
DEALLOCATE PREPARE m007_idx_stmt;

-- Analytics: ai_response_times (moved from request-path DDL)
CREATE TABLE IF NOT EXISTS ai_response_times (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NULL,
  duration_ms INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_art_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chat quotas (deploy-time schema — no request-path DDL)
CREATE TABLE IF NOT EXISTS chat_quota (
  session_id VARCHAR(191) NOT NULL,
  quota_date DATE NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, quota_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_ip_quota (
  ip_hash VARCHAR(64) NOT NULL,
  quota_date DATE NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, quota_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ad_direct_link_quota (
  quota_key VARCHAR(191) NOT NULL,
  quota_date DATE NOT NULL,
  daily_count INT NOT NULL DEFAULT 0,
  session_count INT NOT NULL DEFAULT 0,
  last_shown_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (quota_key, quota_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  session_id VARCHAR(191) NOT NULL PRIMARY KEY,
  email VARCHAR(191) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  KEY idx_admin_sessions_email (email),
  KEY idx_admin_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
