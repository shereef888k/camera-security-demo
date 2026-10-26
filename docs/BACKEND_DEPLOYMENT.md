# Backend Production Deployment Guide

This guide describes how to deploy the Node.js Express backend service to modern cloud platforms with HTTPS and persistent SQLite storage.

---

## 1. Cloud Provider Recommendations

The backend requires:
- **Node.js** >= 18.0.0 (Node 20 LTS or Node 22+ recommended).
- **HTTPS** endpoint (required by browsers for secure CORS and camera communication).
- **Environment variables** support.
- **Persistent storage** for the SQLite sessions database (`sessions.db`).

Recommended providers:
1. **Render.com** (Web Service with optional Persistent Disk).
2. **Railway.app** (Volume attached to service).
3. **Fly.io** (Fly Volume mounted at `/data`).
4. **DigitalOcean / Hetzner / AWS Lightsail** (Standard VPS with full filesystem control).

---

## 2. Deploying to Render.com

### Step 1: Create a Web Service
1. Log in to [Render.com](https://render.com) and click **New +** &rarr; **Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free or Starter

### Step 2: Configure Persistent Disk (Important)
> [!NOTE]
> On free-tier containers without a disk, the filesystem is ephemeral and resets during cold starts or redeploys. While demonstration sessions are typically short-lived (15–60 minutes), persistent disks ensure session state survives restarts.

1. Under the **Disks** tab in your service settings, click **Add Disk**.
2. Name: `sessions-storage`
3. Mount Path: `/var/data`
4. Size: `1 GB` (more than sufficient for session tracking)
5. Set environment variable: `DATABASE_PATH=/var/data/sessions.db`

### Step 3: Set Environment Variables
Under the **Environment** tab on Render, add:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security optimizations. |
| `PORT` | `10000` | Render default web port (automatically populated). |
| `ADMIN_API_KEY` | `8c4d9e2a7b1f6305a...` | Cryptographically random admin key. |
| `TELEGRAM_BOT_TOKEN` | `7123456789:AAFl...` | Official Telegram Bot Token from BotFather. |
| `TELEGRAM_CHAT_ID` | `987654321` | Numeric Telegram chat identifier. |
| `FRONTEND_ORIGIN` | `https://<user>.github.io` | Exact deployed GitHub Pages origin. |
| `DATABASE_PATH` | `/var/data/sessions.db` | Path to persistent storage disk. |

---

## 3. Deploying to Railway.app

1. Log in to [Railway.app](https://railway.app) and create a **New Project** &rarr; **Deploy from GitHub repo**.
2. Set Root Directory to `/backend`.
3. Under **Settings** &rarr; **Volumes**, click **Add Volume** mounted to `/app/data`.
4. Under **Variables**, add:
   - `ADMIN_API_KEY=<secure-random-key>`
   - `TELEGRAM_BOT_TOKEN=<token>`
   - `TELEGRAM_CHAT_ID=<chat-id>`
   - `FRONTEND_ORIGIN=https://<user>.github.io`
   - `DATABASE_PATH=/app/data/sessions.db`
5. Click **Generate Domain** under Networking to get your public HTTPS URL.

---

## 4. Deploying to a Linux VPS (Ubuntu/Debian with Systemd & Nginx)

1. Clone repository and install dependencies:
   ```bash
   cd /var/www/camera-demo/backend
   npm install --omit=dev
   ```
2. Create production `.env` file:
   ```bash
   cp .env.example .env
   nano .env
   ```
3. Set up a systemd service (`/etc/systemd/system/camera-backend.service`):
   ```ini
   [Unit]
   Description=Camera Security Demonstration Backend
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/var/www/camera-demo/backend
   ExecStart=/usr/bin/node server.js
   Restart=on-failure
   EnvironmentFile=/var/www/camera-demo/backend/.env

   [Install]
   WantedBy=multi-user.target
   ```
4. Start and enable service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now camera-backend
   ```
5. Configure Nginx reverse proxy with Certbot SSL:
   ```nginx
   server {
       server_name api.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:4000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   ```bash
   sudo certbot --nginx -d api.yourdomain.com
   ```

---

## 5. Post-Deployment Verification

1. Test the health endpoint:
   ```bash
   curl -I https://api.yourdomain.com/api/health
   ```
   Expected response: `HTTP/2 200` with JSON body:
   ```json
   {
     "status": "ok",
     "database": "connected"
   }
   ```
2. Test CORS rejection:
   ```bash
   curl -H "Origin: https://unauthorized-domain.com" https://api.yourdomain.com/api/health
   ```
   Expected response: `403 Forbidden: CORS blocked`.
