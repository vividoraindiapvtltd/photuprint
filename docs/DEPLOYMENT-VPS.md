# Step-by-Step VPS Deployment Guide

Deploy **PP-Backend**, **Admin-CMS**, and **multiple PP-Frontend** storefronts on a **single VPS**. One domain serves both the API and the Admin CMS; multiple frontend domains (e.g. PhotuPrint, Print Nemo) run on the same server and all use that single backend.

---

## Architecture overview

| Component         | Role                                             | Where it runs on VPS                                     |
| ----------------- | ------------------------------------------------ | -------------------------------------------------------- |
| **Backend (API)** | Node/Express API + uploads + WebSocket           | One process (port 8080)                                  |
| **Admin CMS**     | React SPA for managing products, orders, content | One PM2 process on **port 3000**                         |
| **Frontend(s)**   | Next.js storefronts (one per brand/website)      | One PM2 process per storefront (**3001, 3002, 3003**, …) |

**Single “app” domain** (e.g. `app.photuprint.com`):

- `https://app.photuprint.com/api` → backend (proxy to 8080)
- `https://app.photuprint.com/` → Admin CMS (proxy to **port 3000**)

**Multiple frontend domains** (all on the same VPS):

- `https://photuprint.com` → Next.js storefront 1 (**port 3001**)
- `https://printnemo.com` → Next.js storefront 2 (**port 3002**)
- Additional storefronts: **3003, 3004**, …

All frontends call the **same** API: `https://app.photuprint.com/api`. Each frontend has its own `NEXT_PUBLIC_WEBSITE_ID` (and optional `NEXT_PUBLIC_SITE_URL`) so the backend can scope data by website.

---

## Prerequisites

- **VPS**: Ubuntu 22.04 LTS (or similar) with root/sudo access
- **Domains**: One for app/backend+admin (e.g. `app.photuprint.com`), and one per storefront (e.g. `photuprint.com`, `printnemo.com`)
- **MongoDB**: Atlas or self-hosted (same or separate server)
- **Node.js**: v18+ (v20 LTS recommended)

---

## How app.photuprint.com is set up

`app.photuprint.com` is the **single domain** for your backend API and Admin CMS. Setup has three parts: **DNS**, **Nginx**, and **SSL**.

### Step 1: DNS

At your domain registrar (where you manage `photuprint.com`), add a record so `app.photuprint.com` points to your VPS:

| Type  | Name  | Value         | TTL |
| ----- | ----- | ------------- | --- |
| **A** | `app` | `YOUR_VPS_IP` | 300 |

- **Name**: `app` (creates `app.photuprint.com`). Some providers use `app.photuprint.com` as the hostname.
- **Value**: The public IPv4 of your VPS (e.g. `203.0.113.50`).
- **TTL**: 300 is fine; 3600 or default is also OK.

Alternatively use a **CNAME** if your provider gives you a hostname (e.g. `vps123.example.com`): set Name = `app`, Value = that hostname.

Wait a few minutes, then check:

```bash
ping app.photuprint.com
# or: dig app.photuprint.com +short
```

You should see your VPS IP.

### Step 2: Nginx config on the VPS

Create a server block that sends `/api` and `/uploads` to the backend (port 8080) and everything else to Admin CMS (port 3000):

```bash
sudo nano /etc/nginx/sites-available/app.photuprint.com
```

Paste the config from **Section 3.3** (the full `server { ... }` block for `app.photuprint.com`). Save and exit.

Enable the site and reload Nginx:

```bash
sudo ln -sf /etc/nginx/sites-available/app.photuprint.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Ensure the backend (port 8080) and Admin CMS (port 3000) are running (PM2). Then:

- **HTTP**: `http://app.photuprint.com` → Admin; `http://app.photuprint.com/api` → API.

### Step 3: SSL (HTTPS)

Install Certbot and get a certificate for the app domain:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.photuprint.com
```

Follow the prompts (email, agree to terms). Certbot will configure HTTPS and redirect HTTP to HTTPS.

After this:

- **Admin**: `https://app.photuprint.com/`
- **API**: `https://app.photuprint.com/api`
- **Uploads**: `https://app.photuprint.com/uploads/...`

