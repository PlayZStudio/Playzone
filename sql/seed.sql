USE db_playzone;

-- Tipos de documento
INSERT INTO document_types (doty_code, doty_name, doty_description, doty_is_active, doty_created_by)
VALUES
  ('CC', 'Cédula de ciudadanía', 'Mayor de edad', 1, 1),
  ('TI', 'Tarjeta de identidad', 'Menor de edad', 1, 1),
  ('CE', 'Cédula de extranjería', 'Extranjero', 1, 1)
ON DUPLICATE KEY UPDATE doty_name = VALUES(doty_name);

-- Sexos
INSERT INTO sexes (sexe_code, sexe_name, sexe_description, sexe_is_active)
VALUES
  ('M', 'Masculino', NULL, 1),
  ('F', 'Femenino', NULL, 1),
  ('O', 'Otro', NULL, 1)
ON DUPLICATE KEY UPDATE sexe_name = VALUES(sexe_name);

-- Géneros
INSERT INTO genders (gend_code, gend_name, gend_description, gend_is_active)
VALUES
  ('M', 'Masculino', NULL, 1),
  ('F', 'Femenino', NULL, 1),
  ('NB', 'No binario', NULL, 1),
  ('O', 'Otro', NULL, 1)
ON DUPLICATE KEY UPDATE gend_name = VALUES(gend_name);

-- Roles
INSERT INTO roles (role_code, role_name, role_description, role_is_active)
VALUES
  ('ADMIN', 'Administrador', 'Acceso total al sistema', 1),
  ('PLAYER', 'Jugador', 'Usuario de la tienda PlayZone', 1),
  ('STREAMER', 'Streamer', 'Puede iniciar transmisiones', 1)
ON DUPLICATE KEY UPDATE role_name = VALUES(role_name);

-- Permisos básicos
INSERT INTO permissions (perm_code, perm_name, perm_description, perm_is_active, perm_created_by, perm_updated_by)
VALUES
  ('GAME_VIEW', 'Ver catálogo', 'Ver juegos de la tienda', 1, 1, 1),
  ('GAME_BUY', 'Comprar juegos', 'Añadir al carrito y comprar', 1, 1, 1),
  ('CHAT_SEND', 'Enviar chat', 'Escribir en el chat', 1, 1, 1),
  ('STREAM_START', 'Iniciar stream', 'Crear transmisión en vivo', 1, 1, 1),
  ('ADMIN_PANEL', 'Panel admin', 'Administración del sistema', 1, 1, 1)
ON DUPLICATE KEY UPDATE perm_name = VALUES(perm_name);

-- Roles ↔ permisos (PLAYER)
INSERT IGNORE INTO roles_permissions (role_id, perm_id)
SELECT r.role_id, p.perm_id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_code = 'PLAYER'
  AND p.perm_code IN ('GAME_VIEW', 'GAME_BUY', 'CHAT_SEND');

INSERT IGNORE INTO roles_permissions (role_id, perm_id)
SELECT r.role_id, p.perm_id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_code = 'STREAMER'
  AND p.perm_code IN ('GAME_VIEW', 'GAME_BUY', 'CHAT_SEND', 'STREAM_START');

INSERT IGNORE INTO roles_permissions (role_id, perm_id)
SELECT r.role_id, p.perm_id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_code = 'ADMIN';

-- Juegos PlayZone
INSERT INTO games (
  game_code, game_title, game_price, game_original_price, game_discount,
  game_image, game_rating, game_category, game_tags, game_description,
  game_download_url, game_license, game_is_active
) VALUES
(
  'STK',
  'SuperTuxKart',
  0, NULL, 0,
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTyOpj9_Maq-Md6truGXGD3A6MhnIAJ7dA_HxE-_N7UoQYTPDAckbWF9uqY&s=10',
  4.8, 'Carreras',
  JSON_ARRAY('Open Source', 'GPL', 'Multijugador', 'Gratis'),
  'Carreras de karts con mascotas del software libre (Tux y amigos). Totalmente gratis y de codigo abierto (GPL v3). Multijugador local y online.',
  'https://supertuxkart.net/Download',
  'GPL v3', 1
),
(
  'GRANNY',
  'Granny',
  0, NULL, 0,
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQZhvoGgg61DzaURpF_VkUjvCX1Drs_C4IyNhwiv8mzUA&s',
  4.2, 'Terror',
  JSON_ARRAY('Terror', 'Survival', 'Gratis'),
  'Survival horror: escapa de la casa de Granny sin ser atrapado.',
  'https://www.mediafire.com/file/t43kolgn6ggpaaw/G2018PG.gamezfull.com.rar/file',
  'Freeware', 1
)
ON DUPLICATE KEY UPDATE
  game_title = VALUES(game_title),
  game_image = VALUES(game_image),
  game_download_url = VALUES(game_download_url),
  game_description = VALUES(game_description);
