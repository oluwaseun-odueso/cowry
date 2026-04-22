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
  `tag`              VARCHAR(32)                            NULL,
  `passcode_hash`    VARCHAR(255)                           NULL,
  `avatar`           VARCHAR(64)                            NULL,
  `is_mfa_enabled`   TINYINT(1)                             NOT NULL DEFAULT 0,
  `mfa_secret`       VARCHAR(255)                           NULL,
  `email_verified`   TINYINT(1)                             NOT NULL DEFAULT 0,
  `refresh_token`    TEXT                                   NULL,
  `created_at`       DATETIME                               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME                               NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email`        (`email`),
  UNIQUE KEY `uq_users_google_id`    (`google_id`),
  UNIQUE KEY `uq_users_phone_number` (`phone_number`),
  UNIQUE KEY `uq_users_tag`          (`tag`)
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

CREATE TABLE IF NOT EXISTS `accounts` (
  `id`             CHAR(36)                        NOT NULL,
  `user_id`        CHAR(36)                        NOT NULL,
  `account_number` VARCHAR(8)                      NOT NULL,
  `sort_code`      VARCHAR(6)                      NOT NULL DEFAULT '400001',
  `account_type`   ENUM('savings', 'current')      NOT NULL,
  `currency`       VARCHAR(3)                      NOT NULL DEFAULT 'GBP',
  `balance`        DECIMAL(15,2)                   NOT NULL DEFAULT 0.00,
  `status`         ENUM('active', 'suspended')     NOT NULL DEFAULT 'active',
  `created_at`     DATETIME                        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_accounts_account_number` (`account_number`),
  KEY `idx_accounts_user_id` (`user_id`),
  CONSTRAINT `fk_accounts_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `transactions` (
  `id`          CHAR(36)                                    NOT NULL,
  `account_id`  CHAR(36)                                    NOT NULL,
  `type`        ENUM('credit', 'debit')                     NOT NULL,
  `amount`      DECIMAL(15,2)                               NOT NULL,
  `currency`    VARCHAR(3)                                  NOT NULL,
  `reference`   VARCHAR(50)                                 NOT NULL,
  `description` VARCHAR(255)                                NULL,
  `status`      ENUM('pending', 'completed', 'failed')      NOT NULL DEFAULT 'completed',
  `metadata`    JSON                                        NULL,
  `created_at`  DATETIME                                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_transactions_reference` (`reference`),
  KEY `idx_transactions_account_id` (`account_id`),
  KEY `idx_transactions_type` (`type`),
  KEY `idx_transactions_created_at` (`created_at`),
  CONSTRAINT `fk_transactions_account`
    FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Sprint 5: Social features ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `contacts` (
  `id`               CHAR(36)     NOT NULL,
  `owner_user_id`    CHAR(36)     NOT NULL,
  `contact_user_id`  CHAR(36)     NULL,
  `nickname`         VARCHAR(100) NULL,
  `account_number`   VARCHAR(8)   NULL,
  `sort_code`        VARCHAR(6)   NULL,
  `tag`              VARCHAR(32)  NULL,
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contacts_owner` (`owner_user_id`),
  CONSTRAINT `fk_contacts_owner`
    FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_contacts_contact`
    FOREIGN KEY (`contact_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `split_requests` (
  `id`                CHAR(36)                                    NOT NULL,
  `initiator_user_id` CHAR(36)                                    NOT NULL,
  `total_amount`      DECIMAL(15,2)                               NOT NULL,
  `description`       VARCHAR(255)                                NULL,
  `status`            ENUM('pending','completed','cancelled')     NOT NULL DEFAULT 'pending',
  `created_at`        DATETIME                                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_split_requests_initiator` (`initiator_user_id`),
  CONSTRAINT `fk_split_requests_initiator`
    FOREIGN KEY (`initiator_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `split_participants` (
  `id`               CHAR(36)                                NOT NULL,
  `split_request_id` CHAR(36)                                NOT NULL,
  `user_id`          CHAR(36)                                NULL,
  `account_number`   VARCHAR(8)                              NULL,
  `amount`           DECIMAL(15,2)                           NOT NULL,
  `status`           ENUM('pending','paid','declined')       NOT NULL DEFAULT 'pending',
  `paid_at`          DATETIME                                NULL,
  PRIMARY KEY (`id`),
  KEY `idx_split_participants_request` (`split_request_id`),
  CONSTRAINT `fk_split_participants_request`
    FOREIGN KEY (`split_request_id`) REFERENCES `split_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_requests` (
  `id`                  CHAR(36)                                        NOT NULL,
  `requester_user_id`   CHAR(36)                                        NOT NULL,
  `payer_account_number` VARCHAR(8)                                     NULL,
  `payer_user_id`       CHAR(36)                                        NULL,
  `amount`              DECIMAL(15,2)                                   NOT NULL,
  `description`         VARCHAR(255)                                    NULL,
  `status`              ENUM('pending','paid','declined','expired')     NOT NULL DEFAULT 'pending',
  `expires_at`          DATETIME                                        NULL,
  `created_at`          DATETIME                                        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_requests_requester` (`requester_user_id`),
  CONSTRAINT `fk_payment_requests_requester`
    FOREIGN KEY (`requester_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── User tags (Sprint 5) ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `cards` (
  `id`            CHAR(36)                                                    NOT NULL,
  `account_id`    CHAR(36)                                                    NOT NULL,
  `card_type`     ENUM('debit','prepaid','disposable')                        NOT NULL DEFAULT 'debit',
  `card_number`   TEXT                                                        NOT NULL,
  `last_four`     VARCHAR(4)                                                  NOT NULL,
  `expiry_month`  TINYINT                                                     NOT NULL,
  `expiry_year`   SMALLINT                                                    NOT NULL,
  `cvv`           TEXT                                                        NOT NULL,
  `is_frozen`     TINYINT(1)                                                  NOT NULL DEFAULT 0,
  `status`        ENUM('active','frozen','blocked','cancelled','used')        NOT NULL DEFAULT 'active',
  `is_disposable` TINYINT(1)                                                  NOT NULL DEFAULT 0,
  `created_at`    DATETIME                                                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cards_account_id` (`account_id`),
  CONSTRAINT `fk_cards_account`
    FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `merchant_blocks` (
  `id`            CHAR(36)     NOT NULL,
  `user_id`       CHAR(36)     NOT NULL,
  `merchant_name` VARCHAR(255) NOT NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_merchant_block` (`user_id`, `merchant_name`),
  CONSTRAINT `fk_merchant_blocks_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `otp_codes` (
  `id`         CHAR(36)     NOT NULL,
  `user_id`    CHAR(36)     NOT NULL,
  `action`     VARCHAR(64)  NOT NULL,
  `code_hash`  VARCHAR(255) NOT NULL,
  `expires_at` DATETIME     NOT NULL,
  `used`       TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_codes_user_id` (`user_id`),
  CONSTRAINT `fk_otp_codes_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `transfers` (
  `id`              CHAR(36)                                    NOT NULL,
  `from_account_id` CHAR(36)                                    NOT NULL,
  `to_account_id`   CHAR(36)                                    NOT NULL,
  `amount`          DECIMAL(15,2)                               NOT NULL,
  `currency`        VARCHAR(3)                                  NOT NULL,
  `reference`       VARCHAR(50)                                 NOT NULL,
  `status`          ENUM('pending', 'completed', 'failed')      NOT NULL DEFAULT 'completed',
  `created_at`      DATETIME                                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_transfers_reference` (`reference`),
  KEY `idx_transfers_from_account_id` (`from_account_id`),
  KEY `idx_transfers_to_account_id` (`to_account_id`),
  CONSTRAINT `fk_transfers_from_account`
    FOREIGN KEY (`from_account_id`) REFERENCES `accounts` (`id`),
  CONSTRAINT `fk_transfers_to_account`
    FOREIGN KEY (`to_account_id`) REFERENCES `accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