Use `https://app.photuprint.com` everywhere in your app (e.g. `REACT_APP_API_BASE_URL`, `NEXT_PUBLIC_API_URL`, backend `BACKEND_PUBLIC_URL`).

---

## 1. Prepare the VPS

### 1.1 Update system and install basics

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

### 1.2 Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x
npm -v
```

### 1.3 Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 1.4 Install PM2

```bash
sudo npm install -g pm2
```

---

## 2. Deploy PP-Backend

### 2.1 Project layout on VPS

Everything lives under one directory, e.g. `/var/www`:

```text
/var/www/
├── pp-backend/           # Backend repo (backend + admin-cms inside)
│   ├── backend/         # Node API, .env, uploads
│   ├── admin-cms/       # React SPA source and build output
│   └── package.json
├── pp-frontend-photuprint/   # Next.js for brand 1
└── pp-frontend-printnemo/    # Next.js for brand 2 (optional; can add more)
```

Clone or upload the backend repo:

```bash
sudo mkdir -p /var/www && sudo chown $USER:$USER /var/www
cd /var/www
git clone <your-pp-backend-repo-url> pp-backend
cd pp-backend
```

### 2.2 Install backend dependencies

```bash
npm install --production
```

### 2.3 Backend production `.env`

Edit `backend/.env` with production values. The **single** public URL for API (and admin) is the “app” domain:

```env
NODE_ENV=production
PORT=8080

# Database
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority

# Auth
JWT_SECRET=your_long_random_jwt_secret_min_32_chars

# Single domain for API + Admin (used for emails, webhooks, CORS if you restrict origins later)
BACKEND_PUBLIC_URL=https://app.photuprint.com
FRONTEND_ORIGIN=https://app.photuprint.com
FRONTEND_URL=https://app.photuprint.com

# Optional: comma-separated list of allowed origins (if you restrict CORS in backend)
# CORS_ORIGINS=https://app.photuprint.com,https://photuprint.com,https://printnemo.com,https://www.photuprint.com

# Razorpay (live keys in production)
RAZORPAY_KEY_ID=rzp_live_xxxx
RAZORPAY_KEY_SECRET=xxxx

# Fast2SMS, Cloudinary, Email (Brevo), etc.
FAST2SMS_API_KEY=your_key
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
CLOUDINARY_URL=cloudinary://key:secret@cloud_name
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_login
SMTP_PASS=your_smtp_key
```

Use your real `app.photuprint.com` (or whatever you chose) for `BACKEND_PUBLIC_URL` and `FRONTEND_ORIGIN` / `FRONTEND_URL` for the admin. Multiple storefront origins can be added to `CORS_ORIGINS` if you later restrict CORS in the backend.

### 2.4 Start backend with PM2

From the backend repo root:

```bash
cd /var/www/pp-backend
pm2 start backend/index.js --name "pp-api" --node-args="--experimental-vm-modules" 2>/dev/null || pm2 start backend/index.js --name "pp-api"
pm2 save
pm2 startup
```

Backend listens on port 8080; Nginx will proxy to it. Do not expose 8080 publicly.

---

## 3. Deploy Admin-CMS (same domain as backend)

Admin-CMS is built once and runs on **port 3000** (via a static server under PM2). Nginx on the app domain proxies `/` to that port.

### 3.1 Build Admin-CMS

Admin-CMS lives inside the backend repo:

```bash
cd /var/www/pp-backend/admin-cms
```

Create `.env.production` so the built app talks to the single API domain:

```env
REACT_APP_API_BASE_URL=https://app.photuprint.com
REACT_APP_SOCKET_URL=https://app.photuprint.com
```

Then build:

```bash
npm install
npm run build
```

This creates the `build/` directory.

### 3.2 Run Admin-CMS on port 3000 with PM2

Serve the Admin-CMS build on **port 3000** using a static server (e.g. `serve`)

```bash
cd /var/www/pp-backend/admin-cms
npm install -g serve
pm2 start serve --name "pp-admin-cms" -- -s build -l 3000
pm2 save
```

If you prefer to avoid a global install, use `npx`:

```bash
cd /var/www/pp-backend/admin-cms
pm2 start npx --name "pp-admin-cms" -- serve -s build -l 3000
pm2 save
```

Admin-CMS will be available at `http://127.0.0.1:3000`. Nginx will proxy the app domain to it.

