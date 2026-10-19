let currentCat = 'all';
let currentDmId = null;

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return [...document.querySelectorAll(sel)]; }

function mostrarVista(id) {
  $$('.vista').forEach((v) => v.classList.remove('activa'));
  const el = document.getElementById('vista-' + id);
  if (el) el.classList.add('activa');
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.vista === id));
  if (id === 'biblioteca') loadLibrary();
  if (id === 'chat') loadChat();
  if (id === 'dms') loadDms();
  if (id === 'ai') loadAi();
  if (id === 'streams') loadStreams();
  if (id === 'admin') loadAdmin();
  if (id === 'perfil') loadPerfil();
  if (id === 'carrito') loadCart();
}

function renderUserArea() {
  const area = $('#user-area');
  const navAdmin = $('#nav-admin');
  if (!API.user) {
    area.innerHTML = `<button class="btn primary" type="button" onclick="mostrarVista('login')">Entrar</button>`;
    navAdmin?.classList.add('hidden');
    return;
  }
  const isAdmin = API.user.role === 'admin';
  navAdmin?.classList.toggle('hidden', !isAdmin);
  area.innerHTML = `
    <span class="muted">${API.user.username}${isAdmin ? ' · Admin' : ''}</span>
    <button class="btn ghost" type="button" onclick="mostrarVista('perfil')">Perfil</button>
    <button class="btn ghost" type="button" id="btn-logout">Salir</button>`;
  $('#btn-logout')?.addEventListener('click', () => {
    API.setAuth('', null);
    renderUserArea();
    mostrarVista('tienda');
  });
}

function filtrarTienda() {
  const q = ($('#search-games')?.value || '').trim().toLowerCase();
  const cards = $$('#game-grid .card');
  let shown = 0;
  cards.forEach((c) => {
    const title = (c.dataset.title || '').toLowerCase();
    const cat = (c.dataset.category || '').toLowerCase();
    const tags = (c.dataset.tags || '').toLowerCase();
    const desc = (c.dataset.desc || '').toLowerCase();
    const matchQ = !q || title.includes(q) || tags.includes(q) || desc.includes(q) || cat.includes(q);
    const matchCat = currentCat === 'all' || cat === currentCat.toLowerCase();
    const ok = matchQ && matchCat;
    c.style.display = ok ? '' : 'none';
    if (ok) shown++;
  });
  $('#search-empty')?.classList.toggle('hidden', shown > 0);
}

async function loadLibrary() {
  const grid = $('#library-grid');
  const empty = $('#library-empty');
  if (!API.user) {
    grid.innerHTML = '';
    empty.textContent = 'Inicia sesión para ver tu biblioteca.';
    empty.classList.remove('hidden');
    return;
  }
  try {
    const games = await API.req('/api/library');
    empty.classList.toggle('hidden', games.length > 0);
    empty.textContent = 'Tu biblioteca está vacía.';
    grid.innerHTML = games.map((g) => `
      <article class="card">
        <img src="${g.image}" alt="" onerror="this.src='https://placehold.co/600x340/1a1035/c4b5fd?text=Game'" />
        <div class="card-body"><h3>${g.title}</h3>
          <a class="btn small primary" href="/api/games/${g.id}/download">Descargar</a>
        </div>
      </article>`).join('');
  } catch (e) {
    empty.textContent = e.message;
    empty.classList.remove('hidden');
  }
}

async function loadCart() {
  if (!API.user) { mostrarVista('login'); return; }
  try {
    const items = await API.req('/api/cart');
    $('#cart-list').innerHTML = items.map((g) => `
      <div class="admin-row">
        <img src="${g.image}" alt="" />
        <div style="flex:1"><strong>${g.title}</strong> · $${Number(g.price).toFixed(2)}</div>
        <button class="btn small danger" onclick="removeCart('${g.id}')">Quitar</button>
      </div>`).join('') || '<p class="muted">Carrito vacío</p>';
    const total = items.reduce((a, g) => a + Number(g.price), 0);
    $('#cart-total').textContent = total.toFixed(2);
    $('#cart-count').textContent = String(items.length);
  } catch (e) {
    $('#cart-list').innerHTML = `<p class="muted">${e.message}</p>`;
  }
}

