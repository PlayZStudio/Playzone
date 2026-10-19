/**
 * PlayZone — base JSON local (data/db.json)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID, randomBytes } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_GAMES = [
  {
    id: '9',
    title: 'SuperTuxKart',
    price: 0,
    originalPrice: null,
    discount: 0,
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTyOpj9_Maq-Md6truGXGD3A6MhnIAJ7dA_HxE-_N7UoQYTPDAckbWF9uqY&s=10',
    rating: 4.8,
    ratingCount: 12,
    category: 'Carreras',
    tags: ['Open Source', 'GPL', 'Multijugador', 'Gratis'],
    description: 'Carreras de karts con mascotas del software libre (Tux y amigos). Totalmente gratis y de codigo abierto (GPL v3).',
    downloadUrl: 'https://supertuxkart.net/Download',
    license: 'GPL v3',
    active: true,
  },
  {
    id: '10',
    title: 'Granny',
    price: 0,
    originalPrice: null,
    discount: 0,
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQZhvoGgg61DzaURpF_VkUjvCX1Drs_C4IyNhwiv8mzUA&s',
    rating: 4.2,
    ratingCount: 8,
    category: 'Terror',
    tags: ['Terror', 'Survival', 'Gratis'],
    description: 'Survival horror: escapa de la casa de Granny sin ser atrapado.',
    downloadUrl: 'https://www.mediafire.com/file/t43kolgn6ggpaaw/G2018PG.gamezfull.com.rar/file',
    license: 'Freeware',
    active: true,
  },
];

const DEFAULT = {
  users: [],
  games: DEFAULT_GAMES.slice(),
  library: [],
  cart: [],
  messages: [],
  dms: [],
  aiChats: [],
  reviews: [],
  resetTokens: [],
  streams: [],
  stats: { visits: 0, logins: 0 },
};

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT, null, 2));
    return;
  }
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    let changed = false;
    for (const k of Object.keys(DEFAULT)) {
      if (data[k] === undefined) {
        data[k] = Array.isArray(DEFAULT[k]) ? [] : DEFAULT[k];
        changed = true;
      }
    }
    if (!Array.isArray(data.games)) data.games = [];
    const byId = new Map(data.games.map((g) => [String(g.id), g]));
    for (const g of DEFAULT_GAMES) {
      if (!byId.has(String(g.id))) {
        data.games.push({ ...g });
        changed = true;
      }
    }
    for (const u of data.users || []) {
      if (!u.role) { u.role = 'user'; changed = true; }
    }
    if (changed) fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT, null, 2));
  }
}

function read() {
  ensure();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function write(data) {
  ensure();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
function uuid() { return randomUUID(); }

function recomputeGameRating(data, gameId) {
  const revs = data.reviews.filter((r) => r.gameId === gameId);
  const g = data.games.find((x) => x.id === gameId);
  if (!g) return;
  if (!revs.length) { g.ratingCount = 0; return; }
  const sum = revs.reduce((a, r) => a + Number(r.rating), 0);
  g.rating = Math.round((sum / revs.length) * 10) / 10;
  g.ratingCount = revs.length;
}

export const jsonDb = {
  uuid,
  get: read,
  save: write,
  findUserByEmail(email) {
    return read().users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
  },
  findUserById(id) { return read().users.find((u) => u.id === id); },
  findUserByUsername(username) {
    return read().users.find((u) => u.username?.toLowerCase() === String(username).toLowerCase());
  },
  listUsers() {
    return read().users.map((u) => ({
      id: u.id, username: u.username, email: u.email,
      firstName: u.firstName, lastName: u.lastName,
      role: u.role || 'user', createdAt: u.createdAt, active: u.active !== false,
    }));
  },
  addUser(user) {
    const data = read(); data.users.push(user); write(data); return user;
  },
  updateUser(id, patch) {
    const data = read();
    const i = data.users.findIndex((u) => u.id === id);
    if (i < 0) return null;
    data.users[i] = { ...data.users[i], ...patch, id };
    write(data); return data.users[i];
  },
  deleteUser(id) {
    const data = read();
    data.users = data.users.filter((u) => u.id !== id);
    data.library = data.library.filter((l) => l.userId !== id);
    data.cart = data.cart.filter((c) => c.userId !== id);
    data.messages = data.messages.filter((m) => m.userId !== id);
    data.reviews = data.reviews.filter((r) => r.userId !== id);
    data.dms = data.dms.filter((d) => !d.participants.includes(id));
    data.aiChats = data.aiChats.filter((c) => c.userId !== id);
    data.streams = data.streams.filter((s) => s.userId !== id);
    write(data); return true;
  },
  getGames(category) {
    let games = read().games.filter((g) => g.active !== false);
    if (!games.length) {
      const data = read(); data.games = DEFAULT_GAMES.slice(); write(data); games = data.games;
    }
    if (!category || category === 'all') return games;
    return games.filter((g) => String(g.category).toLowerCase() === String(category).toLowerCase());
  },
  getAllGamesAdmin() { return read().games; },
  getGame(id) { return read().games.find((g) => g.id === id); },
  addGame(game) {
    const data = read();
    const g = {
      id: game.id || uuid(), title: game.title, price: Number(game.price) || 0,
      originalPrice: game.originalPrice ?? null, discount: Number(game.discount) || 0,
      image: game.image, rating: 0, ratingCount: 0, category: game.category || 'Otros',
      tags: Array.isArray(game.tags) ? game.tags : String(game.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      description: game.description || '', downloadUrl: game.downloadUrl || '',
      fileName: game.fileName || '',
      fileOriginal: game.fileOriginal || '',
      license: game.license || '', active: true, createdAt: new Date().toISOString(),
    };
    if (!g.image) throw Object.assign(new Error('La imagen es obligatoria'), { code: 'NO_IMAGE' });
    data.games.push(g); write(data); return g;
  },
  updateGame(id, patch) {
    const data = read();
    const i = data.games.findIndex((g) => g.id === id);
    if (i < 0) return null;
    const next = { ...data.games[i], ...patch, id };
    if (!next.image) throw Object.assign(new Error('La imagen es obligatoria'), { code: 'NO_IMAGE' });
    data.games[i] = next; write(data); return next;
  },
  deleteGame(id) {
    const data = read();
    data.games = data.games.filter((g) => g.id !== id);
    data.reviews = data.reviews.filter((r) => r.gameId !== id);
    data.library = data.library.filter((l) => l.gameId !== id);
    data.cart = data.cart.filter((c) => c.gameId !== id);
    write(data); return true;
  },
  getLibrary(userId) {
    const data = read();
    const ids = data.library.filter((l) => l.userId === userId).map((l) => l.gameId);
    return data.games.filter((g) => ids.includes(g.id));
  },
  addToLibrary(userId, gameId) {
    const data = read();
    if (!data.library.some((l) => l.userId === userId && l.gameId === gameId)) {
      data.library.push({ userId, gameId, purchasedAt: new Date().toISOString() });
      write(data);
    }
  },
  getCart(userId) {
    const data = read();
    const ids = data.cart.filter((c) => c.userId === userId).map((c) => c.gameId);
    return data.games.filter((g) => ids.includes(g.id));
  },
  addToCart(userId, gameId) {
    const data = read();
    if (!data.cart.some((c) => c.userId === userId && c.gameId === gameId)) {
      data.cart.push({ userId, gameId }); write(data);
    }
  },
  removeFromCart(userId, gameId) {
    const data = read();
    data.cart = data.cart.filter((c) => !(c.userId === userId && c.gameId === gameId));
    write(data);
  },
  checkout(userId) {
    const data = read();
    const items = data.cart.filter((c) => c.userId === userId);
    for (const it of items) {
      if (!data.library.some((l) => l.userId === userId && l.gameId === it.gameId)) {
        data.library.push({ userId, gameId: it.gameId, purchasedAt: new Date().toISOString() });
      }
    }
    data.cart = data.cart.filter((c) => c.userId !== userId);
    write(data); return items.length;
  },
  getMessages(limit = 100) { return read().messages.slice(-limit); },
  addMessage(msg) {
    const data = read();
    const m = { id: uuid(), userId: msg.userId, username: msg.username, text: String(msg.text).slice(0, 500), createdAt: new Date().toISOString() };
    data.messages.push(m);
    if (data.messages.length > 500) data.messages = data.messages.slice(-400);
    write(data); return m;
  },
  getOrCreateDm(userA, userB) {
    const data = read();
    const pair = [userA, userB].sort();
    let dm = data.dms.find((d) => d.participants.length === 2 && d.participants.includes(pair[0]) && d.participants.includes(pair[1]));
    if (!dm) {
      dm = { id: uuid(), participants: pair, messages: [], updatedAt: new Date().toISOString() };
      data.dms.push(dm); write(data);
    }
    return dm;
  },
  listDmsForUser(userId) {
    const data = read();
    return data.dms.filter((d) => d.participants.includes(userId)).map((d) => {
      const otherId = d.participants.find((p) => p !== userId);
      const other = data.users.find((u) => u.id === otherId);
      const last = d.messages[d.messages.length - 1];
      return { id: d.id, otherId, otherName: other?.username || 'Usuario', lastMessage: last?.text || '', lastAt: last?.at || d.updatedAt };
    }).sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));
  },
  getDmMessages(dmId, userId) {
    const data = read();
    const dm = data.dms.find((d) => d.id === dmId);
    if (!dm || !dm.participants.includes(userId)) return null;
    return dm;
  },
  sendDm(dmId, fromId, text) {
    const data = read();
    const dm = data.dms.find((d) => d.id === dmId);
    if (!dm || !dm.participants.includes(fromId)) return null;
    const m = { id: uuid(), from: fromId, text: String(text).slice(0, 1000), at: new Date().toISOString() };
    dm.messages.push(m); dm.updatedAt = m.at; write(data); return m;
  },
  getAiHistory(userId) {
    const data = read();
    let chat = data.aiChats.find((c) => c.userId === userId);
    if (!chat) { chat = { userId, messages: [] }; data.aiChats.push(chat); write(data); }
    return chat.messages;
  },
  addAiMessage(userId, role, text) {
    const data = read();
    let chat = data.aiChats.find((c) => c.userId === userId);
    if (!chat) { chat = { userId, messages: [] }; data.aiChats.push(chat); }
    const m = { role, text: String(text).slice(0, 2000), at: new Date().toISOString() };
    chat.messages.push(m);
    if (chat.messages.length > 80) chat.messages = chat.messages.slice(-60);
    write(data); return m;
  },
  clearAiHistory(userId) {
    const data = read();
    const chat = data.aiChats.find((c) => c.userId === userId);
    if (chat) chat.messages = [];
    write(data);
  },
  getReviews(gameId) {
    return read().reviews.filter((r) => r.gameId === gameId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  addReview({ gameId, userId, username, rating, text }) {
    const data = read();
    const stars = Math.min(5, Math.max(1, Number(rating) || 1));
    data.reviews = data.reviews.filter((r) => !(r.gameId === gameId && r.userId === userId));
    const rev = { id: uuid(), gameId, userId, username, rating: stars, text: String(text || '').slice(0, 800), createdAt: new Date().toISOString() };
    data.reviews.push(rev); recomputeGameRating(data, gameId); write(data); return rev;
  },
  deleteReview(id, userId, isAdmin) {
    const data = read();
    const rev = data.reviews.find((r) => r.id === id);
    if (!rev) return false;
    if (!isAdmin && rev.userId !== userId) return false;
    data.reviews = data.reviews.filter((r) => r.id !== id);
    recomputeGameRating(data, rev.gameId); write(data); return true;
  },
  createResetToken(email) {
    const data = read();
    const user = data.users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
    if (!user) return null;
    const token = randomBytes(24).toString('hex');
    data.resetTokens = data.resetTokens.filter((t) => t.email.toLowerCase() !== email.toLowerCase());
    data.resetTokens.push({ email: user.email, token, expires: Date.now() + 1000 * 60 * 30 });
    write(data); return { token, email: user.email };
  },
  consumeResetToken(token, newPasswordHash) {
    const data = read();
    const rt = data.resetTokens.find((t) => t.token === token && t.expires > Date.now());
    if (!rt) return null;
    const u = data.users.find((x) => x.email?.toLowerCase() === rt.email.toLowerCase());
    if (!u) return null;
    u.passwordHash = newPasswordHash;
    data.resetTokens = data.resetTokens.filter((t) => t.token !== token);
    write(data); return u;
  },
  getStreams() { return read().streams; },
  addStream(s) {
    const data = read();
    const st = { id: uuid(), userId: s.userId, username: s.username, title: s.title, viewers: Math.floor(Math.random() * 40) + 1, live: true, createdAt: new Date().toISOString() };
    data.streams.unshift(st); write(data); return st;
  },
  bumpVisit() {
    const data = read(); data.stats = data.stats || { visits: 0, logins: 0 };
    data.stats.visits = (data.stats.visits || 0) + 1; write(data);
  },
  bumpLogin() {
    const data = read(); data.stats = data.stats || { visits: 0, logins: 0 };
    data.stats.logins = (data.stats.logins || 0) + 1; write(data);
  },
  getStats() {
    const data = read();
    return {
      visits: data.stats?.visits || 0, logins: data.stats?.logins || 0,
      users: data.users.length, games: data.games.length,
      activeGames: data.games.filter((g) => g.active !== false).length,
      reviews: data.reviews.length, communityMessages: data.messages.length,
      privateChats: data.dms.length, libraryEntries: data.library.length, streams: data.streams.length,
    };
  },
};