### 3.3 Nginx: single domain for API + Admin

One server block: `/api` and `/uploads` go to the backend (8080); everything else goes to Admin CMS (port **3000**):

```nginx
# /etc/nginx/sites-available/app.photuprint.com
server {
    listen 80;
    server_name app.photuprint.com;

    client_max_body_size 50M;

    # Backend API (and uploads, WebSocket)
    location /api {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Backend uploads
    location /uploads {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Admin CMS – proxy to app running on port 3000
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable and test:

```bash
sudo ln -sf /etc/nginx/sites-available/app.photuprint.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Result:

- **API**: `https://app.photuprint.com/api` and `https://app.photuprint.com/uploads`
- **Admin**: `https://app.photuprint.com/` (proxied to the process on port 3000)

---

## 4. Deploy multiple frontends (same VPS, different domains)

Each storefront is a separate Next.js app (or separate build of the same repo) with its own `NEXT_PUBLIC_WEBSITE_ID` and `NEXT_PUBLIC_SITE_URL`. All run on the same VPS and all use the **same** backend: `https://app.photuprint.com/api`.

### 4.1 First frontend (e.g. PhotuPrint)

```bash
cd /var/www
git clone <your-pp-frontend-repo-url> pp-frontend-photuprint
cd pp-frontend-photuprint
```

Create `.env.production`:

```env
NEXT_PUBLIC_API_URL=https://app.photuprint.com/api
NEXT_PUBLIC_WEBSITE_ID=your_photuprint_website_id_from_mongodb
NEXT_PUBLIC_SITE_URL=https://photuprint.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

Build and run on **port 3001** (Admin-CMS uses 3000):

```bash
npm install
npm run build
PORT=3001 pm2 start node --name "pp-frontend-photuprint" -- .next/standalone/server.js
# If your Next.js uses a different path, use the server path from the build output.
pm2 save
```

Nginx will proxy `photuprint.com` to port 3001.

### 4.2 Second frontend (e.g. Print Nemo)

Same repo or a copy; different env and port:

```bash
cd /var/www
git clone <your-pp-frontend-repo-url> pp-frontend-printnemo
cd pp-frontend-printnemo
```

`.env.production`:

```env
NEXT_PUBLIC_API_URL=https://app.photuprint.com/api
NEXT_PUBLIC_WEBSITE_ID=your_printnemo_website_id_from_mongodb
NEXT_PUBLIC_SITE_URL=https://printnemo.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

Build and run on **port 3002**:

```bash
npm install
npm run build
PORT=3002 pm2 start node --name "pp-frontend-printnemo" -- .next/standalone/server.js
pm2 save
```

Additional storefronts use the next ports: **3003, 3004**, etc., each with its own domain and `NEXT_PUBLIC_WEBSITE_ID` / `NEXT_PUBLIC_SITE_URL`.

### 4.3 Nginx: one server block per frontend domain

**PhotuPrint (port 3001):**