window.addCart = async function (id) {
  if (!API.user) return mostrarVista('login');
  try {
    await API.req('/api/cart/' + id, { method: 'POST' });
    loadCart();
    alert('Añadido al carrito');
  } catch (e) { alert(e.message); }
};
window.removeCart = async function (id) {
  await API.req('/api/cart/' + id, { method: 'DELETE' });
  loadCart();
};
window.addFreeLibrary = async function (id) {
  if (!API.user) return mostrarVista('login');
  try {
    await API.req('/api/library/' + id, { method: 'POST' });
    alert('Añadido a tu biblioteca');
  } catch (e) { alert(e.message); }
};

window.verDetalle = async function (id) {
  mostrarVista('detalle');
  const box = $('#detalle-contenido');
  box.innerHTML = '<p class="muted">Cargando...</p>';
  try {
    const g = await API.req('/api/games/' + id);
    const stars = '★'.repeat(Math.round(g.rating || 0)) + '☆'.repeat(5 - Math.round(g.rating || 0));
    const reviews = (g.reviews || []).map((r) => `
      <div class="review">
        <strong>${r.username}</strong> · <span style="color:#fbbf24">${'★'.repeat(r.rating)}</span>
        <p>${r.text || ''}</p>
        <span class="muted">${new Date(r.createdAt).toLocaleString()}</span>
      </div>`).join('') || '<p class="muted">Sin reseñas aún</p>';
    box.innerHTML = `
      <div class="auth-card wide" style="max-width:720px">
        <img src="${g.image}" alt="" style="width:100%;max-height:280px;object-fit:cover;border-radius:12px" />
        <h2>${g.title}</h2>
        <p class="cat">${g.category} · ${stars} (${g.ratingCount || 0})</p>
        <p>${g.description || ''}</p>
        <p class="price ${Number(g.price)===0?'free':''}">${Number(g.price)===0?'Gratis':'$'+Number(g.price).toFixed(2)}</p>
        <p style="margin:1rem 0">
          ${g.fileName
            ? `<a class="btn primary" href="/api/games/${g.id}/download">Descargar desde PlayZone</a>`
            : `<span class="muted">Archivo aún no subido al servidor (el admin debe subirlo en el panel).</span>`}
        </p>
        <h3>Reseñas</h3>
        <div id="reviews-list">${reviews}</div>
        ${API.user ? `
        <form id="form-review">
          <label>Tu calificación</label>
          <select name="rating">
            <option value="5">5 ★</option><option value="4">4 ★</option>
            <option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option>
          </select>
          <label>Comentario</label>
          <textarea name="text" rows="3" placeholder="¿Qué te pareció?"></textarea>
          <button class="btn primary full" type="submit">Publicar reseña</button>
        </form>` : '<p class="muted">Inicia sesión para reseñar</p>'}
      </div>`;
    $('#form-review')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      try {
        await API.req('/api/games/' + id + '/reviews', {
          method: 'POST',
          body: JSON.stringify({ rating: fd.get('rating'), text: fd.get('text') }),
        });
        verDetalle(id);
      } catch (e) { alert(e.message); }
    });
  } catch (e) {
    box.innerHTML = `<p class="muted">${e.message}</p>`;
  }
};

async function loadChat() {
  const box = $('#chat-box');
  try {
    const msgs = await API.req('/api/messages');
    box.innerHTML = msgs.map((m) => `
      <div class="msg ${API.user && m.userId === API.user.id ? 'me' : ''}">
        <div class="who">${m.username}</div>${m.text}
      </div>`).join('') || '<p class="muted">Sé el primero en escribir</p>';
    box.scrollTop = box.scrollHeight;
  } catch (e) {
    box.innerHTML = `<p class="muted">${e.message}</p>`;
  }
}

