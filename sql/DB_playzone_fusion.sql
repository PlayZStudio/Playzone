-- ============================================================
-- PlayZone + ADSO — esquema fusionado
-- Base: db_playzone (puedes usar también db_adso)
-- ============================================================

CREATE DATABASE IF NOT EXISTS db_playzone
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE db_playzone;

-- ---------- Catálogos ADSO ----------
CREATE TABLE IF NOT EXISTS permissions (
  perm_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  perm_code VARCHAR(100) NOT NULL UNIQUE,
  perm_name VARCHAR(100) NOT NULL,
  perm_description TEXT,
  perm_is_active TINYINT NOT NULL DEFAULT 1,
  perm_created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  perm_created_by BIGINT NULL,
  perm_updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  perm_updated_by BIGINT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  role_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  role_code VARCHAR(30) NOT NULL UNIQUE,
  role_name VARCHAR(50) NOT NULL,
  role_description TEXT,
  role_is_active TINYINT NOT NULL DEFAULT 1,
  role_created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  role_created_by BIGINT NULL,
  role_updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  role_updated_by BIGINT NULL
);

CREATE TABLE IF NOT EXISTS genders (
  gend_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  gend_code VARCHAR(10) NOT NULL UNIQUE,
  gend_name VARCHAR(50) NOT NULL,
  gend_description TEXT,
  gend_is_active TINYINT NOT NULL DEFAULT 1,
  gend_created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  gend_created_by BIGINT NULL,
  gend_updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  gend_updated_by BIGINT NULL
);

CREATE TABLE IF NOT EXISTS sexes (
  sexe_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sexe_code VARCHAR(10) NOT NULL UNIQUE,
  sexe_name VARCHAR(50) NOT NULL,
  sexe_description TEXT,
  sexe_is_active TINYINT NOT NULL DEFAULT 1,
  sexe_created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  sexe_created_by BIGINT NULL,
  sexe_updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  sexe_updated_by BIGINT NULL
);

CREATE TABLE IF NOT EXISTS document_types (
  doty_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  doty_code VARCHAR(10) NOT NULL UNIQUE,
  doty_name VARCHAR(50) NOT NULL,
  doty_description TEXT,
  doty_is_active TINYINT NOT NULL DEFAULT 1,
  doty_created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  doty_created_by BIGINT NULL,
  doty_updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  doty_updated_by BIGINT NULL
);

CREATE TABLE IF NOT EXISTS roles_permissions (
  rope_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  role_id BIGINT NOT NULL,
  perm_id BIGINT NOT NULL,
  CONSTRAINT fk_rope_role FOREIGN KEY (role_id) REFERENCES roles(role_id),
  CONSTRAINT fk_rope_perm FOREIGN KEY (perm_id) REFERENCES permissions(perm_id),
  UNIQUE KEY uq_role_perm (role_id, perm_id)
);

-- ---------- Usuarios ADSO + acceso ----------
CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_first_name VARCHAR(50) NOT NULL,
  user_last_name VARCHAR(50) NOT NULL DEFAULT '',
  user_doty_id BIGINT NULL,
  user_document_number VARCHAR(30) NULL,
  user_email VARCHAR(100) NOT NULL UNIQUE,
  user_phone_number VARCHAR(20) NULL,
  user_sexe_id BIGINT NULL,
  user_gend_id BIGINT NULL,
  user_is_active TINYINT NOT NULL DEFAULT 1,
  user_created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  user_created_by BIGINT NULL,
  user_updated_at DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  user_updated_by BIGINT NULL,
  CONSTRAINT fk_users_doty FOREIGN KEY (user_doty_id) REFERENCES document_types(doty_id),
  CONSTRAINT fk_users_sexe FOREIGN KEY (user_sexe_id) REFERENCES sexes(sexe_id),
  CONSTRAINT fk_users_gend FOREIGN KEY (user_gend_id) REFERENCES genders(gend_id)
);

CREATE TABLE IF NOT EXISTS accesses (
  acce_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  acce_user_name VARCHAR(50) NOT NULL UNIQUE,
  acce_password_hash VARCHAR(255) NOT NULL,
  acce_is_active TINYINT NOT NULL DEFAULT 1,
  acce_failed_attempts INT NOT NULL DEFAULT 0,
  acce_locked_until DATETIME(6) NULL,
  acce_last_login_at DATETIME(6) NULL,
  acce_password_changed_at DATETIME(6) NULL,
  acce_created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  acce_created_by BIGINT NULL,
  acce_updated_at DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  acce_updated_by BIGINT NULL,
  CONSTRAINT fk_acce_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS users_roles (
  usro_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  CONSTRAINT fk_usro_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_usro_role FOREIGN KEY (role_id) REFERENCES roles(role_id),
  UNIQUE KEY uq_user_role (user_id, role_id)
);

-- ---------- PlayZone (tienda) ----------
CREATE TABLE IF NOT EXISTS games (
  game_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  game_code VARCHAR(30) NOT NULL UNIQUE,
  game_title VARCHAR(120) NOT NULL,
  game_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  game_original_price DECIMAL(10,2) NULL,
  game_discount INT NOT NULL DEFAULT 0,
  game_image VARCHAR(500) NULL,
  game_rating DECIMAL(3,1) NOT NULL DEFAULT 0,
  game_category VARCHAR(50) NOT NULL,
  game_tags JSON NULL,
  game_description TEXT,
  game_download_url VARCHAR(500) NULL,
  game_license VARCHAR(80) NULL,
  game_is_active TINYINT NOT NULL DEFAULT 1,
  game_created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  game_updated_at DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
);

CREATE TABLE IF NOT EXISTS library (
  lib_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  game_id BIGINT NOT NULL,
  lib_purchased_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_lib_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_lib_game FOREIGN KEY (game_id) REFERENCES games(game_id),
  UNIQUE KEY uq_lib_user_game (user_id, game_id)
);

CREATE TABLE IF NOT EXISTS cart (
  cart_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  game_id BIGINT NOT NULL,
  cart_added_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_cart_game FOREIGN KEY (game_id) REFERENCES games(game_id),
  UNIQUE KEY uq_cart_user_game (user_id, game_id)
);

CREATE TABLE IF NOT EXISTS messages (
  msg_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  msg_text VARCHAR(500) NOT NULL,
  msg_created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_msg_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS streams (
  stream_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  stream_title VARCHAR(150) NOT NULL,
  stream_viewers INT NOT NULL DEFAULT 0,
  stream_live TINYINT NOT NULL DEFAULT 1,
  stream_started_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_stream_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);
