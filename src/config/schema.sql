CREATE TABLE IF NOT EXISTS `users` (
  `id`               CHAR(36)                               NOT NULL,
  `email`            VARCHAR(255)                           NOT NULL,
  `password`         VARCHAR(255)                           NULL,
  `first_name`       VARCHAR(100)                           NOT NULL,
  `last_name`        VARCHAR(100)                           NOT NULL,
  `role`             ENUM('user', 'admin')                  NOT NULL DEFAULT 'user',
  `status`           ENUM('active', 'suspended', 'locked')  NOT NULL DEFAULT 'active',
  `google_id`        VARCHAR(255)                           NULL,
  `profile_picture`  TEXT                                   NULL,
  `last_login`       DATETIME                               NULL,
  `last_login_ip`    VARCHAR(45)                            NULL,
  `login_attempts`   INT                                    NOT NULL DEFAULT 0,
  `lock_until`       DATETIME                               NULL,
  `phone_number`     VARCHAR(20)                            NOT NULL,
  `is_mfa_enabled`   TINYINT(1)                             NOT NULL DEFAULT 0,
  `mfa_secret`       VARCHAR(255)                           NULL,
  `email_verified`   TINYINT(1)                             NOT NULL DEFAULT 0,
  `refresh_token`    TEXT                                   NULL,
  `created_at`       DATETIME                               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME                               NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email`        (`email`),
  UNIQUE KEY `uq_users_google_id`    (`google_id`),
  UNIQUE KEY `uq_users_phone_number` (`phone_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `email_verifications` (
  `id`         CHAR(36)     NOT NULL,
  `user_id`    CHAR(36)     NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME     NOT NULL,
  `used`       TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_verifications_user_id` (`user_id`),
  CONSTRAINT `fk_email_verifications_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_resets` (
  `id`         CHAR(36)     NOT NULL,
  `user_id`    CHAR(36)     NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME     NOT NULL,
  `used`       TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_password_resets_user_id` (`user_id`),
  CONSTRAINT `fk_password_resets_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mfa_backup_codes` (
  `id`         CHAR(36)     NOT NULL,
  `user_id`    CHAR(36)     NOT NULL,
  `code_hash`  VARCHAR(255) NOT NULL,
  `used`       TINYINT(1)   NOT NULL DEFAULT 0,
  `used_at`    DATETIME     NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mfa_backup_user_id` (`user_id`),
  CONSTRAINT `fk_mfa_backup_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `id`             CHAR(36)     NOT NULL,
  `user_id`        CHAR(36)     NOT NULL,
  `token`          TEXT         NOT NULL,
  `refresh_token`  TEXT         NOT NULL,
  `ip_address`     VARCHAR(45)  NOT NULL,
  `user_agent`     TEXT         NOT NULL,
  `location`       JSON         NULL,
  `device_info`    JSON         NULL,
  `expires_at`     DATETIME     NOT NULL,
  `is_valid`       TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sessions_user_id`  (`user_id`),
  KEY `idx_sessions_is_valid` (`is_valid`),
  CONSTRAINT `fk_sessions_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fraud_alerts` (
  `id`           CHAR(36)                            NOT NULL,
  `user_id`      CHAR(36)                            NULL,
  `session_id`   CHAR(36)                            NULL,
  `rule_name`    VARCHAR(100)                        NOT NULL,
  `risk_level`   ENUM('low', 'medium', 'high')       NOT NULL,
  `description`  TEXT                                NOT NULL,
  `ip_address`   VARCHAR(45)                         NOT NULL,
  `location`     JSON                                NULL,
  `metadata`     JSON                                NULL,
  `action`       VARCHAR(50)                         NOT NULL,
  `is_resolved`  TINYINT(1)                          NOT NULL DEFAULT 0,
  `resolved_at`  DATETIME                            NULL,
  `resolved_by`  VARCHAR(100)                        NULL,
  `created_at`   DATETIME                            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME                            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fraud_alerts_user_id`     (`user_id`),
  KEY `idx_fraud_alerts_session_id`  (`session_id`),
  KEY `idx_fraud_alerts_risk_level`  (`risk_level`),
  KEY `idx_fraud_alerts_is_resolved` (`is_resolved`),
  CONSTRAINT `fk_fraud_alerts_user`
    FOREIGN KEY (`user_id`)    REFERENCES `users`    (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_fraud_alerts_session`
    FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
