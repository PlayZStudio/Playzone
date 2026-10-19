import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db/index.js';
import {
  isAdminEmail,
  getAdminEmail,
  validateGamePayload,
  isAllowedGameFile,
  rateLimit,
  sanitizeUserPatch,
} from './security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cargar .env manualmente (sin dependencia dotenv)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i <= 0) continue;
    const key = s.slice(0, i).trim();
    let val = s.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnv();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'playzone_dev_secret_change_me';
/** Solo este correo puede ser admin. */
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'elvis.bastosv@gmail.com').toLowerCase();

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

async function adminOnly(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  // Revalidar contra BD + correo del .env (un JWT manipulado no basta)
  const u = await db.findUserById(req.user.id);
  if (!u || u.active === false) return res.status(401).json({ error: 'No autorizado' });
  if (!isAdminEmail(u.email)) {
    return res.status(403).json({ error: 'Solo el administrador autorizado puede hacer esto' });
  }
  req.user.role = 'admin';
  req.user.email = u.email;
  next();
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cardHtml(g) {
  const free = Number(g.price) === 0;
  const precio = free
    ? '<span class="price free">Gratis</span>'
    : `<span class="price">$${Number(g.price).toFixed(2)}</span>`;
  const old = g.originalPrice
    ? `<span class="old-price">$${Number(g.originalPrice).toFixed(2)}</span>`
    : '';
  const disc = g.discount ? `<span class="badge">-${g.discount}%</span>` : '';
  let actions;
  const canDl = !!g.fileName;
  if (free) {
    const dlBtn = canDl
      ? `<a class="btn small primary" href="/api/games/${escapeHtml(g.id)}/download">Descargar gratis</a>`
      : `<button class="btn small" type="button" disabled title="El admin aún no subió el archivo">Sin archivo</button>`;
    actions = `${dlBtn}
      <button class="btn small" type="button" onclick="verDetalle('${escapeHtml(g.id)}')">Ver</button>
      <button class="btn small" type="button" onclick="addFreeLibrary('${escapeHtml(g.id)}')">+ Biblioteca</button>`;
  } else {
    actions = `<button class="btn small primary" type="button" onclick="addCart('${escapeHtml(g.id)}')">Al carrito</button>
      <button class="btn small" type="button" onclick="verDetalle('${escapeHtml(g.id)}')">Ver</button>`;
  }
  const imgFallback = `https://placehold.co/600x340/1a1035/c4b5fd?text=${encodeURIComponent(g.title || 'Game')}`;
  const tags = Array.isArray(g.tags) ? g.tags.join(' ') : '';
  const stars = '★'.repeat(Math.round(Number(g.rating) || 0)) + '☆'.repeat(5 - Math.round(Number(g.rating) || 0));
  return `<article class="card" data-id="${escapeHtml(g.id)}" data-title="${escapeHtml(g.title)}" data-category="${escapeHtml(g.category)}" data-tags="${escapeHtml(tags)}" data-desc="${escapeHtml(g.description || '')}">
    ${disc}
    <img src="${escapeHtml(g.image)}" alt="${escapeHtml(g.title)}" loading="lazy" onerror="this.src='${imgFallback}'" />
    <div class="card-body">
      <h3>${escapeHtml(g.title)}</h3>
      <p class="cat">${escapeHtml(g.category)}</p>
      <p class="rating" title="${Number(g.rating) || 0}">${stars} <span class="muted">(${g.ratingCount || 0})</span></p>
      <div class="price-row">${precio} ${old}</div>
      <div class="card-actions">${actions}</div>
    </div>
  </article>`;
}

function aiReply(userText) {
  const raw = String(userText || '').trim();
  const t = raw.toLowerCase();
  if (!t) return 'Escribe algo y te respondo. Puedo ayudarte con juegos, descargas, cuenta, admin y más.';

  // Saludos
  if (/^(hola|buenas|hey|hi|hello|qué tal|que tal|buenos días|buenas tardes)\b/.test(t)) {
    return '¡Hola! Soy el asistente de PlayZone. Puedo ayudarte a encontrar juegos, explicar cómo descargar, reseñar, usar la biblioteca, el chat o el panel de admin. ¿Qué necesitas?';
  }

  // Juegos concretos
  if (/supertux|tux.?kart|kart/.test(t)) {
    return 'SuperTuxKart es un juego de carreras gratis y de código abierto (GPL). En la Tienda búscalo, pulsa «Descargar gratis» o «+ Biblioteca» para guardarlo en tu cuenta.';
  }
  if (/granny|terror|horror|miedo/.test(t)) {
    return 'Granny es un survival horror gratuito. Está en la categoría Terror. En la Tienda puedes descargarlo o añadirlo a tu biblioteca si iniciaste sesión.';
  }

  // Cómo publicar / admin
  if (/publicar|subir juego|agregar juego|añadir juego|crear juego|open.?source|código abierto|codigo abierto/.test(t)) {
    return 'Para publicar un juego necesitas ser administrador. Inicia sesión con el correo admin, entra a Admin y completa: título, imagen (obligatoria), precio (0 = gratis), categoría, enlace de descarga y descripción. Ideal para juegos open source con link oficial.';
  }
  if (/admin|administrador|panel/.test(t)) {
    return 'El panel Admin solo lo ve el correo configurado como administrador. Desde ahí se publican, editan y borran juegos, y se ven estadísticas del sistema.';
  }

  // Cuenta / auth
  if (/registr|crear cuenta|sign.?up/.test(t)) {
    return 'Ve a «Crear cuenta», pon usuario, correo y contraseña (mínimo 4 caracteres). Luego inicia sesión para usar biblioteca, carrito, reseñas y chats.';
  }
  if (/contraseña|password|recuper|olvidé|olvide/.test(t)) {
    return 'En Iniciar sesión usa «¿Olvidaste tu contraseña?». Te generará un token (en demo se muestra en pantalla). Con ese token restableces la clave.';
  }
  if (/eliminar cuenta|borrar cuenta|cerrar cuenta/.test(t)) {
    return 'En Mi perfil puedes editar tus datos o eliminar la cuenta. Al eliminarla se pierde el acceso a biblioteca y chats asociados.';
  }

  // Biblioteca / carrito / descarga
  if (/biblioteca|mis juegos|ya tengo/.test(t)) {
    return 'La Biblioteca muestra los juegos que añadiste o compraste. Los gratis se agregan con «+ Biblioteca» o «Descargar gratis» desde la Tienda.';
  }
  if (/carrito|comprar|pagar/.test(t)) {
    return 'El carrito guarda juegos de pago. Los gratuitos no necesitan carrito: se descargan o se agregan directo a la biblioteca.';
  }
  if (/descarg/.test(t)) {
    return 'En la ficha del juego o en la Tienda, «Descargar gratis» baja el archivo alojado en PlayZone (no te manda a MediaFire ni a otras webs).';
  }

  // Social
  if (/reseña|calificar|estrella|review/.test(t)) {
    return 'Abre un juego con «Ver», elige de 1 a 5 estrellas y escribe un comentario. Necesitas haber iniciado sesión.';
  }
  if (/chat|comunidad|mensaje/.test(t) && !/dm|privado/.test(t)) {
    return 'El Chat de la comunidad es público: todos los usuarios conectados pueden leer y escribir. También hay chats privados (DM) entre dos usuarios.';
  }
  if (/\bdm\b|privado|whatsapp|mensaje privado/.test(t)) {
    return 'En Mensajes privados elige un usuario de la lista para abrir un chat 1 a 1, similar a WhatsApp. Solo ustedes dos ven esa conversación.';
  }

  // Búsqueda / categorías
  if (/buscar|búsqueda|busqueda|filtro|categoría|categoria|ps4|carreras/.test(t)) {
    return 'En la Tienda usa la barra de búsqueda: escribe parte del nombre (ej. «grann» encuentra Granny). También puedes filtrar por categoría.';
  }
  if (/gratis|free|precio 0/.test(t)) {
    return 'Los juegos con precio 0 aparecen como Gratis. SuperTuxKart y Granny están gratis en el catálogo actual. El admin puede publicar más open source gratis.';
  }

  // Técnico / BD
  if (/mysql|base de datos|dbeaver|json/.test(t)) {
    return 'PlayZone puede usar JSON local (data/db.json) o MySQL. Si en el .env no hay MYSQL_HOST, usa JSON. Para MySQL configura MYSQL_HOST, usuario y contraseña y reinicia el servidor.';
  }

  // Despedidas
  if (/gracias|thank|bye|adi[oó]s|chao|nos vemos/.test(t)) {
    return '¡De nada! Si necesitas algo más de PlayZone, aquí estaré. ¡Buenas partidas!';
  }

  // Preguntas abiertas: respuesta más conversacional
  if (/\?$|cómo|como |qué es|que es|para qué|puedo |ayuda/.test(t)) {
    return 'Puedo orientarte paso a paso. Prueba preguntarme por ejemplo: «cómo descargar SuperTuxKart», «cómo publicar un juego», «cómo recuperar contraseña» o «dónde está mi biblioteca».';
  }

  // Fallback menos genérico
  return `Entendí: «${raw.slice(0, 120)}». Aún estoy aprendiendo, pero puedo ayudarte con la tienda, descargas, biblioteca, reseñas, chat, cuenta y panel admin. Reformula en una frase corta (ej. «cómo agrego un juego gratis») y te detallo los pasos.`;
}

// ── Auth ───────────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body || {};
    if (!username || !email || !password) return res.status(400).json({ error: 'Faltan datos' });
    if (String(password).length < 4) return res.status(400).json({ error: 'Contraseña muy corta' });
    const passwordHash = await bcrypt.hash(String(password), 10);
    const isAdmin = String(email).toLowerCase() === ADMIN_EMAIL;
    const user = await db.register({
      username: String(username).trim(),
      email: String(email).trim().toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role: isAdmin ? 'admin' : 'user',
    });
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role || (isAdmin ? 'admin' : 'user') },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { ...user, role: user.role || (isAdmin ? 'admin' : 'user') } });
  } catch (e) {
    if (e.code === 'DUPLICATE') return res.status(409).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Error al registrar' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (!rateLimit('login:' + ip, 30, 15 * 60 * 1000)) {
      return res.status(429).json({ error: 'Demasiados intentos de inicio de sesión' });
    }
    const row = await db.loginByEmail(String(email || '').trim().toLowerCase());
    if (!row || row.active === false) return res.status(401).json({ error: 'Credenciales inválidas' });
    const ok = await bcrypt.compare(String(password || ''), row.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
    // Forzar admin solo si el email coincide
    let role = row.role || 'user';
    if (String(row.email).toLowerCase() === ADMIN_EMAIL) role = 'admin';
    else if (role === 'admin' && String(row.email).toLowerCase() !== ADMIN_EMAIL) role = 'user';
    if (role === 'admin' && row.role !== 'admin') {
      await db.updateUser(row.id, { role: 'admin', __allowRole: true });
    }
    db.bumpLogin();
    const token = jwt.sign(
      { id: row.id, username: row.username, email: row.email, role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: {
        id: row.id, username: row.username, email: row.email,
        firstName: row.firstName, lastName: row.lastName, role,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

app.post('/api/password/forgot', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Correo requerido' });
    const rt = await db.createResetToken(email);
    // Por seguridad no revelamos si existe; en demo devolvemos el token
    if (!rt) return res.json({ ok: true, message: 'Si el correo existe, recibirás instrucciones.' });
    console.log('[PlayZone] Token recuperación para', rt.email, '→', rt.token);
    res.json({
      ok: true,
      message: 'Token generado (demo: se muestra aquí; en producción iría por email).',
      token: rt.token,
      demoNote: 'Copia este token y úsalo en Restablecer contraseña.',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error' });
  }
});

app.post('/api/password/reset', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'Token y contraseña requeridos' });
    if (String(password).length < 4) return res.status(400).json({ error: 'Contraseña muy corta' });
    const hash = await bcrypt.hash(String(password), 10);
    const u = await db.consumeResetToken(String(token), hash);
    if (!u) return res.status(400).json({ error: 'Token inválido o expirado' });
    res.json({ ok: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error' });
  }
});

// ── Perfil ─────────────────────────────────────────────────────────────────
app.get('/api/me', auth, async (req, res) => {
  const u = await db.findUserById(req.user.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(u);
});

app.put('/api/me', auth, async (req, res) => {
  try {
    const { firstName, lastName, username } = req.body || {};
    const patch = {};
    if (firstName !== undefined) patch.firstName = String(firstName).slice(0, 60);
    if (lastName !== undefined) patch.lastName = String(lastName).slice(0, 60);
    if (username !== undefined) {
      const un = String(username).trim().slice(0, 40);
      if (un) patch.username = un;
    }
    const u = await db.updateUser(req.user.id, patch);
    res.json({
      id: u.id, username: u.username, email: u.email,
      firstName: u.firstName, lastName: u.lastName, role: u.role || 'user',
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

app.delete('/api/me', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(400).json({ error: 'El admin no puede eliminar su cuenta desde aquí' });
    }
    await db.deleteUser(req.user.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar cuenta' });
  }
});

// ── Juegos ─────────────────────────────────────────────────────────────────
app.get('/api/games', async (req, res) => {
  try {
    const games = await db.getGames(req.query.category);
    res.json(games);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo leer el catálogo: ' + e.message });
  }
});

app.get('/api/games/:id', async (req, res) => {
  const g = await db.getGame(req.params.id);
  if (!g) return res.status(404).json({ error: 'No encontrado' });
  const reviews = await db.getReviews(g.id);
  res.json({ ...g, reviews });
});

app.post('/api/games', auth, adminOnly, async (req, res) => {
  try {
    const v = validateGamePayload(req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    const g = await db.addGame(v.clean);
    res.status(201).json(g);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Error' });
  }
});

app.put('/api/games/:id', auth, adminOnly, async (req, res) => {
  try {
    const v = validateGamePayload({ ...(await db.getGame(req.params.id) || {}), ...(req.body || {}) });
    if (!v.ok) return res.status(400).json({ error: v.error });
    const g = await db.updateGame(req.params.id, v.clean);
    if (!g) return res.status(404).json({ error: 'No encontrado' });
    res.json(g);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Error' });
  }
});

app.delete('/api/games/:id', auth, adminOnly, async (req, res) => {
  const prev = await db.getGame(req.params.id);
  if (prev?.fileName) {
    const fp = path.join(UPLOADS_DIR, path.basename(prev.fileName));
    try { fs.unlinkSync(fp); } catch {}
  }
  await db.deleteGame(req.params.id);
  res.json({ ok: true });
});

/** Descarga el archivo del juego DESDE PlayZone (no redirige a links externos) */
app.get('/api/games/:id/download', async (req, res) => {
  try {
    const g = await db.getGame(req.params.id);
    if (!g || g.active === false) return res.status(404).json({ error: 'Juego no encontrado' });

    if (g.fileName) {
      const fp = path.join(UPLOADS_DIR, path.basename(g.fileName));
      if (!fs.existsSync(fp)) {
        return res.status(404).json({ error: 'Archivo no encontrado en el servidor. El admin debe volver a subirlo.' });
      }
      const original = g.fileOriginal || g.fileName;
      res.download(fp, original);
      return;
    }

    // Sin archivo local: no enviamos al usuario a MediaFire/etc.
    return res.status(404).json({
      error: 'Este juego aún no tiene archivo alojado en PlayZone. Un administrador debe subirlo desde el panel Admin.',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al descargar' });
  }
});

/** Admin: subir archivo del juego (cuerpo binario + header X-Filename) */
app.post(
  '/api/games/:id/upload',
  auth,
  adminOnly,
  express.raw({ type: '*/*', limit: '512mb' }),
  async (req, res) => {
    try {
      const g = await db.getGame(req.params.id);
      if (!g) return res.status(404).json({ error: 'Juego no encontrado' });
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'No se recibió el archivo' });
      }
      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      if (!rateLimit('upload:' + (req.user?.id || ip), 10, 15 * 60 * 1000)) {
        return res.status(429).json({ error: 'Demasiadas subidas. Espera unos minutos.' });
      }
      const original = String(req.headers['x-filename'] || 'juego.bin').replace(/[^a-zA-Z0-9._-]/g, '_');
      const check = isAllowedGameFile(original, req.body);
      if (!check.ok) return res.status(400).json({ error: check.error });
      const stored = `${g.id}-${Date.now()}-${original}`;
      const fp = path.join(UPLOADS_DIR, path.basename(stored));
      if (g.fileName) {
        try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(g.fileName))); } catch {}
      }
      fs.writeFileSync(fp, req.body);
      const updated = await db.updateGame(g.id, {
        ...g,
        fileName: stored,
        fileOriginal: original,
        downloadUrl: `/api/games/${g.id}/download`,
      });
      res.json({ ok: true, game: updated, size: req.body.length });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Error al subir archivo' });
    }
  }
);

app.get('/api/admin/games', auth, adminOnly, async (_req, res) => {
  res.json(await db.getAllGamesAdmin());
});

// ── Reseñas ────────────────────────────────────────────────────────────────
app.get('/api/games/:id/reviews', async (req, res) => {
  res.json(await db.getReviews(req.params.id));
});

app.post('/api/games/:id/reviews', auth, async (req, res) => {
  try {
    const { rating, text } = req.body || {};
    const rev = await db.addReview({
      gameId: req.params.id,
      userId: req.user.id,
      username: req.user.username,
      rating,
      text,
    });
    res.status(201).json(rev);
  } catch (e) {
    res.status(500).json({ error: 'Error al guardar reseña' });
  }
});

app.delete('/api/reviews/:id', auth, async (req, res) => {
  const ok = await db.deleteReview(req.params.id, req.user.id, req.user.role === 'admin');
  if (!ok) return res.status(403).json({ error: 'No permitido' });
  res.json({ ok: true });
});

// ── Biblioteca / carrito ────────────────────────────────────────────────────
app.get('/api/library', auth, async (req, res) => {
  res.json(await db.getLibrary(req.user.id));
});
app.post('/api/library/:gameId', auth, async (req, res) => {
  await db.addToLibrary(req.user.id, req.params.gameId);
  res.json({ ok: true });
});
app.get('/api/cart', auth, async (req, res) => {
  res.json(await db.getCart(req.user.id));
});
app.post('/api/cart/:gameId', auth, async (req, res) => {
  await db.addToCart(req.user.id, req.params.gameId);
  res.json({ ok: true });
});
app.delete('/api/cart/:gameId', auth, async (req, res) => {
  await db.removeFromCart(req.user.id, req.params.gameId);
  res.json({ ok: true });
});
app.post('/api/checkout', auth, async (req, res) => {
  try {
    const method = String((req.body || {}).paymentMethod || 'tarjeta').toLowerCase();
    const allowed = new Set(['tarjeta', 'pse', 'nequi', 'paypal']);
    if (!allowed.has(method)) {
      return res.status(400).json({ error: 'Método de pago no válido. Usa: tarjeta, pse, nequi o paypal' });
    }
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (!rateLimit('pay:' + req.user.id, 20, 15 * 60 * 1000)) {
      return res.status(429).json({ error: 'Demasiados intentos de pago' });
    }
    // DEMO: no se conecta a pasarela real (Stripe/PayU). Simula cobro OK.
    const n = await db.checkout(req.user.id);
    if (!n) {
      return res.status(400).json({ error: 'El carrito está vacío' });
    }
    res.json({
      ok: true,
      items: n,
      paymentMethod: method,
      demo: true,
      message: `Pago demo con ${method} aceptado. ${n} juego(s) en tu biblioteca. Ya puedes descargarlos desde PlayZone.`,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error en el pago' });
  }
});

// ── Chat comunidad ─────────────────────────────────────────────────────────
app.get('/api/messages', async (_req, res) => {
  res.json(await db.getMessages());
});
app.post('/api/messages', auth, async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Mensaje vacío' });
  const m = await db.addMessage({ userId: req.user.id, username: req.user.username, text });
  res.status(201).json(m);
});

// ── DMs ────────────────────────────────────────────────────────────────────
app.get('/api/users', auth, async (_req, res) => {
  const users = await db.listUsers();
  res.json(users.filter((u) => u.active !== false).map((u) => ({
    id: u.id, username: u.username, role: u.role,
  })));
});
app.get('/api/dms', auth, async (req, res) => {
  res.json(await db.listDms(req.user.id));
});
app.post('/api/dms', auth, async (req, res) => {
  const otherId = req.body?.userId;
  if (!otherId || otherId === req.user.id) return res.status(400).json({ error: 'Usuario inválido' });
  const dm = await db.openDm(req.user.id, otherId);
  res.json(dm);
});
app.get('/api/dms/:id', auth, async (req, res) => {
  const dm = await db.getDm(req.params.id, req.user.id);
  if (!dm) return res.status(404).json({ error: 'Chat no encontrado' });
  res.json(dm);
});
app.post('/api/dms/:id/messages', auth, async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Vacío' });
  const m = await db.sendDm(req.params.id, req.user.id, text);
  if (!m) return res.status(404).json({ error: 'Chat no encontrado' });
  res.status(201).json(m);
});

// ── IA ─────────────────────────────────────────────────────────────────────
app.get('/api/ai', auth, async (req, res) => {
  res.json(await db.getAiHistory(req.user.id));
});
app.post('/api/ai', auth, async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Vacío' });
  await db.addAiMessage(req.user.id, 'user', text);
  const reply = aiReply(text);
  const bot = await db.addAiMessage(req.user.id, 'assistant', reply);
  res.json({ reply: bot });
});
app.delete('/api/ai', auth, async (req, res) => {
  await db.clearAiHistory(req.user.id);
  res.json({ ok: true });
});

// ── Streams / stats ────────────────────────────────────────────────────────
app.get('/api/streams', async (_req, res) => {
  res.json(await db.getStreams());
});
app.post('/api/streams', auth, async (req, res) => {
  const title = String(req.body?.title || 'Stream de ' + req.user.username).slice(0, 80);
  const s = await db.addStream({ userId: req.user.id, username: req.user.username, title });
  res.status(201).json(s);
});
app.get('/api/admin/stats', auth, adminOnly, async (_req, res) => {
  res.json(await db.getStats());
});

// ── SSR home ───────────────────────────────────────────────────────────────
app.get('/', async (req, res) => {
  try {
    db.bumpVisit();
    const games = await db.getGames();
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    html = html.replace('<!--GAMES_SSR-->', games.map(cardHtml).join('\n'));
    html = html.replace('<!--GAMES_COUNT-->', String(games.length));
    res.type('html').send(html);
  } catch (e) {
    console.error('No se pudo leer el catálogo:', e.message);
    res.status(500).send('Error al cargar PlayZone: ' + e.message);
  }
});

app.listen(PORT, () => {
  console.log(`PlayZone listo → http://localhost:${PORT}`);
  console.log(`Modo BD: ${db.mode}`);
  console.log(`Admin email: ${getAdminEmail()} (solo este correo obtiene rol admin)`);
});
