import mysql from 'mysql2/promise';

let pool = null;

export function isMysqlConfigured() {
  return Boolean(process.env.MYSQL_HOST || process.env.MYSQL_URL);
}

export async function getPool() {
  if (pool) return pool;
  if (process.env.MYSQL_URL) {
    pool = mysql.createPool(process.env.MYSQL_URL);
  } else {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'db_playzone',
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    });
  }
  return pool;
}

function mapGame(row) {
  if (!row) return null;
  let tags = row.game_tags;
  if (typeof tags === 'string') {
    try { tags = JSON.parse(tags); } catch { tags = []; }
  }
  return {
    id: String(row.game_id),
    title: row.game_title,
    price: Number(row.game_price),
    originalPrice: row.game_original_price != null ? Number(row.game_original_price) : null,
    discount: Number(row.game_discount || 0),
    image: row.game_image,
    rating: Number(row.game_rating),
    category: row.game_category,
    tags: tags || [],
    description: row.game_description,
    downloadUrl: row.game_download_url,
    license: row.game_license,
  };
}

export const mysqlDb = {
  async getGames(category) {
    const p = await getPool();
    let sql = 'SELECT * FROM games WHERE game_is_active = 1';
    const params = {};
    if (category && category !== 'all') {
      sql += ' AND game_category = :category';
      params.category = category;
    }
    sql += ' ORDER BY game_title';
    const [rows] = await p.query(sql, params);
    return rows.map(mapGame);
  },

  async getGame(id) {
    const p = await getPool();
    const [rows] = await p.query('SELECT * FROM games WHERE game_id = :id AND game_is_active = 1', { id });
    return mapGame(rows[0]);
  },

  async findAccessByEmail(email) {
    const p = await getPool();
    const [rows] = await p.query(
      `SELECT u.user_id, u.user_email, u.user_first_name, u.user_last_name, u.user_is_active,
              a.acce_id, a.acce_user_name, a.acce_password_hash, a.acce_is_active,
              a.acce_failed_attempts, a.acce_locked_until
       FROM users u
       INNER JOIN accesses a ON a.user_id = u.user_id
       WHERE u.user_email = :email LIMIT 1`,
      { email }
    );
    return rows[0] || null;
  },

  async findAccessByUsername(username) {
    const p = await getPool();
    const [rows] = await p.query(
      `SELECT u.user_id, u.user_email, u.user_first_name, u.user_last_name, u.user_is_active,
              a.acce_id, a.acce_user_name, a.acce_password_hash, a.acce_is_active
       FROM users u
       INNER JOIN accesses a ON a.user_id = u.user_id
       WHERE a.acce_user_name = :username LIMIT 1`,
      { username }
    );
    return rows[0] || null;
  },

  async findUserById(id) {
    const p = await getPool();
    const [rows] = await p.query(
      `SELECT u.user_id, u.user_email, u.user_first_name, u.user_last_name, a.acce_user_name
       FROM users u
       LEFT JOIN accesses a ON a.user_id = u.user_id
       WHERE u.user_id = :id LIMIT 1`,
      { id }
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: String(r.user_id),
      username: r.acce_user_name || r.user_first_name,
      email: r.user_email,
      firstName: r.user_first_name,
      lastName: r.user_last_name,
    };
  },

  async registerUser({ username, email, passwordHash, firstName, lastName }) {
    const p = await getPool();
    const conn = await p.getConnection();
    try {
      await conn.beginTransaction();
      const [uRes] = await conn.query(
        `INSERT INTO users (user_first_name, user_last_name, user_email, user_is_active)
         VALUES (:firstName, :lastName, :email, 1)`,
        {
          firstName: firstName || username,
          lastName: lastName || '',
          email,
        }
      );
      const userId = uRes.insertId;
      await conn.query(
        `INSERT INTO accesses (user_id, acce_user_name, acce_password_hash, acce_is_active, acce_failed_attempts)
         VALUES (:userId, :username, :passwordHash, 1, 0)`,
        { userId, username, passwordHash }
      );
      const [roles] = await conn.query(`SELECT role_id FROM roles WHERE role_code = 'PLAYER' LIMIT 1`);
      if (roles[0]) {
        await conn.query(
          `INSERT INTO users_roles (user_id, role_id) VALUES (:userId, :roleId)`,
          { userId, roleId: roles[0].role_id }
        );
      }
      await conn.commit();
      return {
        id: String(userId),
        username,
        email,
        firstName: firstName || username,
        lastName: lastName || '',
      };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  async touchLogin(userId) {
    const p = await getPool();
    await p.query(
      `UPDATE accesses SET acce_last_login_at = NOW(6), acce_failed_attempts = 0 WHERE user_id = :userId`,
      { userId }
    );
  },

  async getLibrary(userId) {
    const p = await getPool();
    const [rows] = await p.query(
      `SELECT g.* FROM library l
       INNER JOIN games g ON g.game_id = l.game_id
       WHERE l.user_id = :userId AND g.game_is_active = 1`,
      { userId }
    );
    return rows.map(mapGame);
  },

  async getCart(userId) {
    const p = await getPool();
    const [rows] = await p.query(
      `SELECT g.* FROM cart c
       INNER JOIN games g ON g.game_id = c.game_id
       WHERE c.user_id = :userId AND g.game_is_active = 1`,
      { userId }
    );
    return rows.map(mapGame);
  },

  async addToCart(userId, gameId) {
    const p = await getPool();
    try {
      await p.query(
        `INSERT INTO cart (user_id, game_id) VALUES (:userId, :gameId)`,
        { userId, gameId }
      );
      return { ok: true };
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return { error: 'Ya está en el carrito' };
      throw e;
    }
  },

  async removeFromCart(userId, gameId) {
    const p = await getPool();
    await p.query(`DELETE FROM cart WHERE user_id = :userId AND game_id = :gameId`, { userId, gameId });
    return { ok: true };
  },

  async checkout(userId) {
    const p = await getPool();
    const conn = await p.getConnection();
    try {
      await conn.beginTransaction();
      const [items] = await conn.query(
        `SELECT c.game_id, g.game_price FROM cart c
         INNER JOIN games g ON g.game_id = c.game_id WHERE c.user_id = :userId`,
        { userId }
      );
      if (!items.length) {
        await conn.rollback();
        return { error: 'Carrito vacío' };
      }
      let total = 0;
      for (const it of items) {
        total += Number(it.game_price);
        await conn.query(
          `INSERT IGNORE INTO library (user_id, game_id) VALUES (:userId, :gameId)`,
          { userId, gameId: it.game_id }
        );
      }
      await conn.query(`DELETE FROM cart WHERE user_id = :userId`, { userId });
      await conn.commit();
      return { ok: true, total, count: items.length };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  async getMessages() {
    const p = await getPool();
    const [rows] = await p.query(
      `SELECT m.msg_id AS id, m.user_id AS userId, a.acce_user_name AS username,
              m.msg_text AS text, m.msg_created_at AS createdAt
       FROM messages m
       LEFT JOIN accesses a ON a.user_id = m.user_id
       ORDER BY m.msg_created_at DESC LIMIT 100`
    );
    return rows.reverse().map((r) => ({
      id: String(r.id),
      userId: String(r.userId),
      username: r.username || 'user',
      text: r.text,
      createdAt: r.createdAt,
    }));
  },

  async addMessage({ userId, username, text }) {
    const p = await getPool();
    const [res] = await p.query(
      `INSERT INTO messages (user_id, msg_text) VALUES (:userId, :text)`,
      { userId, text }
    );
    return {
      id: String(res.insertId),
      userId: String(userId),
      username,
      text,
      createdAt: new Date().toISOString(),
    };
  },

  async getStreams() {
    const p = await getPool();
    const [rows] = await p.query(
      `SELECT s.stream_id AS id, s.user_id AS userId, a.acce_user_name AS username,
              s.stream_title AS title, s.stream_viewers AS viewers, s.stream_live AS live,
              s.stream_started_at AS startedAt
       FROM streams s
       LEFT JOIN accesses a ON a.user_id = s.user_id
       WHERE s.stream_live = 1
       ORDER BY s.stream_started_at DESC`
    );
    return rows.map((r) => ({
      id: String(r.id),
      userId: String(r.userId),
      username: r.username || 'user',
      title: r.title,
      viewers: r.viewers,
      live: Boolean(r.live),
      startedAt: r.startedAt,
    }));
  },

  async addStream({ userId, username, title }) {
    const p = await getPool();
    const viewers = Math.floor(Math.random() * 50) + 1;
    const [res] = await p.query(
      `INSERT INTO streams (user_id, stream_title, stream_viewers, stream_live)
       VALUES (:userId, :title, :viewers, 1)`,
      { userId, title, viewers }
    );
    return {
      id: String(res.insertId),
      userId: String(userId),
      username,
      title,
      viewers,
      live: true,
      startedAt: new Date().toISOString(),
    };
  },
};
