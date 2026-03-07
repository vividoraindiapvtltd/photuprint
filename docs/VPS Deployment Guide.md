# Step-by-Step VPS Deployment Guide

Deploy **PP-Backend** (Node/Express API), **PP-Frontend** (Next.js storefront), and **Admin-CMS** (React SPA) on a Linux VPS using Nginx, PM2, and optional SSL.

---

## Prerequisites

- **VPS**: Ubuntu 22.04 LTS (or similar) with root/sudo access
- **Domain(s)** (e.g. `photuprint.com`, `admin.photuprint.com`, or use IP for testing)
- **MongoDB**: Either MongoDB Atlas (cloud) or self-hosted on the same VPS
- **Node.js**: v18+ (LTS recommended)

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

### 1.4 Install PM2 (process manager)

```bash
sudo npm install -g pm2
```

---

## 2. Deploy PP-Backend

### 2.1 Clone or upload the backend repo

```bash
# Example: clone (or use rsync/scp to upload your local repo)
cd /var/www
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
git clone <your-pp-backend-repo-url> pp-backend
cd pp-backend
```

If you don’t use git, upload the project (excluding `node_modules`) and `cd` into the backend root (the folder that contains `backend/` and `package.json`).

### 2.2 Install dependencies

```bash
npm install --production
```

### 2.3 Create production `.env`

Create or edit `backend/.env` (do **not** commit this file):

```bash
nano backend/.env
```

Use production values, for example:

```env
NODE_ENV=production
PORT=8080

# Database (MongoDB Atlas or your MongoDB URI)
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority

# Auth
JWT_SECRET=your_long_random_jwt_secret_min_32_chars

# Frontend / origins (for CORS and emails)
FRONTEND_ORIGIN=https://photuprint.com
FRONTEND_URL=https://photuprint.com

# Optional: public URL for backend (for emails, webhooks)
BACKEND_PUBLIC_URL=https://api.photuprint.com

# Razorpay (live keys in production)
RAZORPAY_KEY_ID=rzp_live_xxxx
RAZORPAY_KEY_SECRET=xxxx

# Fast2SMS (if used)
FAST2SMS_API_KEY=your_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
CLOUDINARY_URL=cloudinary://key:secret@cloud_name

# Email (e.g. Brevo SMTP)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_login
SMTP_PASS=your_smtp_key
```

Save and exit.

### 2.4 Start backend with PM2

From the **repo root** (where `package.json` and `backend/` live):

```bash
cd /var/www/pp-backend

# Start backend (entry: node backend/index.js)
pm2 start backend/index.js --name "pp-api" --node-args="--experimental-vm-modules" 2>/dev/null || pm2 start backend/index.js --name "pp-api"

# Save process list so it restarts on reboot
pm2 save
pm2 startup
```

Check:

```bash
pm2 status
pm2 logs pp-api
```

Backend should be listening on `PORT` (e.g. 8080). Do **not** expose 8080 to the internet; Nginx will proxy to it.

---

## 3. Deploy PP-Frontend (Next.js)

### 3.1 Clone or upload frontend repo

```bash
cd /var/www
git clone <your-pp-frontend-repo-url> pp-frontend
cd pp-frontend
```

### 3.2 Environment variables for build and runtime

Create `.env.production` (and/or set env vars before `next build`):

