# Navara — Backend

REST API powering [navara.com](https://navara.com) — public marketing site and admin
dashboard. Node.js 20 + Express 4 + Sequelize 6 + MySQL 8.

Frontend lives in [`navara-agency/navara-frontend`](https://github.com/navara-agency/navara-frontend).
This service is consumed by the frontend's `VITE_API_BASE_URL`.

> **Status**: production-ready. 48/48 contract + unit tests passing. Deployable to
> Hostinger Business shared hosting via the standard Node.js app workflow.

---

## What it does

| Surface | Endpoints | Notes |
|---|---|---|
| **Auth** | `POST /api/auth/login` | Single-admin JWT (HS256, 7-day expiry); 5/min rate limit |
| **Lead capture** | `POST /api/leads` | Public; persists lead, fires admin email, creates Cal.com booking. Honeypot + 10/h IP rate limit |
| **Lead admin** | `GET/PATCH/DELETE /api/leads/...` | Auth-protected, paginated, filterable |
| **Geo detection** | `GET /api/geo` | ip-api.com w/ LRU cache + Egypt fallback |
| **Site config** | `GET/PUT /api/site-config` | Singleton; partial PUT preserves unspecified fields |
| **Email config** | `GET/PUT/POST /api/email-config` | Admin-managed SMTP; password masked on read |
| **Translations** | `GET /:lang`, `PUT /:lang` (admin) | Deep-merge; both `en` and `ar` |
| **FAQ / Testimonials / Logos / Case Studies** | Public (published-only, sorted) + Admin CRUD | Drafts hidden from public endpoints |
| **Media uploads** | `POST /api/upload?type=image\|video\|logo` | multer-storage-cloudinary; streams to Cloudinary |
| **Cal.com integration** | `GET /api/calcom/slots`, booking via `POST /api/leads` | v2 API |
| **Health** | `GET /api/health` | DB ping + integration status report |

OpenAPI spec: see the spec docs in the original mono-repo, or hit `/api/health` to confirm
which integrations are configured against the running instance.

---

## Project layout

```
src/
├── config/                 # Sequelize, Cloudinary, logger, dotenv
├── middleware/             # auth.js (JWT), errorHandler.js
├── models/                 # 8 Sequelize models, auto-registered via index.js
├── migrations/             # 001-create-leads.js … 008-create-translations.js
├── routes/                 # 11 route modules (~40 endpoints)
├── services/               # email, geo, calcom, translations, siteConfig
└── scripts/seed.js         # Idempotent fixture seeder
tests/
├── contract/               # Jest + Supertest, per-endpoint
├── unit/                   # Pure logic (geo mapper, deep-merge)
└── helpers/                # testApp, auth helpers, env loader
server.js                   # Entry — db.authenticate() → app.listen()
```

---

## Local development

### 1. Install + configure

```bash
git clone https://github.com/navara-agency/navara-backend.git
cd navara-backend

npm install --legacy-peer-deps    # multer-storage-cloudinary peer dep ⇒ legacy resolution

cp .env.example .env
```

Edit `.env`:

```env
PORT=3001
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173

MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=navara
MYSQL_PASSWORD=navara-local-dev
MYSQL_DATABASE=navara

ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<bcrypt hash — see below>
JWT_SECRET=<64-char hex — see below>
JWT_EXPIRES_IN=7d

# Optional: Cloudinary, SMTP, Cal.com — backend works without them, but the
# corresponding features (uploads, lead notifications, auto-booking) will be disabled.
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

SMTP_HOST=
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
NOTIFY_EMAIL=

CAL_API_KEY=
CAL_EVENT_TYPE_ID_EGYPT=
CAL_EVENT_TYPE_ID_KSA=
EMAIL_BOOKING_CONFIRMATIONS=false

ALLOW_TRANSLATION_SEED=true
```

Generate the two hard secrets:

```bash
# admin password hash
node -e "console.log(require('bcrypt').hashSync('YOUR-ADMIN-PASSWORD', 12))"

# JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. Create the dev database

```bash
mysql -u root -p -e "CREATE DATABASE navara CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE USER 'navara'@'localhost' IDENTIFIED BY 'navara-local-dev'; GRANT ALL ON navara.* TO 'navara'@'localhost';"
```

### 3. Migrate + seed + run

```bash
npx sequelize-cli db:migrate    # creates 8 tables + singleton rows
node src/scripts/seed.js        # populates fixtures (needs the frontend repo's mocks)
npm run dev                     # nodemon on :3001
```

The seed script reads from `../navara-frontend/src/data/mockDashboard.js` and locale JSONs.
If you don't have the frontend cloned alongside, skip the seed step — the dashboard's
admin UI lets you create content from scratch.

### 4. Smoke check

```bash
curl http://localhost:3001/api/health
# → { "ok": true, "db": "ok", "integrations": { "cloudinary": false, "smtp": false, "cal": false }, ... }

curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR-ADMIN-PASSWORD"}'
# → { "token": "eyJ...", "expiresIn": "7d" }
```

---

## Tests

```bash
npm test                  # 48 tests across 12 suites, sqlite-in-memory dialect
npm run test:watch
npm run test:integration
```

`tests/.env.test` (committed) holds placeholders so the suite runs without manual env setup.
The bcrypt hash inside corresponds to the admin password `test-password-123`.

---

## Production deploy

See [Hostinger deploy guide](#deploy-to-hostinger-business) below, or fork the
[`Navarav2`](https://github.com/omarrislam/navara) mono-repo's `DEPLOY.md` and `VERIFICATION.md`
for the full walkthrough.

### Quick reference

```bash
# In the Hostinger Node app's terminal:
cd domains/navara.com/backend
git pull origin main
npm ci --omit=dev --legacy-peer-deps
npx sequelize-cli db:migrate     # idempotent
# hPanel → Node.js → Restart App
```

### Required production env vars

```
NODE_ENV=production
FRONTEND_ORIGIN=https://navara.com

MYSQL_*            (Hostinger hPanel-managed MySQL)
JWT_SECRET         (rotate to invalidate all sessions)
ADMIN_PASSWORD_HASH

CLOUDINARY_*       (free tier — 25 GB / 25 GB-bw)
SMTP_*             (Hostinger email or any SMTP provider)
NOTIFY_EMAIL       (where lead alerts go)
CAL_API_KEY
CAL_EVENT_TYPE_ID_EGYPT
CAL_EVENT_TYPE_ID_KSA

ALLOW_TRANSLATION_SEED=false   (after first deploy)
EMAIL_BOOKING_CONFIRMATIONS=false   (or true, if you want our SMTP to send booking emails too)
```

---

## Constitutional gates (Principle IV — Frontend / Backend Separation)

| Gate | Verification |
|---|---|
| IV.a — no client secrets | `npm run check:secrets` (run from mono-repo) greps `frontend/dist/` for server-only env names |
| IV.b — no raw SQL | All access via Sequelize models. Confirm: `grep -rE "sequelize\.query\(\`" src/` |
| IV.c — admin auth on every admin route | Every non-public router uses `requireAuth` middleware |
| IV.d — no local-disk uploads | `multer-storage-cloudinary` streams memory → Cloudinary |
| IV.e — CORS whitelist | `FRONTEND_ORIGIN` env, single-origin only |
| V — bilingual delivery | `translations` table holds both `en` and `ar` rows; startup health check warns if missing |

---

## Routine ops

```bash
# Reset admin password
node -e "console.log(require('bcrypt').hashSync('NEW-PASSWORD', 12))"
# → paste output into ADMIN_PASSWORD_HASH env var, restart

# Rotate JWT secret (invalidates all tokens — admin re-logs in)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# → paste into JWT_SECRET, restart

# Test SMTP without sending a real lead
curl -X POST https://api.navara.com/api/email-config/test \
  -H "Authorization: Bearer <admin-token>"
```

---

## License

Private. © Navara, 2026.