async function loadDms() {
  if (!API.user) { $('#dm-users').innerHTML = '<p class="muted">Inicia sesión</p>'; return; }
  try {
    const [users, dms] = await Promise.all([API.req('/api/users'), API.req('/api/dms')]);
    $('#dm-users').innerHTML = users
      .filter((u) => u.id !== API.user.id)
      .map((u) => `<div class="user-item" data-id="${u.id}">@${u.username}</div>`).join('') || '<p class="muted">No hay usuarios</p>';
    $('#dm-list').innerHTML = dms.map((d) => `
      <div class="dm-item" data-dmid="${d.id}">${d.otherName}<br/><span class="muted">${d.lastMessage || ''}</span></div>`).join('') || '<p class="muted">Sin chats</p>';
    $$('#dm-users .user-item').forEach((el) => {
      el.onclick = async () => {
        const dm = await API.req('/api/dms', { method: 'POST', body: JSON.stringify({ userId: el.dataset.id }) });
        openDm(dm.id, el.textContent);
      };
    });
    $$('#dm-list .dm-item').forEach((el) => {
      el.onclick = () => openDm(el.dataset.dmid, el.textContent.split('\n')[0]);
    });
  } catch (e) {
    $('#dm-users').innerHTML = `<p class="muted">${e.message}</p>`;
  }
}

async function openDm(id, title) {
  currentDmId = id;
  $('#dm-title').textContent = title || 'Chat';
  $('#dm-form').classList.remove('hidden');
  const dm = await API.req('/api/dms/' + id);
  const box = $('#dm-box');
  box.innerHTML = (dm.messages || []).map((m) => `
    <div class="msg ${m.from === API.user.id ? 'me' : ''}">${m.text}
      <div class="muted" style="font-size:.7rem">${new Date(m.at).toLocaleString()}</div>
    </div>`).join('') || '<p class="muted">Sin mensajes</p>';
  box.scrollTop = box.scrollHeight;
}

async function loadAi() {
  if (!API.user) { $('#ai-box').innerHTML = '<p class="muted">Inicia sesión para hablar con la IA</p>'; return; }
  const hist = await API.req('/api/ai');
  const box = $('#ai-box');
  box.innerHTML = hist.map((m) => `
    <div class="msg ${m.role === 'user' ? 'me' : 'bot'}">
      <div class="who">${m.role === 'user' ? 'Tú' : 'IA PlayZone'}</div>${m.text}
    </div>`).join('') || '<p class="muted">Pregunta lo que quieras sobre PlayZone</p>';
  box.scrollTop = box.scrollHeight;
}

async function loadStreams() {
  const list = await API.req('/api/streams');
  $('#streams-list').innerHTML = list.map((s) => `
    <article class="card"><div class="card-body">
      <h3>${s.title}</h3>
      <p class="muted">@${s.username} · ${s.viewers} viewers · ${s.live ? 'EN VIVO' : ''}</p>
    </div></article>`).join('') || '<p class="muted">No hay streams</p>';
}

async function loadPerfil() {
  if (!API.user) return mostrarVista('login');
  try {
    const u = await API.req('/api/me');
    const f = $('#form-perfil');
    f.username.value = u.username || '';
    f.firstName.value = u.firstName || '';
    f.lastName.value = u.lastName || '';
    f.email.value = u.email || '';
    f.role.value = u.role || 'user';
  } catch (e) { alert(e.message); }
}

async function loadAdmin() {
  if (!API.user || API.user.role !== 'admin') return mostrarVista('tienda');
  try {
    const [stats, games] = await Promise.all([
      API.req('/api/admin/stats'),
      API.req('/api/admin/games'),
    ]);
    $('#admin-stats').innerHTML = Object.entries(stats).map(([k, v]) => `
      <div class="stat"><strong>${v}</strong><span class="muted">${k}</span></div>`).join('');
    $('#admin-games').innerHTML = games.map((g) => `
      <div class="admin-row">
        <img src="${g.image}" alt="" />
        <div style="flex:1"><strong>${g.title}</strong><br/><span class="muted">${g.category} · $${g.price}</span></div>
        <button class="btn small" onclick='editGame(${JSON.stringify(g).replace(/'/g, "&#39;")})'>Editar</button>
        <button class="btn small danger" onclick="deleteGame('${g.id}')">Borrar</button>
      </div>`).join('');
  } catch (e) {
    $('#admin-stats').innerHTML = `<p class="muted">${e.message}</p>`;
  }
}

