const API = {
  token: localStorage.getItem('pz_token') || '',
  user: (() => { try { return JSON.parse(localStorage.getItem('pz_user') || 'null'); } catch { return null; } })(),

  setAuth(token, user) {
    this.token = token || '';
    this.user = user || null;
    if (token) localStorage.setItem('pz_token', token); else localStorage.removeItem('pz_token');
    if (user) localStorage.setItem('pz_user', JSON.stringify(user)); else localStorage.removeItem('pz_user');
  },

  async req(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    const res = await fetch(path, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('Error ' + res.status));
    return data;
  },
};