```env
NEXT_PUBLIC_API_URL=https://api.photuprint.com/api
NEXT_PUBLIC_WEBSITE_ID=your_website_id_from_mongodb
NEXT_PUBLIC_SITE_URL=https://photuprint.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

Replace `api.photuprint.com` / `photuprint.com` with your real domain(s).

### 3.3 Build and run with PM2

```bash
npm install
npm run build
```

Run the standalone server (Next.js outputs to `.next/standalone` when `output: "standalone"` is set):

```bash
pm2 start node --name "pp-frontend" -- .next/standalone/server.js
# If the server script path differs, use the path printed after next build (e.g. .next/standalone/server.js)
pm2 save
```

If your Next.js version expects a different command, use for example:

```bash
pm2 start npm --name "pp-frontend" -- start
```

Ensure port 3000 (or whatever Next uses) is not exposed directly; Nginx will proxy to it.

---

## 4. Deploy Admin-CMS (React SPA)

### 4.1 Clone or upload admin-cms

Admin-CMS lives inside the same repo as the backend:

```bash
cd /var/www/pp-backend/admin-cms
```

Or if it’s a separate repo:

```bash
cd /var/www
git clone <admin-cms-repo-url> admin-cms
cd admin-cms
```

### 4.2 Set production API URL

Create `.env.production` (for `react-scripts build`):

```env
REACT_APP_API_BASE_URL=https://api.photuprint.com
REACT_APP_SOCKET_URL=https://api.photuprint.com
```

Use your real API base URL (no `/api` suffix if your backend serves API at `/api` and REACT_APP_API_BASE_URL is the origin; adjust if your app expects `/api` in the path).

### 4.3 Build

```bash
npm install
npm run build
```

This produces a `build/` folder with static files.

### 4.4 Serve with Nginx

Admin-CMS is a static SPA. Serve the `build/` directory via Nginx (see Section 6). No PM2 process is needed for the CMS app itself—only Nginx.

---

## 5. Nginx Configuration

Use one Nginx config (e.g. one file per app or one server block per subdomain). Below is a split by subdomain.

### 5.1 API (backend) – e.g. `api.photuprint.com`

```nginx
# /etc/nginx/sites-available/api.photuprint.com
server {
    listen 80;
    server_name api.photuprint.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8080;
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

### 5.2 Storefront (Next.js) – e.g. `photuprint.com`

```nginx
# /etc/nginx/sites-available/photuprint.com
server {
    listen 80;
    server_name photuprint.com www.photuprint.com;

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

### 5.3 Admin-CMS (static) – e.g. `admin.photuprint.com`

```nginx
# /etc/nginx/sites-available/admin.photuprint.com
server {
    listen 80;
    server_name admin.photuprint.com;

    root /var/www/pp-backend/admin-cms/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /static {
        alias /var/www/pp-backend/admin-cms/build/static;
    }
}
```

### 5.4 Enable sites and reload Nginx

```bash
sudo ln -sf /etc/nginx/sites-available/api.photuprint.com /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/photuprint.com /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/admin.photuprint.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. SSL with Let’s Encrypt (HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d photuprint.com -d www.photuprint.com -d api.photuprint.com -d admin.photuprint.com
```

Follow prompts. Certbot will adjust your Nginx config for HTTPS. Test renewal:

```bash
sudo certbot renew --dry-run
```

---

## 7. Post-deployment checklist

| Item      | Check                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------- |
| Backend   | `curl https://api.photuprint.com/api/status` or similar health route                                                      |
| Frontend  | Open `https://photuprint.com` – storefront loads                                                                          |
| Admin-CMS | Open `https://admin.photuprint.com` – login page loads                                                                    |
| CORS      | Backend `FRONTEND_ORIGIN` / `FRONTEND_URL` includes `https://photuprint.com` and `https://admin.photuprint.com` if needed |
| Env       | Frontend `.env.production`: `NEXT_PUBLIC_API_URL=https://api.photuprint.com/api`                                          |
| Env       | Admin-CMS: `REACT_APP_API_BASE_URL=https://api.photuprint.com` (or same with `/api` if your app expects it)               |
| Uploads   | Backend serves `/uploads`; Nginx proxies to backend so `/uploads` works under API domain                                  |
| Razorpay  | Use live keys and correct webhook URL (e.g. `https://api.photuprint.com/api/...)`                                         |

---

## 8. Useful commands

```bash
# Backend
pm2 restart pp-api
pm2 logs pp-api

# Frontend
pm2 restart pp-frontend
pm2 logs pp-frontend

# After code/config changes
cd /var/www/pp-backend && git pull && npm install --production && pm2 restart pp-api
cd /var/www/pp-frontend && git pull && npm install && npm run build && pm2 restart pp-frontend
cd /var/www/pp-backend/admin-cms && git pull && npm install && npm run build
# Then reload Nginx if you changed vhost config: sudo systemctl reload nginx
```

---

## 9. Single-domain option (no subdomains)

If you prefer one domain, e.g. `photuprint.com`:

- **API**: `https://photuprint.com/api` → proxy to `http://127.0.0.1:8080`
- **Storefront**: `https://photuprint.com` → proxy to `http://127.0.0.1:3000`
- **Admin**: `https://photuprint.com/admin` → serve `admin-cms/build` with `try_files` and `index.html` for SPA

Then set:

- Backend: `FRONTEND_ORIGIN=https://photuprint.com`
- Frontend: `NEXT_PUBLIC_API_URL=https://photuprint.com/api`
- Admin-CMS: `REACT_APP_API_BASE_URL=https://photuprint.com` (and ensure your React app uses `/api` when calling the backend)

---

## 10. Troubleshooting

- **502 Bad Gateway**: Backend or Next.js not running or wrong port. Check `pm2 status` and `pm2 logs`.
- **CORS errors**: Add admin/frontend origins in backend CORS config and double-check `FRONTEND_ORIGIN` / `FRONTEND_URL`.
- **Admin-CMS 404 on refresh**: Nginx must serve `index.html` for SPA routes (`try_files $uri $uri/ /index.html`).
- **Uploads not loading**: Ensure Nginx forwards the request to the backend and that `backend` serves `/uploads` (e.g. `express.static('uploads')`).

This guide gives you a full path from a clean VPS to a running PP-Backend, PP-Frontend, and Admin-CMS with Nginx and optional SSL.