window.editGame = function (g) {
  const f = $('#form-game');
  f.id.value = g.id;
  f.title.value = g.title || '';
  f.image.value = g.image || '';
  f.price.value = g.price ?? 0;
  f.category.value = g.category || '';
  f.tags.value = Array.isArray(g.tags) ? g.tags.join(', ') : '';
  f.description.value = g.description || '';
  f.downloadUrl.value = g.downloadUrl || '';
  f.license.value = g.license || '';
  f.scrollIntoView({ behavior: 'smooth' });
};
window.deleteGame = async function (id) {
  if (!confirm('¿Borrar este juego?')) return;
  try {
    await API.req('/api/games/' + id, { method: 'DELETE' });
    loadAdmin();
  } catch (e) { alert(e.message); }
};

// Eventos
document.addEventListener('DOMContentLoaded', () => {
  renderUserArea();
  $$('.nav-btn').forEach((b) => b.addEventListener('click', () => mostrarVista(b.dataset.vista)));
  $('#btn-carrito')?.addEventListener('click', () => mostrarVista('carrito'));
  $('#btn-search')?.addEventListener('click', filtrarTienda);
  $('#search-games')?.addEventListener('input', filtrarTienda);
  $('#search-games')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') filtrarTienda(); });
  $$('#filtros .chip').forEach((c) => {
    c.addEventListener('click', () => {
      $$('#filtros .chip').forEach((x) => x.classList.remove('active'));
      c.classList.add('active');
      currentCat = c.dataset.cat;
      filtrarTienda();
    });
  });

  $('#link-reg')?.addEventListener('click', (e) => { e.preventDefault(); mostrarVista('registro'); });
  $('#link-login')?.addEventListener('click', (e) => { e.preventDefault(); mostrarVista('login'); });
  $('#link-login2')?.addEventListener('click', (e) => { e.preventDefault(); mostrarVista('login'); });
  $('#link-forgot')?.addEventListener('click', (e) => { e.preventDefault(); mostrarVista('forgot'); });

  $('#form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await API.req('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
      });
      API.setAuth(data.token, data.user);
      renderUserArea();
      mostrarVista('tienda');
    } catch (err) { alert(err.message); }
  });

  $('#form-registro')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await API.req('/api/register', {
        method: 'POST',
        body: JSON.stringify({
          username: fd.get('username'), email: fd.get('email'),
          password: fd.get('password'), firstName: fd.get('firstName'),
        }),
      });
      API.setAuth(data.token, data.user);
      renderUserArea();
      mostrarVista('tienda');
    } catch (err) { alert(err.message); }
  });

  $('#form-forgot')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await API.req('/api/password/forgot', {
        method: 'POST', body: JSON.stringify({ email: fd.get('email') }),
      });
      $('#forgot-result').innerHTML = data.token
        ? `<p>${data.message}</p><p><strong>Token:</strong> <code>${data.token}</code></p>`
        : `<p>${data.message}</p>`;
    } catch (err) { alert(err.message); }
  });

  $('#form-reset')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await API.req('/api/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token: fd.get('token'), password: fd.get('password') }),
      });
      alert(data.message);
      mostrarVista('login');
    } catch (err) { alert(err.message); }
  });

  $('#form-perfil')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const u = await API.req('/api/me', {
        method: 'PUT',
        body: JSON.stringify({
          username: fd.get('username'), firstName: fd.get('firstName'), lastName: fd.get('lastName'),
        }),
      });
      API.setAuth(API.token, { ...API.user, ...u });
      renderUserArea();
      alert('Perfil actualizado');
    } catch (err) { alert(err.message); }
  });

  $('#btn-delete-account')?.addEventListener('click', async () => {
    if (!confirm('¿Eliminar tu cuenta de forma permanente?')) return;
    try {
      await API.req('/api/me', { method: 'DELETE' });
      API.setAuth('', null);
      renderUserArea();
      mostrarVista('tienda');
    } catch (err) { alert(err.message); }
  });

  $('#chat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!API.user) return mostrarVista('login');
    const input = $('#chat-input');
    try {
      await API.req('/api/messages', { method: 'POST', body: JSON.stringify({ text: input.value }) });
      input.value = '';
      loadChat();
    } catch (err) { alert(err.message); }
  });

  $('#dm-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentDmId) return;
    const input = $('#dm-input');
    try {
      await API.req('/api/dms/' + currentDmId + '/messages', {
        method: 'POST', body: JSON.stringify({ text: input.value }),
      });
      input.value = '';
      openDm(currentDmId, $('#dm-title').textContent);
    } catch (err) { alert(err.message); }
  });

  $('#ai-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!API.user) return mostrarVista('login');
    const input = $('#ai-input');
    try {
      await API.req('/api/ai', { method: 'POST', body: JSON.stringify({ text: input.value }) });
      input.value = '';
      loadAi();
    } catch (err) { alert(err.message); }
  });
  $('#btn-ai-clear')?.addEventListener('click', async () => {
    if (!API.user) return;
    await API.req('/api/ai', { method: 'DELETE' });
    loadAi();
  });

  $('#btn-stream')?.addEventListener('click', async () => {
    if (!API.user) return mostrarVista('login');
    const title = prompt('Título del stream');
    if (!title) return;
    try {
      await API.req('/api/streams', { method: 'POST', body: JSON.stringify({ title }) });
      loadStreams();
    } catch (err) { alert(err.message); }
  });

  $('#btn-checkout')?.addEventListener('click', async () => {
    try {
      const method = $('#payment-method')?.value || 'tarjeta';
      const result = await API.req('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({ paymentMethod: method }),
      });
      alert(result.message || 'Compra realizada. Ya puedes descargar desde Biblioteca.');
      loadCart();
      loadLibrary();
    } catch (err) { alert(err.message); }
  });

  $('#form-game')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      title: fd.get('title'),
      image: fd.get('image'),
      price: Number(fd.get('price') || 0),
      category: fd.get('category'),
      tags: String(fd.get('tags') || '').split(',').map((t) => t.trim()).filter(Boolean),
      description: fd.get('description'),
      license: fd.get('license'),
    };
    if (!body.image) return alert('La imagen es obligatoria');
    const fileInput = e.target.querySelector('input[name="gameFile"]');
    const file = fileInput?.files?.[0];
    try {
      const id = fd.get('id');
      let game;
      if (id) {
        game = await API.req('/api/games/' + id, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        game = await API.req('/api/games', { method: 'POST', body: JSON.stringify(body) });
      }
      if (file && game?.id) {
        const buf = await file.arrayBuffer();
        const token = localStorage.getItem('pz_token') || localStorage.getItem('token') || API.token;
        const up = await fetch('/api/games/' + game.id + '/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Filename': file.name,
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
          },
          body: buf,
        });
        const data = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(data.error || 'Error al subir el archivo del juego');
        alert('Juego y archivo guardados en PlayZone. Ya se puede descargar desde la tienda.');
      } else {
        alert('Juego creado, pero SIN archivo: los jugadores no podrán descargarlo hasta que subas el archivo del juego.');
      }
      e.target.reset();
      loadAdmin();
    } catch (err) { alert(err.message); }
  });
  $('#btn-game-reset')?.addEventListener('click', () => {
    $('#form-game').reset();
    $('#form-game').id.value = '';
  });

  if (API.user) loadCart().catch(() => {});
});