```nginx
# /etc/nginx/sites-available/photuprint.com
server {
    listen 80;
    server_name photuprint.com www.photuprint.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Print Nemo (port 3002):**

```nginx
# /etc/nginx/sites-available/printnemo.com
server {
    listen 80;
    server_name printnemo.com www.printnemo.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable and reload:

```bash
sudo ln -sf /etc/nginx/sites-available/photuprint.com /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/printnemo.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. SSL (Let’s Encrypt)

Issue certificates for the app domain and all frontend domains:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.photuprint.com -d photuprint.com -d www.photuprint.com -d printnemo.com -d www.printnemo.com
```

Certbot will configure HTTPS in Nginx. Test renewal:

```bash
sudo certbot renew --dry-run
```

---

## 6. CORS and allowed origins (optional)

The backend currently uses `app.use(cors())` with no origin restriction, so all frontend and admin origins are allowed. If you later restrict CORS by setting an `origin` list, allow:

- Admin/API domain: `https://app.photuprint.com`
- Every storefront: `https://photuprint.com`, `https://www.photuprint.com`, `https://printnemo.com`, etc.

You can drive this from an env var, e.g. `CORS_ORIGINS`, and parse it in `backend/app.js` to pass to `cors({ origin: ... })`.

---

## 7. Multi-frontend: Razorpay and Cloudinary

The backend currently reads **one** set of Razorpay and Cloudinary credentials from environment variables (e.g. `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `CLOUDINARY_URL` or `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`). There is no per-website or per-frontend configuration in code: all frontends (PhotuPrint, Print Nemo, etc.) use the **same** keys.

### When this is enough (current design)

- **Single merchant / single brand group**: One Razorpay account and one Cloudinary cloud for the whole platform. Orders and media are still scoped by `websiteId` in the database, so each frontend sees only its own data; only the **payment and media provider accounts** are shared.
- **One Razorpay account**: All storefronts’ payments go to the same Razorpay merchant. Settlement and reporting are per that account; you can still filter by `website` or order metadata in your own DB for per-brand reporting.
- **One Cloudinary cloud**: All uploads (products, templates, etc.) live in one cloud. You can use **folders** or **tags** (e.g. `website:photuprint`, `website:printnemo`) to separate assets by brand if needed; the backend would need to pass a folder/tag when uploading, based on `req.websiteId`.

So: **multiple frontends are supported** by using one shared Razorpay and one shared Cloudinary account. Multi-tenancy is by `websiteId` in your app and DB, not by separate API keys per frontend.

### When each frontend has its own keys

If each brand has its **own** Razorpay account and/or Cloudinary account (e.g. different legal entities, separate bank settlements, or separate media brands), then the current backend does **not** support that out of the box. You have two approaches:

**Option A – One backend per brand (separate deployments)**  
Run a separate backend (and .env) per brand, each with that brand’s Razorpay and Cloudinary keys. Each frontend points to its own API. Deployments and ops are multiplied (e.g. `api.photuprint.com` and `api.printnemo.com`).

**Option B – Per-website credentials in the backend (single deployment)**  
Extend the backend so credentials are **per website**, not from global env:

1. **Store credentials per website**  
   Add fields to the **Website** model (or a separate `WebsiteConfig` / settings collection), e.g.:
   - `razorpayKeyId`, `razorpayKeySecret`
   - `cloudinaryCloudName`, `cloudinaryApiKey`, `cloudinaryApiSecret` (or `cloudinaryUrl`)

2. **Resolve credentials from request context**  
   In payment and upload flows, use `req.websiteId` (already set by tenant middleware) to load the **website’s** Razorpay/Cloudinary config. If a website has no keys, fall back to the existing env vars (so you can keep one default account).

3. **Razorpay**  
   In `razorpay.controller.js`: replace the single `getRazorpayInstance()` with a function that takes `websiteId`, loads that website’s keys (from DB), and returns a Razorpay instance. Same for `getRazorpayKey` (return the key for the current website). Webhook verification must use the secret for the website that owns the order (e.g. order has `website`; look up that website’s secret).

4. **Cloudinary**  
   Cloudinary’s Node SDK is typically configured once at startup. To support per-website config you’d either:
   - Create a **new** `cloudinary.v2` config per request (or per website) when uploading, using that website’s credentials, or
   - Use a single global config and rely on **folders/tags** per website only (no separate clouds).

5. **Security**  
   Keep secrets in the DB (or in a secret store) and never expose them to the frontend. Only the Razorpay **key_id** (public) is safe to send to the client for checkout.

### Summary

| Approach | Razorpay | Cloudinary | Backend change |
|----------|----------|------------|----------------|
| **Current** | One account (env) for all frontends | One cloud (env) for all | None |
| **Option A** | One account per backend | One cloud per backend | Separate deploy + .env per brand |
| **Option B** | Per-website keys in DB | Per-website config or folders | Extend Website (or config) model; resolve by `req.websiteId` in controllers and utils |

For most multi-frontend setups where all brands are under one business, the **current design** (one set of keys in `.env`) is sufficient; only data is scoped by `NEXT_PUBLIC_WEBSITE_ID` and `req.websiteId`. If you need separate Razorpay or Cloudinary accounts per brand, implement **Option B** (or Option A if you prefer separate backends per brand).

---

## 8. Post-deployment checklist

| Item         | Check                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------- |
| API          | `curl https://app.photuprint.com/api/status` (or your health route)                          |
| Admin        | Open `https://app.photuprint.com` and log in                                                 |
| Uploads      | Open `https://app.photuprint.com/uploads/...` for a known file (or via API response URL)     |
| Storefront 1 | Open `https://photuprint.com` – loads and calls `app.photuprint.com/api`                     |
| Storefront 2 | Open `https://printnemo.com` – same API, different website ID                                |
| Razorpay     | Webhook URL uses `https://app.photuprint.com/api/...`                                        |
| Emails       | Backend uses `BACKEND_PUBLIC_URL` / `FRONTEND_ORIGIN` where needed (e.g. verification links) |

---

## 9. Summary: what runs where on the VPS

| Service                 | Port          | Nginx server_name                         | PM2 process              |
| ----------------------- | ------------- | ----------------------------------------- | ------------------------ |
| Backend (API + uploads) | 8080          | `app.photuprint.com` → `/api`, `/uploads` | `pp-api`                 |
| Admin CMS               | **3000**      | `app.photuprint.com` → `/`                | `pp-admin-cms`           |
| Frontend PhotuPrint     | **3001**      | `photuprint.com`, `www.photuprint.com`    | `pp-frontend-photuprint` |
| Frontend Print Nemo     | **3002**      | `printnemo.com`, `www.printnemo.com`      | `pp-frontend-printnemo`  |
| (More frontends)        | 3003, 3004, … | (one server_name each)                    | (one PM2 process each)   |

All frontends and the admin use the **same** backend at `https://app.photuprint.com/api`.

---

## 10. Useful commands

```bash
# Backend
pm2 restart pp-api
pm2 logs pp-api

# Admin CMS (port 3000)
pm2 restart pp-admin-cms
pm2 logs pp-admin-cms

# Frontends (ports 3001, 3002, …)
pm2 restart pp-frontend-photuprint
pm2 restart pp-frontend-printnemo
pm2 logs pp-frontend-photuprint

# Redeploy after code changes
cd /var/www/pp-backend && git pull && npm install --production && pm2 restart pp-api
cd /var/www/pp-backend/admin-cms && git pull && npm install && npm run build && pm2 restart pp-admin-cms
# Reload Nginx if you changed vhost: sudo systemctl reload nginx

cd /var/www/pp-frontend-photuprint && git pull && npm install && npm run build && pm2 restart pp-frontend-photuprint
cd /var/www/pp-frontend-printnemo && git pull && npm install && npm run build && pm2 restart pp-frontend-printnemo
```

---

## 11. Troubleshooting

- **502 Bad Gateway**: Ensure the right PM2 process is running and the port in Nginx matches (`pm2 status`, `pm2 logs`).
- **CORS errors**: If you restricted CORS, ensure every storefront origin and `https://app.photuprint.com` are in the allowed list.
- **Admin 404 on refresh**: The Admin app runs on port 3000 (e.g. via `serve`); the SPA router handles routes. Ensure Nginx proxies `/` to `http://127.0.0.1:3000` and that the static server is configured for SPA fallback (e.g. `serve -s build`).
- **Uploads 404**: Confirm `/uploads` is proxied to the backend (port 8080) and the backend serves the `uploads` directory.
- **Wrong storefront data**: Check each frontend’s `NEXT_PUBLIC_WEBSITE_ID` and that it matches the intended website in MongoDB.

This setup gives you one place (one domain) for the backend and admin, multiple frontend domains on the same VPS, all using that single API.
