/**
 * Seguridad PlayZone — roles, archivos y contenido +18
 */

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'elvis.bastosv@gmail.com').toLowerCase();

/** Extensiones permitidas para archivos de juego (no .exe suelto por riesgo) */
export const ALLOWED_GAME_EXT = new Set([
  '.zip', '.7z', '.rar', '.tar', '.gz', '.tgz', '.bz2',
  '.apk', // móvil
  '.appimage',
]);

/** Firmas mágicas (magic bytes) de formatos de archivo conocidos */
const MAGIC = [
  { ext: ['.zip', '.apk'], bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK..
  { ext: ['.zip'], bytes: [0x50, 0x4b, 0x05, 0x06] },
  { ext: ['.rar'], bytes: [0x52, 0x61, 0x72, 0x21] }, // Rar!
  { ext: ['.7z'], bytes: [0x37, 0x7a, 0xbc, 0xaf] }, // 7z
  { ext: ['.gz', '.tgz'], bytes: [0x1f, 0x8b] },
  { ext: ['.tar'], bytes: null }, // tar no tiene magic fiable al inicio
];

/** Palabras / patrones +18 o inapropiados (filtro básico) */
const BLOCKED_CONTENT = [
  /\bxxx\b/i,
  /\bporn\b/i,
  /\bporno\b/i,
  /\bnsfw\b/i,
  /\bhentai\b/i,
  /\bonlyfans\b/i,
  /\b\+18\b/i,
  /\b18\+\b/i,
  /\badult[oa]?\b/i,
  /\ber[oó]tic/i,
  /\bsex(o|ual)?\b/i,
  /\bnude\b/i,
  /\bnudes\b/i,
  /\bgore\b/i,
  /\brape\b/i,
  /\bpedo\b/i,
  /\bloli\b/i,
  /\bprostit/i,
];

const BLOCKED_CATEGORIES = new Set([
  'adultos', 'adulto', '+18', '18+', 'xxx', 'nsfw', 'porn', 'porno', 'erotico', 'erótico',
]);

export function getAdminEmail() {
  return ADMIN_EMAIL;
}

export function isAdminEmail(email) {
  return String(email || '').toLowerCase().trim() === ADMIN_EMAIL;
}

/** Nunca confiar solo en el JWT: el admin real es el correo del .env */
export function assertAdmin(userFromToken, userFromDb) {
  if (!userFromToken) return { ok: false, error: 'No autorizado' };
  const email = (userFromDb?.email || userFromToken.email || '').toLowerCase();
  if (!isAdminEmail(email)) {
    return { ok: false, error: 'Solo el administrador autorizado puede hacer esto' };
  }
  // Si el token dice admin pero el correo no coincide, rechazar
  if (userFromToken.role === 'admin' && !isAdminEmail(email)) {
    return { ok: false, error: 'Token inválido' };
  }
  return { ok: true };
}

/** Quita campos peligrosos de un patch de usuario */
export function sanitizeUserPatch(patch = {}) {
  const clean = { ...patch };
  delete clean.role;
  delete clean.passwordHash;
  delete clean.id;
  delete clean.email;
  delete clean.active;
  return clean;
}

export function extensionOf(name) {
  const n = String(name || '').toLowerCase();
  const i = n.lastIndexOf('.');
  return i >= 0 ? n.slice(i) : '';
}

export function isAllowedGameFile(originalName, buffer) {
  const ext = extensionOf(originalName);
  if (!ALLOWED_GAME_EXT.has(ext)) {
    return {
      ok: false,
      error: `Tipo de archivo no permitido (${ext || 'sin extensión'}). Usa: ${[...ALLOWED_GAME_EXT].join(', ')}`,
    };
  }
  // .exe y scripts no están en la lista a propósito
  if (/\.(exe|bat|cmd|ps1|js|mjs|cjs|sh|php|html|htm|svg)$/i.test(originalName)) {
    return { ok: false, error: 'Archivos ejecutables o scripts no están permitidos' };
  }
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return { ok: false, error: 'Archivo vacío o inválido' };
  }
  // Comprobar magic bytes cuando aplica
  if (ext === '.zip' || ext === '.apk') {
    const ok = buffer[0] === 0x50 && buffer[1] === 0x4b;
    if (!ok) return { ok: false, error: 'El archivo no parece un ZIP válido' };
  }
  if (ext === '.rar') {
    const ok = buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72;
    if (!ok) return { ok: false, error: 'El archivo no parece un RAR válido' };
  }
  if (ext === '.7z') {
    const ok = buffer[0] === 0x37 && buffer[1] === 0x7a;
    if (!ok) return { ok: false, error: 'El archivo no parece un 7z válido' };
  }
  if (ext === '.gz' || ext === '.tgz') {
    const ok = buffer[0] === 0x1f && buffer[1] === 0x8b;
    if (!ok) return { ok: false, error: 'El archivo no parece un GZ válido' };
  }
  return { ok: true, ext };
}

export function containsBlockedContent(...parts) {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  if (!text.trim()) return { blocked: false };
  for (const re of BLOCKED_CONTENT) {
    if (re.test(text)) {
      return { blocked: true, error: 'Contenido no permitido: PlayZone no acepta material +18 o inapropiado' };
    }
  }
  return { blocked: false };
}

export function validateGamePayload(body = {}) {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const category = String(body.category || '').trim();
  const tags = Array.isArray(body.tags)
    ? body.tags
    : String(body.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  const image = String(body.image || '').trim();

  if (!title) return { ok: false, error: 'El título es obligatorio' };
  if (!image) return { ok: false, error: 'La imagen es obligatoria' };
  if (/^\s*javascript:/i.test(image) || /\bdata:text\/html/i.test(image)) {
    return { ok: false, error: 'URL de imagen no permitida' };
  }

  if (BLOCKED_CATEGORIES.has(category.toLowerCase())) {
    return { ok: false, error: 'Categoría no permitida (+18 / adultos)' };
  }

  const check = containsBlockedContent(title, description, category, tags.join(' '));
  if (check.blocked) return { ok: false, error: check.error };

  return {
    ok: true,
    clean: {
      ...body,
      title: title.slice(0, 150),
      description: description.slice(0, 4000),
      category: category.slice(0, 80) || 'Otros',
      tags: tags.slice(0, 20).map((t) => String(t).slice(0, 40)),
      image: image.slice(0, 500),
    },
  };
}

/** Rate limit muy simple en memoria */
const hits = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let arr = hits.get(key) || [];
  arr = arr.filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  hits.set(key, arr);
  return true;
}
