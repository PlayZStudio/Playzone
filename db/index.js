/**
 * Capa unificada — por defecto JSON (sin MySQL).
 * Solo usa MySQL si MYSQL_HOST está definido y conecta bien.
 */
import { isMysqlConfigured, mysqlDb } from './mysql.js';
import { jsonDb } from './json.js';

const useMysql = isMysqlConfigured();
console.log(useMysql ? 'Base de datos: MySQL' : 'Base de datos: JSON local (data/db.json)');

export const db = {
  mode: useMysql ? 'mysql' : 'json',

  getGames(category) {
    return useMysql ? mysqlDb.getGames(category) : Promise.resolve(jsonDb.getGames(category));
  },
  getGame(id) {
    return useMysql ? mysqlDb.getGame(id) : Promise.resolve(jsonDb.getGame(id));
  },
  getAllGamesAdmin() {
    return Promise.resolve(jsonDb.getAllGamesAdmin());
  },
  addGame(g) { return Promise.resolve(jsonDb.addGame(g)); },
  updateGame(id, p) { return Promise.resolve(jsonDb.updateGame(id, p)); },
  deleteGame(id) { return Promise.resolve(jsonDb.deleteGame(id)); },

  async register({ username, email, passwordHash, firstName, lastName, role }) {
    if (useMysql) {
      return mysqlDb.registerUser({ username, email, passwordHash, firstName, lastName });
    }
    if (jsonDb.findUserByEmail(email) || jsonDb.findUserByUsername(username)) {
      const err = new Error('Usuario o correo ya registrado');
      err.code = 'DUPLICATE';
      throw err;
    }
    const user = {
      id: jsonDb.uuid(),
      username,
      email,
      passwordHash,
      firstName: firstName || username,
      lastName: lastName || '',
      role: role || 'user',
      active: true,
      createdAt: new Date().toISOString(),
    };
    jsonDb.addUser(user);
    return { id: user.id, username, email, firstName: user.firstName, lastName: user.lastName, role: user.role };
  },

  async loginByEmail(email) {
    if (useMysql) {
      const row = await mysqlDb.findAccessByEmail(email);
      if (!row) return null;
      return {
        id: String(row.user_id), username: row.acce_user_name, email: row.user_email,
        passwordHash: row.acce_password_hash, active: row.user_is_active && row.acce_is_active,
        firstName: row.user_first_name, lastName: row.user_last_name, role: 'user',
      };
    }
    const u = jsonDb.findUserByEmail(email);
    if (!u) return null;
    return {
      id: u.id, username: u.username, email: u.email, passwordHash: u.passwordHash,
      active: u.active !== false, firstName: u.firstName || u.username, lastName: u.lastName || '',
      role: u.role || 'user',
    };
  },

  async findUserById(id) {
    if (useMysql) return mysqlDb.findUserById(id);
    const u = jsonDb.findUserById(id);
    if (!u) return null;
    return {
      id: u.id, username: u.username, email: u.email,
      firstName: u.firstName || u.username, lastName: u.lastName || '',
      role: u.role || 'user', createdAt: u.createdAt, active: u.active !== false,
    };
  },

  updateUser(id, patch) { return Promise.resolve(jsonDb.updateUser(id, patch)); },
  deleteUser(id) { return Promise.resolve(jsonDb.deleteUser(id)); },
  listUsers() { return Promise.resolve(jsonDb.listUsers()); },

  getLibrary(userId) {
    return useMysql ? mysqlDb.getLibrary(userId) : Promise.resolve(jsonDb.getLibrary(userId));
  },
  addToLibrary(userId, gameId) { return Promise.resolve(jsonDb.addToLibrary(userId, gameId)); },
  getCart(userId) {
    return useMysql ? mysqlDb.getCart(userId) : Promise.resolve(jsonDb.getCart(userId));
  },
  addToCart(userId, gameId) {
    return useMysql ? mysqlDb.addToCart(userId, gameId) : Promise.resolve(jsonDb.addToCart(userId, gameId));
  },
  removeFromCart(userId, gameId) {
    return useMysql ? mysqlDb.removeFromCart(userId, gameId) : Promise.resolve(jsonDb.removeFromCart(userId, gameId));
  },
  checkout(userId) {
    return useMysql ? mysqlDb.checkout(userId) : Promise.resolve(jsonDb.checkout(userId));
  },
  getMessages() {
    return useMysql ? mysqlDb.getMessages() : Promise.resolve(jsonDb.getMessages());
  },
  addMessage(msg) {
    return useMysql
      ? mysqlDb.addMessage({ userId: msg.userId, username: msg.username, text: msg.text })
      : Promise.resolve(jsonDb.addMessage(msg));
  },
  getStreams() {
    return useMysql ? mysqlDb.getStreams() : Promise.resolve(jsonDb.getStreams());
  },
  addStream(stream) {
    return useMysql
      ? mysqlDb.addStream({ userId: stream.userId, username: stream.username, title: stream.title })
      : Promise.resolve(jsonDb.addStream(stream));
  },

  // extras JSON
  listDms(userId) { return Promise.resolve(jsonDb.listDmsForUser(userId)); },
  openDm(a, b) { return Promise.resolve(jsonDb.getOrCreateDm(a, b)); },
  getDm(dmId, userId) { return Promise.resolve(jsonDb.getDmMessages(dmId, userId)); },
  sendDm(dmId, from, text) { return Promise.resolve(jsonDb.sendDm(dmId, from, text)); },
  getAiHistory(userId) { return Promise.resolve(jsonDb.getAiHistory(userId)); },
  addAiMessage(userId, role, text) { return Promise.resolve(jsonDb.addAiMessage(userId, role, text)); },
  clearAiHistory(userId) { return Promise.resolve(jsonDb.clearAiHistory(userId)); },
  getReviews(gameId) { return Promise.resolve(jsonDb.getReviews(gameId)); },
  addReview(r) { return Promise.resolve(jsonDb.addReview(r)); },
  deleteReview(id, userId, isAdmin) { return Promise.resolve(jsonDb.deleteReview(id, userId, isAdmin)); },
  createResetToken(email) { return Promise.resolve(jsonDb.createResetToken(email)); },
  consumeResetToken(token, hash) { return Promise.resolve(jsonDb.consumeResetToken(token, hash)); },
  bumpVisit() { try { jsonDb.bumpVisit(); } catch {} },
  bumpLogin() { try { jsonDb.bumpLogin(); } catch {} },
  getStats() { return Promise.resolve(jsonDb.getStats()); },
  uuid() { return jsonDb.uuid(); },
};
