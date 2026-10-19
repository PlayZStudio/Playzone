# Playzone

Catálogo de videojuegos (Node.js). Carpeta del proyecto: **Playzone**.

## Arranque

```bash
cd Playzone
npm install
npm start
```

Abre http://localhost:3000

Admin: correo en `.env` → `ADMIN_EMAIL=elvis.bastosv@gmail.com`  
Cierra sesión y vuelve a entrar para obtener rol admin.

## Descargas (sin links externos)

- El admin **sube el archivo** del juego (zip/rar/7z/apk…).
- **Gratis:** botón Descargar → archivo desde este servidor.
- **De pago:** añadir al carrito → elegir método de pago (demo) → biblioteca → Descargar.
- No se redirige a MediaFire ni páginas externas.

## Pagos (modo demo)

Métodos: **tarjeta**, **PSE**, **Nequi**, **PayPal**.  
No cobran dinero real; registran la compra y habilitan la descarga.  
En producción se conectaría Stripe / PayU / Mercado Pago.

## Seguridad (Hacksplaining / OWASP)

| Ataque | Mitigación en Playzone |
|--------|-------------------------|
| SQL Injection | Consultas parametrizadas en MySQL (`:named`) |
| XSS | `escapeHtml` en HTML del servidor + CSP |
| Broken Access Control | Admin solo por `ADMIN_EMAIL`; descarga de pago exige biblioteca |
| Path Traversal | `path.basename` en archivos de `uploads/games` |
| Archivos maliciosos | Lista blanca de extensiones + magic bytes; sin .exe |
| Contenido +18 | Filtro de título/descripción/tags/categoría |
| Fuerza bruta login | Rate limit por IP |
| Clickjacking | `X-Frame-Options: DENY` |

## JSON vs MySQL (VS Code + DBeaver)

### Modo JSON (por defecto)

- Archivo de datos: `Playzone/data/db.json` (se crea al primer `npm start`).
- **No** es un diagrama ER en DBeaver; es un archivo de texto.
- Editar usuarios/juegos en el JSON o por la API/admin de la web.

### Modo MySQL (sincronizado con el backend)

1. En DBeaver ejecuta `sql/schema.sql` (crea tablas).
2. En `.env` activa:

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=dbeaver
MYSQL_PASSWORD=Dbeaver123!
MYSQL_DATABASE=playzone
```

3. `npm start` → consola: `Base de datos: MySQL`.

**Una sola fuente de verdad:** el backend lee/escribe MySQL.  
- Si insertas un usuario en DBeaver → al recargar la app / login se ve (si la tabla y columnas coinciden con `db/mysql.js`).  
- Si te registras en la web → aparece la fila en DBeaver (Refresh).

**No** hay magia bidireccional con el modo JSON al mismo tiempo: o JSON **o** MySQL (`MYSQL_HOST` define el modo).

### Diagrama en DBeaver

1. Conecta a MySQL `playzone`.
2. Clic derecho en la base → **View Diagram** / **ER Diagram**.
3. El script de tablas está en: `Playzone/sql/schema.sql` (y `DB_playzone_fusion.sql`).

No abras `db.json` en DBeaver como diagrama SQL; usa el esquema MySQL.

## Estructura

- `server.js` — API
- `security.js` — validaciones de seguridad
- `db/json.js` / `db/mysql.js` — persistencia
- `public/` — frontend
- `uploads/games/` — archivos de juegos
- `sql/` — esquema MySQL
